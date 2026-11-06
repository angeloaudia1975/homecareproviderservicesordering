/* C3-07 Stage 7 — the public dealer storefront page (/store/<address>). Kept in its own file so /store.html runs under a strict
   Content-Security-Policy (no inline script). Every value is escaped; no cookies, no storage, nothing about the visitor. */
(function(){
  'use strict';
  var API='https://homecareproviderservices.netlify.app/.netlify/functions/storefront-public';
  var PH='data:image/svg+xml;utf8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#f1f3f5"/><path d="M38 78l14-18 10 12 8-10 12 16z" fill="#c4cad1"/><circle cx="47" cy="47" r="7" fill="#c4cad1"/></svg>');
  var slug=(location.pathname.match(/\/store\/([a-z0-9-]{3,50})\/?$/i)||[])[1]||new URLSearchParams(location.search).get('s')||'';
  slug=String(slug).toLowerCase();
  var D=null, F={line:'',cat:'',q:''}, VIEWQ=[], SEEN={}, LOADED=Date.now();
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function $(id){return document.getElementById(id);}
  function money(n){return '$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}
  function tel(p){return String(p||'').replace(/[^0-9+]/g,'');}
  function img(src,alt){return '<img src="'+esc(src||PH)+'" alt="'+esc(alt)+'" loading="lazy" data-ph="1">';}
  /* zero broken images: a picture that fails becomes the placeholder (one listener — no inline handlers, so a strict CSP holds) */
  document.addEventListener('error',function(e){ var t=e.target; if(t&&t.tagName==='IMG'&&t.getAttribute('data-ph')==='1'&&t.src!==PH){ t.removeAttribute('data-ph'); t.src=PH; } else if(t&&t.tagName==='IMG'&&t.getAttribute('data-logo')==='1') t.remove(); },true);
  /* the server decides the price and how it may be described: "MSRP" only for the manufacturer's own figure, else "Price" */
  function priceHtml(p){ if(!p.price) return '<div class="price call">Call for Price</div>';
    var tag=p.price_label==='MSRP'?'MSRP':''; var unit=p.price_unit?(tag?' ':'')+esc(p.price_unit):'';
    return '<div class="price">'+money(p.price)+(tag||unit?' <small>'+tag+unit+'</small>':'')+'</div>'; }
  /* PREVIEW (the dealer's own portal, before publishing): the page is opened inside the portal, which sends it the exact
     public answer for the unsaved settings. Nothing is counted and no request can be sent from a preview. */
  var PREVIEW=location.hash==='#preview'&&window.parent!==window;
  function fail(msg){document.title='Storefront';$('hdr').innerHTML='<div class="who"><h1>Storefront</h1></div>';$('info').innerHTML='';$('main').innerHTML='<div class="msg">'+esc(msg)+'</div>';}
  function load(){
    if(PREVIEW){ window.addEventListener('message',function(e){ if(e.origin!==location.origin||e.source!==window.parent||!e.data||e.data.type!=='hcps-storefront-preview') return;
        var j=e.data.data; if(!j||!j.ok) return fail((j&&j.error)||'The preview could not be loaded.'); D=j; render(); });
      window.parent.postMessage({type:'hcps-storefront-preview-ready'},location.origin); return; }
    if(!/^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/.test(slug)) return fail('This storefront isn\'t available.');
    fetch(API+'?s='+encodeURIComponent(slug)).then(function(r){return r.json().then(function(j){return {s:r.status,j:j};});}).then(function(x){
      if(!x.j||!x.j.ok) return fail((x.j&&x.j.error)||'This storefront isn\'t available.');
      D=x.j; render();
    }).catch(function(){fail('This storefront can\'t be shown just now — please try again shortly.');});
  }
  function render(){
    var d=D.dealer; document.title=d.name+' — Storefront';
    var a=d.address||{}, where=[a.street,a.city,[a.state,a.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    $('hdr').innerHTML=(d.logo?'<img class="logo" src="'+esc(d.logo)+'" alt="'+esc(d.name)+' logo" data-logo="1">':'')+
      '<div class="who"><h1>'+esc(d.name)+'</h1>'+(d.headline?'<div class="hl">'+esc(d.headline)+'</div>':'')+'</div>'+
      '<div class="acts">'+(d.phone?'<a class="btn" href="tel:'+esc(tel(d.phone))+'">📞 Call '+esc(d.phone)+'</a>':'')+'<button class="btn pri" type="button" data-ask="">Request information</button></div>';
    $('info').innerHTML=(where?'<span>📍 '+esc(where)+'</span>':'')+(d.hours?'<span>🕘 '+esc(d.hours)+'</span>':'')+(d.email?'<span>✉️ <a href="mailto:'+esc(d.email)+'">'+esc(d.email)+'</a></span>':'');
    var cats={}; D.products.forEach(function(p){ if(!F.line||p.manufacturer===F.line) cats[p.category]=1; });
    $('main').innerHTML=(d.about?'<div class="about">'+esc(d.about)+'</div>':'')+
      '<div class="tools"><input id="q" type="search" placeholder="Search products" aria-label="Search products" value="'+esc(F.q)+'"><select id="cat" aria-label="Category"><option value="">All categories</option>'+Object.keys(cats).sort().map(function(c){return '<option'+(c===F.cat?' selected':'')+'>'+esc(c)+'</option>';}).join('')+'</select></div>'+
      (D.lines.length>1?'<div class="chips"><button type="button" class="chip'+(F.line?'':' on')+'" data-line="">All brands</button>'+D.lines.map(function(l){return '<button type="button" class="chip'+(F.line===l.slug?' on':'')+'" data-line="'+esc(l.slug)+'">'+esc(l.name)+'</button>';}).join('')+'</div>':'')+
      '<div class="grid" id="grid"></div><div class="note">'+esc(D.price_note)+' Online ordering is not available — call the dealer or send a request.</div>';
    $('q').addEventListener('input',function(){F.q=this.value;grid();});
    $('cat').addEventListener('change',function(){F.cat=this.value;grid();});
    grid();
  }
  function shown(){
    var q=F.q.trim().toLowerCase();
    return D.products.filter(function(p){ if(F.line&&p.manufacturer!==F.line) return false; if(F.cat&&p.category!==F.cat) return false;
      if(q&&(p.name+' '+p.code+' '+p.category+' '+(p.brand||'')).toLowerCase().indexOf(q)<0) return false; return true; });
  }
  function lineName(s){var l=D.lines.filter(function(x){return x.slug===s;})[0];return l?l.name:'';}
  function grid(){
    var list=shown(), g=$('grid'); if(!g) return;
    if(!list.length){g.innerHTML='<div class="empty">No products match.</div>';return;}
    g.innerHTML=list.slice(0,300).map(function(p,i){return '<button type="button" class="card" data-i="'+D.products.indexOf(p)+'"><div class="im">'+img(p.image,p.name)+'</div><div class="bd"><div class="ln">'+esc(lineName(p.manufacturer))+'</div><div class="nm">'+esc(p.name)+'</div>'+priceHtml(p)+'</div></button>';}).join('')+
      (list.length>300?'<div class="empty" style="grid-column:1/-1">Showing 300 of '+list.length+' — search or choose a category to narrow the list.</div>':'');
  }
  function view(p){ if(PREVIEW) return; var k=p.manufacturer+'|'+p.code; if(SEEN[k]) return; SEEN[k]=1; VIEWQ.push({manufacturer:p.manufacturer,code:p.code}); if(VIEWQ.length>=10) flush(); }
  function flush(){ if(!VIEWQ.length) return; var items=VIEWQ.splice(0,40);
    try{ fetch(API,{method:'POST',keepalive:true,headers:{'content-type':'text/plain'},body:JSON.stringify({action:'view',s:slug,items:items})}).catch(function(){}); }catch(e){} }
  setInterval(flush,8000); addEventListener('pagehide',flush);
  var RETURN=null;
  function focusables(){ return [].slice.call($('dlg').querySelectorAll('button:not([disabled]),a[href],input:not([tabindex="-1"]),textarea,select')).filter(function(x){return x.offsetParent!==null;}); }
  function open(html,label){ var on=$('ov').classList.contains('on'); if(!on) RETURN=document.activeElement;
    $('dlg').innerHTML='<button class="x" type="button" aria-label="Close" data-close="1">×</button>'+html; $('ov').setAttribute('aria-label',label||'Details'); $('ov').classList.add('on');
    var f=$('dlg').querySelector('h2'); if(f){ f.setAttribute('tabindex','-1'); f.focus(); } else $('dlg').focus(); }
  function close(){ if(!$('ov').classList.contains('on')) return; $('ov').classList.remove('on'); $('dlg').innerHTML=''; if(RETURN&&RETURN.focus&&document.contains(RETURN)) RETURN.focus(); RETURN=null; }
  function product(p){
    view(p);
    var at=Object.keys(p.attributes||{}); var d=D.dealer;
    open('<div class="pd"><div>'+img(p.image,p.name)+'</div><div><div class="ln">'+esc(lineName(p.manufacturer))+(p.code?' · #'+esc(p.code):'')+'</div><h2 style="margin:4px 0 8px;color:var(--navy)">'+esc(p.name)+'</h2>'+priceHtml(p)+
      (p.description?'<p style="color:var(--ink2)">'+esc(p.description)+'</p>':'')+
      (p.features&&p.features.length?'<ul class="feats">'+p.features.map(function(f){return '<li>'+esc(f)+'</li>';}).join('')+'</ul>':'')+
      (at.length?'<table class="attrs">'+at.map(function(k){return '<tr><td>'+esc(k)+'</td><td>'+esc(p.attributes[k])+'</td></tr>';}).join('')+'</table>':'')+
      '<div class="acts" style="margin-top:14px">'+(d.phone?'<a class="btn" href="tel:'+esc(tel(d.phone))+'">📞 Call</a>':'')+'<button class="btn pri" type="button" data-ask="'+D.products.indexOf(p)+'">Request information</button></div></div></div>',p.name);
  }
  function ask(p){
    open('<h2 style="margin:0 0 4px;color:var(--navy)">Request information</h2><div style="color:var(--ink2)">'+(p?'About: <b>'+esc(p.name)+'</b>':'Send a message to '+esc(D.dealer.name))+'</div>'+
      '<form id="f" novalidate><label>Your name<input name="name" maxlength="120" autocomplete="name" required></label><label>Email<input name="email" type="email" maxlength="200" autocomplete="email"></label>'+
      '<label>Phone<input name="phone" type="tel" maxlength="40" autocomplete="tel"></label><label>Message<textarea name="message" rows="4" maxlength="2000"></textarea></label>'+
      '<div class="hp" aria-hidden="true"><label>Leave empty<input name="hp" tabindex="-1" autocomplete="off"></label></div>'+
      '<label class="chk"><input type="checkbox" name="consent"> <span>I agree that '+esc(D.dealer.name)+' may contact me about this request.</span></label>'+
      '<div class="note" style="margin:6px 0">'+esc(D.privacy)+'</div><div class="err" id="ferr" role="alert"></div><button class="btn pri" type="submit" id="fsend">Send request</button></form>','Request information');
    $('f').addEventListener('submit',function(ev){ ev.preventDefault(); var f=ev.target, b=$('fsend');
      if(PREVIEW){ $('ferr').textContent='This is a preview — requests can be sent once your storefront is published.'; return; }
      var body={action:'inquiry',s:slug,name:f.name.value,email:f.email.value,phone:f.phone.value,message:f.message.value,hp:f.hp.value,consent:f.consent.checked};
      if(p) body.product={manufacturer:p.manufacturer,code:p.code,name:p.name};
      if(Date.now()-LOADED<2500){ $('ferr').textContent='Please take a moment to fill in the form.'; return; }
      b.disabled=true; $('ferr').textContent='';
      fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(function(r){return r.json();}).then(function(j){
        if(j&&j.ok){ $('dlg').innerHTML='<button class="x" type="button" aria-label="Close" data-close="1">×</button><h2 style="color:var(--navy)">Thank you</h2><p class="ok">Your request was sent to '+esc(D.dealer.name)+'.</p><p>They will contact you soon.'+(D.dealer.phone?' To talk now, call <a href="tel:'+esc(tel(D.dealer.phone))+'">'+esc(D.dealer.phone)+'</a>.':'')+'</p>'; return; }
        b.disabled=false; $('ferr').textContent=(j&&j.error)||'Your request could not be sent — please call the dealer.';
      }).catch(function(){ b.disabled=false; $('ferr').textContent='Your request could not be sent — please call the dealer.'; });
    });
  }
  document.addEventListener('click',function(e){
    var t=e.target.closest?e.target:null; if(!t) return;
    if(t.closest('[data-close]')||t.id==='ov'){ close(); return; }
    var c=t.closest('[data-line]'); if(c){ F.line=c.getAttribute('data-line'); F.cat=''; render(); return; }
    var k=t.closest('.card[data-i]'); if(k){ product(D.products[+k.getAttribute('data-i')]); return; }
    var a=t.closest('[data-ask]'); if(a){ var i=a.getAttribute('data-ask'); ask(i===''?null:D.products[+i]); }
  });
  addEventListener('keydown',function(e){
    if(e.key==='Escape'){ close(); return; }
    if(e.key==='Tab'&&$('ov').classList.contains('on')){ var f=focusables(); if(!f.length) return; var first=f[0], last=f[f.length-1];
      if(e.shiftKey&&(document.activeElement===first||!$('dlg').contains(document.activeElement))){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey&&document.activeElement===last){ e.preventDefault(); first.focus(); } }
  });
  load();
})();
