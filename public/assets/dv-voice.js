/* Dealer Victoria — continuous spoken conversation (owner 2026-11-20 20:11). Adapted from Command Center's voice client
   (admin src/admin/voice-agent.js, the Deepgram Voice Agent) — the same audio path, states and barge-in; the dealer's
   functions run through dealer-victoria-api (TEST gate, permissions, caps, its own usage counters).

   window.DVVoice.create({ api, runTool, onEvent }) → { start(), stop(reason), say(text), level(), state }
   - start(): audio contexts are made inside the opening tap (before any await) so phones and Safari may play; the browser
     asks for the microphone when needed; dealer-victoria-api voice_session gives a 60-second token + the agent settings.
   - Microphone (echo cancellation on, so Victoria's own voice is not taken as the dealer's words) → 16-bit PCM →
     Deepgram, which detects the end of each turn. Deepgram's speech (24 kHz PCM) plays through a queue that is cut the
     moment the dealer starts speaking (barge-in). After Victoria speaks she is listening again — no button between turns.
   - FunctionCallRequest → runTool(question) — the page runs the dealer's request through the server's answer pipeline,
     performs and CHECKS any page action, and only then answers the agent (so Victoria never says it's open before it is).
   - stop(): closes the connection, stops the microphone and playback at once, drops any answer still on its way and
     records the minutes (voice_end). Nothing is recorded or stored by the page.
   States: connecting · listening · thinking · speaking · paused (tab hidden) · idle. Errors are explained (onEvent 'error'), never silent. */
"use strict";
(function () {
  const IDLE_MS = 120000, HIDDEN_MS = 120000;
  function f32ToI16(f) { const o = new Int16Array(f.length); for (let i = 0; i < f.length; i++) { const s = Math.max(-1, Math.min(1, f[i])); o[i] = s < 0 ? s * 0x8000 : s * 0x7fff; } return o; }
  const MIC_MSG = {
    NotAllowedError: 'Microphone access is blocked for this site. Allow the microphone in your browser\'s site settings to talk with Victoria — or type instead.',
    SecurityError: 'Microphone access is blocked for this site. Allow the microphone in your browser\'s site settings to talk with Victoria — or type instead.',
    NotFoundError: 'No microphone was found on this device. You can type instead.',
    NotReadableError: 'Another app is using the microphone. Close it and open Victoria again — or type instead.',
  };

  /* the browser and device, as the browser names them (for the walkthrough record) */
  function uaOf() { try { const d = navigator.userAgentData; if (d && d.brands) { const b = d.brands.filter((x) => !/Not.?A.?Brand|Chromium/i.test(x.brand)).map((x) => x.brand + ' ' + x.version).join(', '); return (b || 'Chromium') + ' · ' + (d.platform || '') + (d.mobile ? ' · mobile' : ''); } } catch (e) {} return String(navigator.userAgent || '').slice(0, 160); }
  function create(opts) {
    const api = opts.api, emit0 = (type, data) => { try { opts.onEvent && opts.onEvent(type, data || {}); } catch (e) {} };
    /* walkthrough record (owner 2026-11-20 22:45): per spoken turn, ms from the dealer starting to speak to — the words
       recognised (end of turn detected), the request to the portal, the answer sent back, Victoria's first audio; plus error
       codes and pauses. Numbers and codes only — never words or audio. Sent with voice_end. */
    const D = { turns: [], errors: [], paused: 0, cur: null };
    const mark = (k) => { if (D.cur && D.cur[k] == null) D.cur[k] = Date.now() - D.cur.s; };
    const closeTurn = () => { if (D.cur) { const t = Object.assign({}, D.cur); delete t.s; if (D.turns.length < 20) D.turns.push(t); } D.cur = null; };
    const emit = (type, data) => { if (type === 'error' && D.errors.length < 10) D.errors.push(String((data && (data.reason || data.kind)) || 'error').slice(0, 40)); if (type === 'paused') D.paused++; emit0(type, data); };
    const S = { state: 'idle', sid: null, ws: null, stream: null, inCtx: null, outCtx: null, proc: null, src: null, playing: [], playAt: 0,
      ana: null, lvl: null, started: 0, lastActivity: 0, idleTimer: null, maxTimer: null, keep: null, hideTimer: null, paused: false, resuming: null, streams: new Set(), turns: 0, interruptions: 0, ended: true, gen: 0, agentSpeaking: false };
    const set = (st) => { if (S.state === st) return; S.state = st; emit('state', { state: st }); };
    const touch = () => { S.lastActivity = Date.now(); };
    const send = (o) => { if (S.ws && S.ws.readyState === 1) S.ws.send(typeof o === 'string' || o instanceof ArrayBuffer ? o : JSON.stringify(o)); };

    function stopPlayback() { for (const n of S.playing) { try { n.stop(); } catch (e) {} } S.playing = []; S.playAt = 0; }
    function play(buf) {
      if (!S.outCtx || S.ended) return;
      if (D.cur && D.cur.answer != null) mark('audio');
      const i16 = new Int16Array(buf), f = new Float32Array(i16.length);
      for (let i = 0; i < i16.length; i++) f[i] = i16[i] / 0x8000;
      const b = S.outCtx.createBuffer(1, f.length, S.outCtx.sampleRate); b.copyToChannel(f, 0);
      const n = S.outCtx.createBufferSource(); n.buffer = b; n.connect(S.ana || S.outCtx.destination);
      const t = Math.max(S.outCtx.currentTime + 0.02, S.playAt); n.start(t); S.playAt = t + b.duration;
      if (!S.paused && (S.state === 'listening' || S.state === 'thinking')) set('speaking');
      S.playing.push(n); n.onended = () => { S.playing = S.playing.filter((x) => x !== n); if (!S.playing.length && !S.agentSpeaking && S.state === 'speaking') set(S.paused ? 'paused' : 'listening'); };
      touch();
    }

    async function onFunction(fn) {
      const my = S.gen; let args = {};
      try { args = typeof fn.arguments === 'string' ? JSON.parse(fn.arguments || '{}') : (fn.arguments || {}); } catch (e) { args = {}; }
      if (!S.paused) set('thinking'); touch();
      let content;
      try { content = await opts.runTool({ name: fn.name, args, session_id: S.sid }); }
      catch (e) { content = JSON.stringify({ error: 'tool_failed', message: 'I couldn\'t do that just now. You can try again or type it.' }); }
      if (my !== S.gen || S.ended) return;                                 // closed meanwhile: the late answer is dropped, never spoken
      send({ type: 'FunctionCallResponse', id: fn.id, name: fn.name, content: String(content || '{}') }); mark('answer');
      touch();
    }

    function onMessage(m) {
      switch (m.type) {
        case 'Welcome': break;
        case 'SettingsApplied': if (document.hidden) { emit('ready'); pause(); } else { startMic(); set('listening'); emit('ready'); } break;
        case 'UserStartedSpeaking': closeTurn(); D.cur = { s: Date.now() }; if (S.agentSpeaking || S.playing.length) { S.interruptions++; emit('interrupted'); } stopPlayback(); S.agentSpeaking = false; set('listening'); touch(); break;
        case 'AgentThinking': set('thinking'); touch(); break;
        case 'AgentStartedSpeaking': S.agentSpeaking = true; set('speaking'); touch(); break;
        case 'AgentAudioDone': S.agentSpeaking = false; if (!S.playing.length && S.state === 'speaking') set(S.paused ? 'paused' : 'listening'); break;
        case 'ConversationText': { const content = String(m.content || ''); if (m.role === 'user') { S.turns++; mark('heard'); } emit('text', { role: m.role === 'user' ? 'user' : 'assistant', content }); touch(); break; }
        case 'FunctionCallRequest': mark('request'); for (const fn of (m.functions || [])) if (fn.client_side !== false) onFunction(fn); break;
        case 'InjectionRefused': emit('warning', { message: 'refused' }); break;
        case 'Warning': emit('warning', { message: m.description || m.message || '' }); break;
        case 'Error': emit('error', { kind: m.code === 'CLIENT_MESSAGE_TIMEOUT' ? 'microphone' : 'service', reason: m.code || '', message: m.code === 'CLIENT_MESSAGE_TIMEOUT' ? 'Victoria couldn\'t hear your microphone. Check that it isn\'t muted or used by another app, then tap “Talk to Victoria” — or type instead.' : 'Victoria\'s voice service reported a problem. You can type instead.' }); stop('service_error', true); break;
        default: break;
      }
    }

    function startMic() {
      if (S.proc || !S.inCtx || !S.stream) return;
      const src = S.inCtx.createMediaStreamSource(S.stream);
      const proc = S.inCtx.createScriptProcessor(2048, 1, 1);
      proc.onaudioprocess = (e) => { if (!S.ws || S.ws.readyState !== 1) return; send(f32ToI16(e.inputBuffer.getChannelData(0)).buffer); };
      src.connect(proc); proc.connect(S.inCtx.destination);
      S.src = src; S.proc = proc;
    }

    async function start() {
      if (!S.ended) return;
      S.ended = false; const my = ++S.gen; S.turns = S.interruptions = 0; D.turns = []; D.errors = []; D.paused = 0; D.cur = null; set('connecting');
      const AC = window.AudioContext || window.webkitAudioContext;
      try { S.inCtx = new AC({ sampleRate: 16000 }); } catch (e) { S.inCtx = new AC(); }
      try { S.outCtx = new AC({ sampleRate: 24000 }); } catch (e) { S.outCtx = new AC(); }
      S.inCtx.resume && S.inCtx.resume().catch(() => {}); S.outCtx.resume && S.outCtx.resume().catch(() => {});
      emit('permission', { asking: true });
      try { S.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } }); }
      catch (e) { const why = (e && e.name) || ''; S.ended = true; cleanup(); set('idle'); emit('error', { kind: 'microphone', reason: why, message: MIC_MSG[why] || 'The microphone could not start. You can type instead.' }); return false; }
      if (S.stream) S.streams.add(S.stream);
      if (my !== S.gen || S.ended) { cleanup(); return false; }
      emit('permission', { asking: false, granted: true });
      let r; try { r = await api({ action: 'voice_session' }); } catch (e) { r = null; }
      if (my !== S.gen || S.ended) { if (r && r.session_id) api({ action: 'voice_end', session_id: r.session_id, seconds: 0, reason: 'closed_before_start' }).catch(() => {}); cleanup(); return false; }
      if (!r || r.ok !== true) { S.ended = true; cleanup(); set('idle'); emit('error', { kind: 'service', reason: (r && r.error) || 'network', message: (r && r.message) || 'Victoria\'s voice couldn\'t connect just now. You can type instead.' }); return false; }
      S.sid = r.session_id; S.started = Date.now(); touch();
      const settings = r.settings;
      settings.audio.input.sample_rate = S.inCtx.sampleRate;
      settings.audio.output.sample_rate = S.outCtx.sampleRate;
      try { S.ana = S.outCtx.createAnalyser(); S.ana.fftSize = 512; S.ana.smoothingTimeConstant = 0.6; S.ana.connect(S.outCtx.destination); S.lvl = new Float32Array(S.ana.fftSize); } catch (e) { S.ana = null; }
      emit('session', { greeting: r.greeting, max_minutes: r.max_minutes });
      let ws; try { ws = new WebSocket(r.url, ['bearer', r.token]); } catch (e) { emit('error', { kind: 'connection', message: 'Victoria\'s voice couldn\'t connect. You can type instead.' }); await stop('connect', true); return false; }
      ws.binaryType = 'arraybuffer'; S.ws = ws;
      /* KeepAlive every 5 s for the whole conversation (live 2026-11-20: when the browser held the audio back — a suspended
         audio context — Deepgram closed with CLIENT_MESSAGE_TIMEOUT); harmless while audio flows */
      ws.onopen = () => { send(settings); clearInterval(S.alive); S.alive = setInterval(() => { send({ type: 'KeepAlive' }); try { if (S.inCtx && S.inCtx.state === 'suspended') S.inCtx.resume().catch(() => {}); } catch (e) {} }, 5000); };
      ws.onmessage = (ev) => { if (typeof ev.data === 'string') { let m = null; try { m = JSON.parse(ev.data); } catch (e) {} if (m) onMessage(m); } else play(ev.data); };
      /* an unexpected close (network, service) is explained once — never a silent wait */
      ws.onerror = () => {};
      ws.onclose = () => { if (S.ended || my !== S.gen) return; const early = S.state === 'connecting';
        emit('error', { kind: 'connection', message: early ? 'Victoria\'s voice couldn\'t connect just now. Tap “Talk to Victoria” to try again, or type instead.' : 'The voice connection closed. Tap “Talk to Victoria” to keep talking, or type instead.' });
        stop('closed', early); };
      S.idleTimer = setInterval(() => { if (Date.now() - S.lastActivity > IDLE_MS && !S.playing.length && S.state === 'listening') { emit('idle'); stop('idle'); } }, 5000);
      document.addEventListener('visibilitychange', onVis);
      S.maxTimer = setTimeout(() => { emit('limit', { minutes: r.max_minutes }); stop('limit'); }, Math.max(1, Number(r.max_minutes) || 10) * 60000);
      return true;
    }

    /* TAB HIDDEN (owner 2026-11-20 21:52): microphone capture stops while the tab is hidden (the tracks are ended, so the
       browser's recording indicator goes off) and the connection is kept open with KeepAlive; when the dealer comes back
       and Victoria is still open the microphone is asked for again (no prompt where permission was granted) and she
       listens. Away longer than two minutes ends the conversation so nothing is held open. */
    function stopTracks() { try { S.proc && S.proc.disconnect(); S.src && S.src.disconnect(); } catch (e) {} if (S.proc) S.proc.onaudioprocess = null; S.proc = S.src = null;
      if (S.stream) S.stream.getTracks().forEach((t) => t.stop()); S.stream = null; stopAllStreams(); }
    /* every microphone stream this conversation ever got is stopped — none can be left capturing (review 2026-11-20) */
    function stopAllStreams() { for (const st of S.streams) { try { st.getTracks().forEach((t) => t.stop()); } catch (e) {} } S.streams.clear(); }
    function pause() {
      if (S.ended || S.paused || !S.ws) return;
      S.paused = true; stopTracks(); set('paused'); emit('paused');
      clearInterval(S.keep); S.keep = setInterval(() => send({ type: 'KeepAlive' }), 5000);
      awayTimer();
    }
    const awayTimer = () => { clearTimeout(S.hideTimer); S.hideTimer = setTimeout(() => { emit('away'); stop('hidden'); }, HIDDEN_MS); };
    function resume() { if (S.ended || !S.paused) return Promise.resolve(); if (!S.resuming) S.resuming = doResume().finally(() => { S.resuming = null; }); return S.resuming; }
    async function doResume() {
      clearTimeout(S.hideTimer); S.hideTimer = null; const my = S.gen;
      let st; try { st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } }); }
      catch (e) { if (my !== S.gen || S.ended) return; const why = (e && e.name) || ''; emit('error', { kind: 'microphone', reason: why, message: MIC_MSG[why] || 'The microphone could not start again. Tap “Talk to Victoria” or type instead.' }); stop('resume_failed', true); return; }
      if (my !== S.gen || S.ended || !S.paused) { st.getTracks().forEach((t) => t.stop()); return; }
      if (document.hidden) { st.getTracks().forEach((t) => t.stop()); awayTimer(); return; }   // hidden again meanwhile: still paused, the away limit runs again
      S.streams.add(st);
      clearInterval(S.keep); S.keep = null; S.stream = st; S.paused = false;
      try { S.inCtx && S.inCtx.resume && S.inCtx.resume(); S.outCtx && S.outCtx.resume && S.outCtx.resume(); } catch (e) {}
      startMic(); touch(); set(S.playing.length ? 'speaking' : 'listening'); emit('resumed');
    }
    const onVis = () => { if (document.hidden) pause(); else resume(); };

    function cleanup() {
      document.removeEventListener('visibilitychange', onVis); S.paused = false;
      clearInterval(S.keep); clearInterval(S.alive); clearInterval(S.idleTimer); clearTimeout(S.maxTimer); clearTimeout(S.hideTimer);
      try { S.proc && S.proc.disconnect(); S.src && S.src.disconnect(); } catch (e) {}
      if (S.proc) S.proc.onaudioprocess = null;
      S.proc = S.src = null; stopPlayback(); S.agentSpeaking = false;
      if (S.stream) S.stream.getTracks().forEach((t) => t.stop()); S.stream = null; stopAllStreams();
      for (const c of [S.inCtx, S.outCtx]) { try { c && c.close(); } catch (e) {} } S.inCtx = S.outCtx = null; S.ana = null;
    }
    /* immediate: the microphone, playback and any pending answer stop before anything is awaited */
    async function stop(reason, failed) {
      if (S.ended && !S.ws && !S.stream) { set('idle'); return; }
      S.ended = true; S.gen++;
      try { if (S.ws && S.ws.readyState <= 1) S.ws.close(); } catch (e) {}
      S.ws = null; cleanup();
      const sid = S.sid; S.sid = null; set('idle');
      if (!sid) return;
      const stats = { seconds: Math.round((Date.now() - S.started) / 1000), turns: S.turns, interruptions: S.interruptions, reason: reason || 'closed', failed: !!failed };
      closeTurn(); Object.assign(stats, { ua: uaOf(), turn_ms: D.turns.slice(), errors: D.errors.slice(), paused: D.paused });
      emit('ended', stats);
      try { await api(Object.assign({ action: 'voice_end', session_id: sid }, stats)); } catch (e) {}
    }
    /* Victoria speaks an exact text the server gave (the introduction); she listens again afterwards */
    function say(text) { const t = String(text || '').trim(); if (!t || !S.ws || S.ended) return false; stopPlayback(); send({ type: 'InjectAgentMessage', message: t.slice(0, 1500), behavior: 'interrupt' }); touch(); return true; }
    function level() {
      if (!S.ana || !S.playing.length) return 0;
      S.ana.getFloatTimeDomainData(S.lvl); let sum = 0; for (let i = 0; i < S.lvl.length; i++) sum += S.lvl[i] * S.lvl[i];
      return Math.min(1, Math.sqrt(sum / S.lvl.length) * 4);
    }
    return { start, stop: (r) => stop(r || 'closed'), say, level, get state() { return S.state; }, get active() { return !S.ended; },
      get listening() { return !S.ended && !!S.proc && !!S.ws && S.ws.readyState === 1; } };
  }
  window.DVVoice = { create, supported: () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext) && window.WebSocket && window.isSecureContext !== false) };
})();
