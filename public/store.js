/* Storefront v2 (2026-11-07) — the public dealer storefront page (/store/<address>). Kept in its own file so /store.html runs
   under a strict Content-Security-Policy (no inline script). Every value is escaped; no cookies, no storage, nothing about the
   visitor. Browse-and-inquire only: no cart, no checkout, no wholesale anything (the server never sends it).
   - Product FAMILIES: SKUs the catalog files as one product (an enrichment page, or a Golden model) show as one card with their
     sizes / options on the product page; different models are never merged. A family whose options cost different amounts
     says "From $x"; every SKU keeps its own price and its own inquiry.
   - Filters come only from data the catalog has (manufacturer, category, price, and specifications such as weight capacity
     or seat width when the product states them) — nothing is guessed.
   - Business information (name, logo, phone, hours, address, intro) is exactly what the dealer saved for the storefront. */
(function(){
  'use strict';
  var API='https://homecareproviderservices.netlify.app/.netlify/functions/storefront-public';
  var PH='data:image/svg+xml;utf8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#f1f3f5"/><path d="M38 78l14-18 10 12 8-10 12 16z" fill="#c4cad1"/><circle cx="47" cy="47" r="7" fill="#c4cad1"/></svg>');
  var slug=(location.pathname.match(/\/store\/([a-z0-9-]{3,50})\/?$/i)||[])[1]||new URLSearchParams(location.search).get('s')||'';
  slug=String(slug).toLowerCase();
  var D=null, FAM=[], BYKEY=Object.create(null), VIEWQ=[], SEEN={}, LOADED=Date.now();
  var F={q:'',cats:{},mfrs:{},min:'',max:'',cap:{},seat:{},feat:{},sort:'name',view:'grid',shown:48};
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function $(id){return document.getElementById(id);}
  function money(n){return '$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}
  function tel(p){return String(p||'').replace(/[^0-9+]/g,'');}
  function img(src,alt){return '<img src="'+esc(src||PH)+'" alt="'+esc(alt)+'" loading="lazy" data-ph="1">';}
  function count(o){return Object.keys(o).filter(function(k){return o[k];}).length;}
  /* ---------- design (owner 2026-11-07 14:53 CT): layout + theme from the server; "standard" = the existing look ---------- */
  var DS={layout:'standard'}, CATSHOW=false;
  function isNew(){ return DS.layout==='professional'||DS.layout==='modern'||DS.layout==='classic'; }
  var HEXRE=/^#[0-9a-f]{6}$/i;
  function mix(hex,other,t){ var a=[1,3,5].map(function(i){return parseInt(hex.slice(i,i+2),16);}), b=[1,3,5].map(function(i){return parseInt(other.slice(i,i+2),16);});
    return '#'+a.map(function(v,i){return Math.round(v*(1-t)+b[i]*t).toString(16).padStart(2,'0');}).join(''); }
  function applyDesign(){
    var d=(D.dealer&&D.dealer.design)||{}; DS=d&&typeof d==='object'?d:{layout:'standard'};
    var b=document.body; b.classList.remove('lay','lay-professional','lay-modern','lay-classic');
    if(!isNew()) return;
    b.classList.add('lay','lay-'+DS.layout);
    var r=document.body.style, ok=function(v){return HEXRE.test(String(v||''));};
    if(ok(DS.primary)){ r.setProperty('--brand',DS.primary); r.setProperty('--brand-soft',mix(DS.primary,'#ffffff',0.92)); r.setProperty('--brand-dark',mix(DS.primary,'#000000',0.35)); }
    if(ok(DS.on_primary)) r.setProperty('--on-brand',DS.on_primary);
    if(ok(DS.accent)) r.setProperty('--cta',DS.accent);
    if(ok(DS.on_accent)) r.setProperty('--on-cta',DS.on_accent);
    if(ok(DS.link)) r.setProperty('--accent',DS.link);
    var n=Number(DS.cat_cols); r.setProperty('--cols',String(n===2||n===3||n===4?n:4));
  }
  var ICO={phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    pin:'<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>', clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>', home:'<path d="M3 10.5 12 3l9 7.5V21H3z"/><path d="M9 21v-7h6v7"/>', grid:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    tag:'<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>', chev:'<path d="m9 18 6-6-6-6"/>', mail:'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    check:'<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>', search:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'};
  function ico(k){ return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">'+(ICO[k]||'')+'</svg>'; }
  /* categories in the dealer's order (cat_order first), then by size — the same list for the grid and the menu */
  function catList(){ var cats={}; FAM.forEach(function(f){ var c=cats[f.cat]||(cats[f.cat]={n:0,img:null}); c.n++; if(!c.img&&f.lead.image) c.img=f.lead.image; });
    var ord=(DS.cat_order||[]).map(function(x){return String(x).toLowerCase();});
    return Object.keys(cats).sort(function(a,b){ var ia=ord.indexOf(a.toLowerCase()), ib=ord.indexOf(b.toLowerCase()); if(ia<0) ia=1e6; if(ib<0) ib=1e6; return ia-ib||cats[b].n-cats[a].n||a.localeCompare(b); })
      .map(function(c){ return {name:c,n:cats[c].n,img:cats[c].img}; }); }
  /* zero broken images: a picture that fails becomes the placeholder (one listener — no inline handlers, so a strict CSP holds) */
  document.addEventListener('error',function(e){ var t=e.target; if(t&&t.tagName==='IMG'&&t.getAttribute('data-ph')==='1'&&t.src!==PH){ t.removeAttribute('data-ph'); t.src=PH; } else if(t&&t.tagName==='IMG'&&t.getAttribute('data-logo')==='1') t.remove(); },true);
  var PREVIEW=location.hash==='#preview'&&window.parent!==window;
  function fail(msg){document.title='Storefront';$('hdr').innerHTML='<div class="brand"><h1>Storefront</h1></div>';$('info').innerHTML='';$('cats').innerHTML='';$('main').innerHTML='<div class="msg">'+esc(msg)+'</div>';}
  function load(){
    if(PREVIEW){ window.addEventListener('message',function(e){ if(e.origin!==location.origin||e.source!==window.parent||!e.data||e.data.type!=='hcps-storefront-preview') return;
        var j=e.data.data; if(!j||!j.ok) return fail((j&&j.error)||'The preview could not be loaded.'); D=j; prepare(); applyDesign(); route(); });
      window.parent.postMessage({type:'hcps-storefront-preview-ready'},location.origin); return; }
    if(!/^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/.test(slug)) return fail('This storefront isn\'t available.');
    fetch(API+'?s='+encodeURIComponent(slug)).then(function(r){return r.json().then(function(j){return {s:r.status,j:j};});}).then(function(x){
      if(!x.j||!x.j.ok) return fail((x.j&&x.j.error)||'This storefront isn\'t available.');
      D=x.j; prepare(); applyDesign(); route();
    }).catch(function(){fail('This storefront can\'t be shown just now — please try again shortly.');});
  }

  /* ---------- data: families, facets ---------- */
  function lineName(s){var l=(D.lines||[]).filter(function(x){return x.slug===s;})[0];return l?l.name:'';}
  function num(re,v){var m=String(v||'').replace(/,/g,'').match(re);return m?Number(m[1]):null;}
  function attr(p,re){var a=p.attributes||{};for(var k in a){if(re.test(k))return a[k];}return null;}
  /* only values in the units the buckets use: pounds (or a bare number), inches (or a bare number) — kg / cm are skipped, never converted by guess */
  function capOf(p){var v=attr(p,/weight capacity|^capacity$|max(imum)? weight/i);
    if(!v){ /* live check: Golden states it as a feature ("400 lbs max", "Weight capacity 350 lb") — only that exact wording counts */
      (p.features||[]).some(function(f){ var m=String(f).match(/^\s*(?:(?:max(?:imum)?\s+)?(?:weight\s+)?capacity:?\s*(?:of\s+)?(\d{3,4})\s*(?:lb|lbs|pounds)\b|(\d{3,4})\s*(?:lb|lbs|pounds)\.?\s*(?:max(?:imum)?|capacity)\b)/i); if(m){ v=(m[1]||m[2])+' lb'; return true; } return false; }); }
    if(!v||/\b(kg|kilo)/i.test(v))return null;return num(/(\d{2,4})\s*(?:lb|lbs|pounds|#)?\b/i,v);}
  function seatOf(p){var v=attr(p,/^seat width/i);if(!v||/\b(cm|mm|centim|millim)/i.test(v))return null;return num(/(\d{1,2}(?:\.\d)?)/,v);}
  var FEAT_KEYS=/^(zones|comfort zones|positioning|recline|product type|type|style)$/i;
  function commonName(ps){ var n=ps.map(function(p){return p.name;}); if(n.length<2) return n[0];
    var a=n[0]; for(var i=1;i<n.length;i++){ while(a&&n[i].indexOf(a)!==0) a=a.slice(0,-1); } a=a.replace(/[\s\-–—,(/]+$/,'').trim(); return a.length>=6?a:n[0]; }
  function prepare(){
    var groups={}, order=[];
    D.products.forEach(function(p,i){ p._i=i; var k=p.manufacturer+'|'+(p.family||p.code); if(!groups[k]){groups[k]=[];order.push(k);} groups[k].push(p); });
    FAM=order.map(function(k){ var ps=groups[k], prices=ps.map(function(p){return p.price;}).filter(function(x){return x!=null;});
      var lead=ps.filter(function(p){return p.image;})[0]||ps[0];
      var name=ps[0].family_name||commonName(ps);
      var feats=[]; ps.forEach(function(p){(p.features||[]).forEach(function(f){ if(feats.indexOf(f)<0) feats.push(f); });});
      var f={key:k, ps:ps, lead:lead, name:name, mfr:ps[0].manufacturer, cat:ps[0].category||'Other', min:prices.length?Math.min.apply(null,prices):null, max:prices.length?Math.max.apply(null,prices):null,
        allPriced:prices.length===ps.length, feats:feats, caps:ps.map(capOf).filter(function(x){return x!=null;}), seats:ps.map(seatOf).filter(function(x){return x!=null;}), tags:{}};
      ps.forEach(function(p){ var a=p.attributes||{}; Object.keys(a).forEach(function(kk){ if(FEAT_KEYS.test(kk)) f.tags[kk+': '+a[kk]]=1; }); });
      f.text=(name+' '+ps.map(function(p){return p.name+' '+p.code+' '+(p.description||'');}).join(' ')+' '+f.cat+' '+lineName(f.mfr)+' '+feats.join(' ')).toLowerCase();
      BYKEY[k]=f; return f; });
  }
  var CAPB=[['≤300',0,300],['301–400',301,400],['401–500',401,500],['Over 500',501,1e9]], SEATB=[['Under 19"',0,18.99],['19–21"',19,21.99],['22–24"',22,24.99],['25" and wider',25,1e9]];
  function inB(vals,B,sel){ var on=Object.keys(sel).filter(function(k){return sel[k];}); if(!on.length) return true; return vals.some(function(v){ return B.some(function(b){ return sel[b[0]]&&v>=b[1]&&v<=b[2]; }); }); }
  function pass(f,skip){
    var q=F.q.trim().toLowerCase();
    if(q && q.split(/\s+/).some(function(w){return f.text.indexOf(w)<0;})) return false;
    if(skip!=='cat'&&count(F.cats)&&!F.cats[f.cat]) return false;
    if(skip!=='mfr'&&count(F.mfrs)&&!F.mfrs[f.mfr]) return false;
    var mn=parseFloat(F.min), mx=parseFloat(F.max);
    if(!isNaN(mn)&&!(f.max!=null&&f.max>=mn)) return false;
    if(!isNaN(mx)&&!(f.min!=null&&f.min<=mx)) return false;
    if(skip!=='cap'&&!inB(f.caps,CAPB,F.cap)) return false;
    if(skip!=='seat'&&!inB(f.seats,SEATB,F.seat)) return false;
    if(skip!=='feat'&&count(F.feat)&&!Object.keys(F.feat).some(function(t){return F.feat[t]&&f.tags[t];})) return false;
    return true;
  }
  function results(){ var L=FAM.filter(function(f){return pass(f);});
    var by={name:function(a,b){return a.name.localeCompare(b.name);},plh:function(a,b){return (a.min==null?1e12:a.min)-(b.min==null?1e12:b.min)||a.name.localeCompare(b.name);},
      phl:function(a,b){return (b.max==null?-1:b.max)-(a.max==null?-1:a.max)||a.name.localeCompare(b.name);}};
    return L.sort(by[F.sort]||by.name); }

  /* ---------- header ---------- */
  var DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  function hoursLines(h){ var s=String(h||'').trim(); if(!s) return [];
    var re=/(Mon(?:day)?|Tue(?:s|sday)?|Wed(?:nesday)?|Thu(?:r|rs|rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)\s*:/gi, idx=[], m;
    while((m=re.exec(s))) idx.push(m.index);
    if(idx.length<2) return [s];
    var out=[]; if(idx[0]>0) out.push(s.slice(0,idx[0]).trim()); for(var i=0;i<idx.length;i++) out.push(s.slice(idx[i],idx[i+1]).trim()); return out.filter(Boolean); }
  function todayLine(hl){ var today=DAYS[new Date().getDay()]; return hl.filter(function(l){return l.toLowerCase().indexOf(today.slice(0,3).toLowerCase())===0;})[0]||''; }
  function where(){ var a=D.dealer.address||{}; return [a.street,a.city,[a.state,a.zip].filter(Boolean).join(' ')].filter(Boolean).join(', '); }
  function mapsUrl(){ return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(D.dealer.name+' '+where()); }
  function header2(){
    var d=D.dealer, w=where(), a=d.address||{};
    var logo=d.logo?'<span class="lg" id="lgbox"><img src="'+esc(d.logo)+'" alt="'+esc(d.name)+'" data-logo="1"></span>':'<span class="wordmark">'+esc(d.name)+'</span>';
    $('hdr').className='wrap sb';
    $('hdr').innerHTML='<a class="brand" href="#" data-home="1" aria-label="'+esc(d.name)+' — storefront home">'+logo+'</a>'+
      '<div class="bn">'+(d.logo?'<h1 class="n">'+esc(d.name)+'</h1>':'<h1 class="n" style="position:absolute;left:-9999px">'+esc(d.name)+'</h1>')+(d.headline?'<div class="t">'+esc(d.headline)+'</div>':'')+'</div>'+
      '<div class="acts">'+(d.phone?'<a class="callnum" href="tel:'+esc(tel(d.phone))+'">'+ico('phone')+'<span><b>'+esc(d.phone)+'</b><small>Call us</small></span></a>':'')+
      '<button class="btn pri" type="button" data-ask="">'+ico('info')+' Request information</button></div>';
    var nav=$('mnav'); nav.hidden=false;
    nav.innerHTML='<div class="wrap catpanel"><a href="#" data-home="1">'+ico('home')+' Home</a><a href="#" data-all="1">'+ico('grid')+' All products</a>'+
      '<button type="button" class="nl" id="catbtn" aria-expanded="false" aria-controls="catdrop">'+ico('tag')+' Categories ▾</button>'+
      (d.about?'<a href="#" data-about="1">'+ico('info')+' About us</a>':'')+(a.street?'<a href="'+esc(mapsUrl())+'" target="_blank" rel="noopener">'+ico('pin')+' Directions</a>':'')+
      '<form class="search" role="search" id="sform"><label for="sq" style="position:absolute;left:-9999px">Search products</label><input id="sq" type="search" placeholder="Search lift chairs, scooters, wheelchairs…" value="'+esc(F.q)+'" autocomplete="off"><button type="submit" aria-label="Search">'+ico('search')+'</button></form>'+
      '<div class="catdrop" id="catdrop" role="region" aria-label="All categories"><div class="cg">'+catList().map(function(c){return '<a href="#category/'+encodeURIComponent(c.name)+'" data-catlink="'+esc(c.name)+'">'+esc(c.name)+'<span>'+c.n+'</span></a>';}).join('')+'</div></div></div>';
    $('info').innerHTML='';
    $('foot').innerHTML='<b>'+esc(d.name)+'</b>'+(w?' · '+esc(w):'')+(d.phone?' · <a href="tel:'+esc(tel(d.phone))+'">'+esc(d.phone)+'</a>':'')+'<br>'+esc(D.price_note)+' Products shown are available to order through this dealer; availability is confirmed when you contact them. Online purchase is not available — call or send a request. Storefront provided through the HomeCare Provider Services 360 Dealer Portal.';
    $('sform').addEventListener('submit',function(e){e.preventDefault();F.q=$('sq').value;F.shown=48;if(!PREVIEW&&location.hash&&location.hash!=='#') location.hash=''; else { listing(); toResults(); }});
    var li=$('lgbox')&&$('lgbox').querySelector('img'); if(li){ var sq=function(){ if(li.naturalWidth&&li.naturalHeight&&li.naturalWidth/li.naturalHeight<1.6) $('lgbox').classList.add('sq'); }; if(li.complete) sq(); else li.addEventListener('load',sq); }
  }
  function toResults(){ var r=$('results'); if(r) r.scrollIntoView({behavior:'smooth',block:'start'}); }
  function header(){
    if(isNew()) return header2();
    var d=D.dealer; var a=d.address||{}, where=[a.street,a.city,[a.state,a.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    $('hdr').innerHTML='<a class="brand" href="#" data-home="1">'+(d.logo?'<img class="logo" src="'+esc(d.logo)+'" alt="'+esc(d.name)+' logo" data-logo="1">':'')+
      '<div><h1>'+esc(d.name)+'</h1>'+(d.headline?'<div class="hl">'+esc(d.headline)+'</div>':'')+'</div></a>'+
      '<form class="search" role="search" id="sform"><label class="sr" for="sq" style="position:absolute;left:-9999px">Search products</label><input id="sq" type="search" placeholder="Search lift chairs, scooters, walkers…" value="'+esc(F.q)+'" autocomplete="off"><button type="submit">Search</button></form>'+
      '<div class="acts">'+(d.phone?'<a class="btn" href="tel:'+esc(tel(d.phone))+'">📞 '+esc(d.phone)+'</a>':'')+'<button class="btn pri" type="button" data-ask="">Request information</button></div>';
    var hl=hoursLines(d.hours), today=DAYS[new Date().getDay()], th=hl.filter(function(l){return l.toLowerCase().indexOf(today.slice(0,3).toLowerCase())===0;})[0];
    $('info').innerHTML=(where?'<span>📍 '+esc(where)+(a.street?' · <a href="https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(d.name+' '+where)+'" target="_blank" rel="noopener">Directions</a>':'')+'</span>':'')+
      (hl.length?(hl.length>1?'<details class="hours"><summary>🕘 '+esc(th?('Today — '+th.replace(/^[A-Za-z]+\s*:\s*/,'')):'Business hours')+'</summary><div class="hlist">'+hl.map(function(l){return '<div>'+esc(l)+'</div>';}).join('')+'</div></details>':'<span>🕘 '+esc(hl[0])+'</span>'):'')+
      (d.email?'<span>✉️ <a href="mailto:'+esc(d.email)+'">'+esc(d.email)+'</a></span>':'');
    $('foot').innerHTML='<b>'+esc(d.name)+'</b>'+(where?' · '+esc(where):'')+(d.phone?' · <a href="tel:'+esc(tel(d.phone))+'">'+esc(d.phone)+'</a>':'')+'<br>'+esc(D.price_note)+' Products shown are available to order through this dealer; availability is confirmed when you contact them. Online purchase is not available — call or send a request. Storefront provided through the HomeCare Provider Services 360 Dealer Portal.';
    $('sform').addEventListener('submit',function(e){e.preventDefault();F.q=$('sq').value;F.shown=48;if(!PREVIEW&&location.hash&&location.hash!=='#') location.hash=''; else listing();});
  }
  function catTiles(){
    if(isNew()){ $('cats').innerHTML=''; return; }
    var cats={}; FAM.forEach(function(f){ var c=cats[f.cat]||(cats[f.cat]={n:0,img:null}); c.n++; if(!c.img&&f.lead.image) c.img=f.lead.image; });
    var names=Object.keys(cats).sort(function(a,b){return cats[b].n-cats[a].n||a.localeCompare(b);});
    if(names.length<2){ $('cats').innerHTML=''; return; }
    var one=count(F.cats)===1?Object.keys(F.cats).filter(function(k){return F.cats[k];})[0]:'';
    $('cats').innerHTML='<div class="wrap">'+names.map(function(c){return '<button type="button" class="cat'+(one===c?' on':'')+'" data-cat="'+esc(c)+'" aria-pressed="'+(one===c)+'"><span class="ci">'+img(cats[c].img,'')+'</span><b>'+esc(c)+'</b><small>'+cats[c].n+' product'+(cats[c].n===1?'':'s')+'</small></button>';}).join('')+'</div>';
  }

  /* ---------- listing ---------- */
  function priceHtml(f){
    if(f.min==null) return '<div class="price call">Call for Price</div>';
    var p=f.ps.filter(function(x){return x.price===f.min;})[0]; var tag=p.price_label==='MSRP'?'MSRP':'';
    var units={}; f.ps.forEach(function(x){ if(x.price!=null) units[x.price_unit||'']=1; }); var mixed=Object.keys(units).length>1;   /* a family mixing per-pack and each prices names no unit on the card */
    var unit=p.price_unit&&!mixed?(tag?' ':'')+esc(p.price_unit):'';
    var from=(f.min!==f.max||!f.allPriced)?'<span class="from">From</span>':'';
    return '<div class="price">'+from+money(f.min)+(tag||unit?'<small>'+tag+unit+'</small>':'')+'</div>'; }
  function optWord(f){ var n=f.ps.length; if(n<2) return ''; var sized=f.ps.every(function(p){return p.attributes&&p.attributes.Size;}); return n+' '+(sized?'sizes':'options'); }
  function card(f){
    var href='#product/'+encodeURIComponent(f.key);
    return '<article class="card"><a class="im" href="'+href+'" tabindex="-1" aria-hidden="true">'+img(f.lead.image,f.name)+'</a><div class="bd"><div class="mf">'+esc(lineName(f.mfr))+'</div>'+
      '<a class="nm" href="'+href+'">'+esc(f.name)+'</a>'+(optWord(f)?'<div class="opts">'+esc(optWord(f))+'</div>':'')+
      (f.feats.length?'<ul class="ben">'+f.feats.slice(0,3).map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul>':'')+priceHtml(f)+
      '<div class="cact"><a class="btn" href="'+href+'">View details</a><button class="btn" type="button" data-askf="'+esc(f.key)+'">Ask about it</button></div></div></article>'; }
  function facet(title,id,items,sel,skip){ if(items.length<2&&!count(sel)) return '';
    return '<div class="fg"><h3>'+esc(title)+'</h3>'+items.map(function(it){ return '<label><input type="checkbox" data-f="'+id+'" value="'+esc(it[0])+'"'+(sel[it[0]]?' checked':'')+'> '+esc(it[1])+'<span class="n">'+it[2]+'</span></label>'; }).join('')+'</div>'; }
  function facetCounts(skip,keyFn){ var m={}; FAM.forEach(function(f){ if(!pass(f,skip)) return; keyFn(f).forEach(function(k){ m[k]=(m[k]||0)+1; }); }); return m; }
  function buckets(skip,vals,B){ var m={}; FAM.forEach(function(f){ if(!pass(f,skip)) return; B.forEach(function(b){ if(vals(f).some(function(v){return v>=b[1]&&v<=b[2];})) m[b[0]]=(m[b[0]]||0)+1; }); }); return B.filter(function(b){return m[b[0]];}).map(function(b){return [b[0],b[0],m[b[0]]];}); }
  function filtersHtml(){
    var mc=facetCounts('mfr',function(f){return [f.mfr];}), cc=facetCounts('cat',function(f){return [f.cat];}), tc=facetCounts('feat',function(f){return Object.keys(f.tags);});
    var tags=Object.keys(tc).sort(); if(tags.length>14) tags=tags.filter(function(t){return tc[t]>1;}).slice(0,14);
    return '<div class="fclose"><b>Filters</b><button class="btn" type="button" data-fclose="1">Done</button></div>'+
      '<div class="fg"><h3>Search these results</h3><input type="search" id="fq" value="'+esc(F.q)+'" placeholder="Name or keyword" aria-label="Search these results"></div>'+
      facet('Category','cats',Object.keys(cc).sort().map(function(c){return [c,c,cc[c]];}),F.cats)+
      facet('Manufacturer','mfrs',Object.keys(mc).sort(function(a,b){return lineName(a).localeCompare(lineName(b));}).map(function(m){return [m,lineName(m),mc[m]];}),F.mfrs)+
      (FAM.some(function(f){return f.min!=null;})?'<div class="fg"><h3>Price</h3><div class="range"><input type="number" id="pmin" min="0" inputmode="numeric" placeholder="$ Min" aria-label="Minimum price" value="'+esc(F.min)+'"><span>–</span><input type="number" id="pmax" min="0" inputmode="numeric" placeholder="$ Max" aria-label="Maximum price" value="'+esc(F.max)+'"></div></div>':'')+
      facet('Weight capacity (lb)','cap',buckets('cap',function(f){return f.caps;},CAPB),F.cap)+
      facet('Seat width','seat',buckets('seat',function(f){return f.seats;},SEATB),F.seat)+
      facet('Type & features','feat',tags.map(function(t){return [t,t.replace(/^[^:]+:\s*/,'')+' ('+t.split(':')[0].toLowerCase()+')',tc[t]];}),F.feat)+
      '<div class="fg"><button class="btn" type="button" data-clear="1" style="width:100%">Clear all filters</button></div>'; }
  function activeChips(){ var c=[];
    Object.keys(F.cats).forEach(function(k){ if(F.cats[k]) c.push(['cats',k,k]); }); Object.keys(F.mfrs).forEach(function(k){ if(F.mfrs[k]) c.push(['mfrs',k,lineName(k)]); });
    ['cap','seat','feat'].forEach(function(g){ Object.keys(F[g]).forEach(function(k){ if(F[g][k]) c.push([g,k,k]); }); });
    if(F.q) c.push(['q','', '“'+F.q+'”']); if(F.min) c.push(['min','','From $'+F.min]); if(F.max) c.push(['max','','Up to $'+F.max]);
    return c.length?'<div class="chips">'+c.map(function(x){return '<button type="button" class="chip" data-rm="'+esc(x[0])+'" data-v="'+esc(x[1])+'" aria-label="Remove filter '+esc(x[2])+'">'+esc(x[2])+' ✕</button>';}).join('')+'</div>':''; }
  function listing(){
    if(!D) return; catTiles(); var drawer=!!($('filters')&&$('filters').classList.contains('on'));
    var L=results(), one=count(F.cats)===1?Object.keys(F.cats).filter(function(k){return F.cats[k];})[0]:'', d=D.dealer;
    var nf=count(F.cats)+count(F.mfrs)+count(F.cap)+count(F.seat)+count(F.feat)+(F.min?1:0)+(F.max?1:0);
    var home=!one&&!nf&&!F.q;
    $('main').innerHTML=(isNew()?(home?homeHtml():''):(d.about&&home?'<div class="intro">'+esc(d.about)+'</div>':''))+
      '<div class="crumbs"><a href="#" data-home="1">Home</a> › '+(one?esc(one):'All products')+'</div>'+
      '<div class="layout" id="results"><aside class="filters" id="filters" aria-label="Filters">'+filtersHtml()+'</aside><section aria-live="polite">'+
      '<div class="res-head"><h2>'+(one?esc(one):'All products')+'</h2><span class="count">'+L.length+' product'+(L.length===1?'':'s')+'</span>'+
      '<button class="btn fbtn" type="button" data-fopen="1">Filters'+(nf?' ('+nf+')':'')+'</button>'+
      '<label class="sr" for="sort" style="position:absolute;left:-9999px">Sort by</label><select id="sort"><option value="name"'+(F.sort==='name'?' selected':'')+'>Name A–Z</option><option value="plh"'+(F.sort==='plh'?' selected':'')+'>Price: low to high</option><option value="phl"'+(F.sort==='phl'?' selected':'')+'>Price: high to low</option></select>'+
      '<div class="vt" role="group" aria-label="View"><button type="button" data-view="grid" aria-pressed="'+(F.view==='grid')+'" aria-label="Grid view">▦</button><button type="button" data-view="list" aria-pressed="'+(F.view==='list')+'" aria-label="List view">☰</button></div></div>'+
      activeChips()+
      (L.length?'<div class="grid'+(F.view==='list'?' list':'')+'">'+L.slice(0,F.shown).map(card).join('')+'</div>'+(L.length>F.shown?'<div class="more"><button class="btn" type="button" data-more="1">Show more ('+(L.length-F.shown)+')</button></div>':'')
        :'<div class="empty">No products match these filters. <button class="btn" type="button" data-clear="1">Clear filters</button></div>')+
      '<div class="note">'+esc(D.price_note)+'</div></section></div>';
    if(drawer) $('filters').classList.add('on');
    wireFilters();
  }
  function wireFilters(){
    var fq=$('fq'); if(fq) fq.addEventListener('change',function(){F.q=this.value;F.shown=48;listing();});
    ['pmin','pmax'].forEach(function(id){ var e=$(id); if(e) e.addEventListener('change',function(){ F[id==='pmin'?'min':'max']=this.value.replace(/[^0-9.]/g,''); F.shown=48; listing(); }); });
    var so=$('sort'); if(so) so.addEventListener('change',function(){F.sort=this.value;listing();});
  }

  /* ---------- home (Professional / Modern / Classic): hero, dealership card, category grid, highlights, introduction ----------
     Only the dealer's own saved words and real catalog photos — nothing is invented about the business. */
  function heroImage(){ var L=catList(); for(var i=0;i<L.length;i++){ var c=L[i]; var f=FAM.filter(function(x){return x.cat===c.name&&x.lead.image;})[0]; if(f) return {img:f.lead.image,cat:c.name,name:f.name}; } return null; }
  function firstSentence(t){ var s=String(t||'').replace(/\s+/g,' ').trim(); var m=s.match(/^(.{20,220}?[.!?])(\s|$)/); return m?m[1]:(s.length>220?s.slice(0,217).replace(/\s+\S*$/,'')+'…':s); }
  function homeHtml(){
    var d=D.dealer, w=where(), hl=hoursLines(d.hours), th=todayLine(hl), hi=heroImage(), cats=catList(), N=cats.length, lim=CATSHOW?N:Math.min(N,(Number(DS.cat_cols)||4)*2);
    var head=d.headline||('Home medical equipment from '+d.name);
    var sub=d.about?firstSentence(d.about):'Browse the products we carry and ask us about anything you see.';
    var hero='<section class="heroban" aria-label="Welcome"><div class="ht"><h2>'+esc(head)+'</h2><p>'+esc(sub)+'</p><div class="hb"><button class="btn pri" type="button" data-browse="1">Browse our products</button>'+
      (d.phone?'<a class="btn ghost" href="tel:'+esc(tel(d.phone))+'">'+ico('phone')+' Call '+esc(d.phone)+'</a>':'<button class="btn ghost" type="button" data-ask="">Request information</button>')+'</div></div>'+
      (hi?'<div class="hi"><img src="'+esc(hi.img)+'" alt="'+esc(hi.name)+'" data-ph="1"></div><a class="hcap" href="#category/'+encodeURIComponent(hi.cat)+'" data-catlink="'+esc(hi.cat)+'">View '+esc(hi.cat)+' →</a>':'')+'</section>';
    var card='<aside class="infocard" aria-label="Visit or call"><h3>'+esc(d.name)+'</h3>'+
      (w?'<div class="row">'+ico('pin')+'<div>'+esc(w)+(d.address&&d.address.street?'<br><a href="'+esc(mapsUrl())+'" target="_blank" rel="noopener">Get directions</a>':'')+'</div></div>':'')+
      (hl.length?'<div class="row">'+ico('clock')+'<div>'+(hl.length>1?(th?'<b>Today:</b> '+esc(th.replace(/^[A-Za-z]+\s*:\s*/,'')):'<b>Business hours</b>')+'<details><summary>Hours this week</summary><div class="hl2">'+hl.map(function(l){return '<div>'+esc(l)+'</div>';}).join('')+'</div></details>':esc(hl[0]))+'</div></div>':'')+
      (d.phone?'<div class="row">'+ico('phone')+'<a class="big" href="tel:'+esc(tel(d.phone))+'">'+esc(d.phone)+'</a></div>':'')+
      (d.email?'<div class="row">'+ico('mail')+'<a href="mailto:'+esc(d.email)+'">'+esc(d.email)+'</a></div>':'')+'</aside>';
    var grid=N?'<section aria-label="Shop by category"><div class="secth"><h2>Shop by category</h2>'+(N>lim||CATSHOW?'<button type="button" data-catall="1">'+(CATSHOW?'Show fewer categories':'View all categories ('+N+')')+' →</button>':'<button type="button" data-all="1">View all products →</button>')+'</div>'+
      '<div class="cgrid" style="margin-top:12px">'+cats.slice(0,lim).map(function(c){return '<button type="button" class="ccard" data-cat="'+esc(c.name)+'"><span class="ci">'+img(c.img,'')+'</span><span><b>'+esc(c.name)+'</b><small>'+c.n+' product'+(c.n===1?'':'s')+'</small></span><span class="chev">'+ico('chev')+'</span></button>';}).join('')+'</div></section>':'';
    var hls=(DS.highlights||[]).length?'<section class="hls" aria-label="Why customers choose us">'+DS.highlights.map(function(h){return '<div>'+ico('check')+esc(h.text)+'</div>';}).join('')+'</section>':'';
    var about=d.about?'<section class="aboutc" id="about" aria-label="About us"><div><h2>About '+esc(d.name)+'</h2><p>'+esc(d.about)+'</p></div><div class="acts">'+
      (d.phone?'<a class="btn brand" href="tel:'+esc(tel(d.phone))+'">'+ico('phone')+' Call '+esc(d.phone)+'</a>':'')+(d.address&&d.address.street?'<a class="btn" href="'+esc(mapsUrl())+'" target="_blank" rel="noopener">'+ico('pin')+' Visit our showroom</a>':'')+
      '<button class="btn pri" type="button" data-ask="">Request information</button></div></section>':'';
    var order=DS.layout==='classic'?[hero,hls,grid,about]:DS.layout==='modern'?[hero,grid,hls,about]:['<div class="hero">'+hero+card+'</div>',grid,hls,about];
    return '<div class="home">'+order.join('')+'</div>';
  }

  /* ---------- product page ---------- */
  function optLabel(f,p){ var a=p.attributes||{}; if(a.Size) return a.Size; var n=p.name.replace(f.name,'').replace(/^[\s\-–—,(]+|[\s)]+$/g,''); return n||('#'+p.code); }
  function pdp(key,code){
    var f=Object.prototype.hasOwnProperty.call(BYKEY,key)?BYKEY[key]:null; if(!f){ if(PREVIEW) listing(); else location.hash=''; return; }
    var p=f.ps.filter(function(x){return x.code===code;})[0]||f.ps[0]; view(p); catTiles();
    var d=D.dealer, gal=[]; (p.gallery&&p.gallery.length?p.gallery:[p.image]).concat(f.ps.map(function(x){return x.image;})).forEach(function(u){ if(u&&gal.indexOf(u)<0) gal.push(u); });
    var at=Object.keys(p.attributes||{}), a=d.address||{}, where=[a.street,a.city,[a.state,a.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    var feats=(p.features&&p.features.length?p.features:f.feats).slice(0,8);
    var rel=FAM.filter(function(x){return x!==f&&x.cat===f.cat;}).slice(0,4);
    var pr=p.price!=null?'<div class="price" style="font-size:26px">'+money(p.price)+(p.price_label==='MSRP'||p.price_unit?'<small>'+(p.price_label==='MSRP'?'MSRP':'')+(p.price_unit?' '+esc(p.price_unit):'')+'</small>':'')+'</div>':'<div class="price call" style="font-size:20px">Call for Price</div>';
    $('main').innerHTML='<div class="crumbs"><a href="#" data-home="1">Home</a> › <a href="#category/'+encodeURIComponent(f.cat)+'">'+esc(f.cat)+'</a> › '+esc(f.name)+'</div>'+
      '<a class="back" href="#category/'+encodeURIComponent(f.cat)+'">← Back to '+esc(f.cat)+'</a>'+
      '<article class="pdp" data-k="'+esc(key)+'"><div class="pdp-top"><div class="gal"><div class="main" id="gmain">'+img(gal[0],f.name)+'</div>'+(gal.length>1?'<div class="thumbs">'+gal.slice(0,8).map(function(u,i){return '<button type="button" data-g="'+esc(u)+'" aria-pressed="'+(i===0)+'" aria-label="Photo '+(i+1)+'">'+img(u,'')+'</button>';}).join('')+'</div>':'')+'</div>'+
      '<div><div class="mf">'+esc(lineName(f.mfr))+(p.code?' · Item #'+esc(p.code):'')+'</div><h2>'+esc(f.name)+'</h2>'+pr+
      (f.ps.length>1?'<div style="margin-top:12px;font-weight:700">'+(f.ps.every(function(x){return x.attributes&&x.attributes.Size;})?'Size':'Options')+'</div><div class="optrow" role="group" aria-label="Options">'+f.ps.map(function(x){return '<button type="button" data-opt="'+esc(x.code)+'" aria-pressed="'+(x===p)+'">'+esc(optLabel(f,x))+'</button>';}).join('')+'</div>':'')+
      (p.description?'<p class="lead">'+esc(p.description)+'</p>':'')+
      '<div class="acts" style="margin-top:14px">'+(d.phone?'<a class="btn" href="tel:'+esc(tel(d.phone))+'">📞 Call '+esc(d.phone)+'</a>':'')+'<button class="btn pri" type="button" data-ask="'+p._i+'">Request information</button></div>'+
      '<div class="stocknote">Ask '+esc(d.name)+' about availability and delivery — products are ordered for you through the dealer.</div></div></div>'+
      (feats.length?'<h3>What it does for you</h3><ul class="feats">'+feats.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul>':'')+
      (at.length?'<h3>Specifications</h3><table class="attrs">'+at.map(function(k){return '<tr><td>'+esc(k)+'</td><td>'+esc(p.attributes[k])+'</td></tr>';}).join('')+'</table>':'')+
      ((p.documents||[]).length?'<h3>Product documents</h3><div class="docs">'+p.documents.map(function(x){return '<a href="'+esc(x.url)+'" target="_blank" rel="noopener">📄 '+esc(x.title)+'</a>';}).join('<br>')+'</div>':'')+
      '<div class="contact"><b>'+esc(d.name)+'</b>'+(where?'<br>'+esc(where):'')+(d.phone?'<br><a href="tel:'+esc(tel(d.phone))+'">'+esc(d.phone)+'</a>':'')+(d.hours?'<br>'+esc(hoursLines(d.hours).join(' · ')):'')+'</div></article>'+
      (rel.length?'<h3>More in '+esc(f.cat)+'</h3><div class="related grid">'+rel.map(card).join('')+'</div>':'')+'<div class="note">'+esc(D.price_note)+'</div>';
    document.title=f.name+' — '+d.name; window.scrollTo(0,0);
    var h=$('main').querySelector('h2'); if(h){ h.setAttribute('tabindex','-1'); h.focus({preventScroll:true}); }
  }

  /* ---------- routing: #category/<name>, #product/<key>[/<code>] — shareable, and Back works ---------- */
  function route(){
    if(!D) return; header();
    var h=''; try{ h=decodeURIComponent(location.hash.replace(/^#/,'')); }catch(x){ h=''; }   /* a malformed link shows the catalog */
    var m=h.match(/^product\/(.+?)(?:\/\/(.+))?$/);
    if(m&&Object.prototype.hasOwnProperty.call(BYKEY,m[1])) { pdp(m[1],m[2]); return; }
    var c=h.match(/^category\/(.+)$/); if(c){ F.cats={}; F.cats[c[1]]=true; F.shown=48; }
    document.title=D.dealer.name+' — Storefront'; listing();
  }
  if(!PREVIEW) window.addEventListener('hashchange',route);

  /* ---------- analytics (anonymous) ---------- */
  function view(p){ if(PREVIEW) return; var k=p.manufacturer+'|'+p.code; if(SEEN[k]) return; SEEN[k]=1; VIEWQ.push({manufacturer:p.manufacturer,code:p.code}); if(VIEWQ.length>=10) flush(); }
  function flush(){ if(!VIEWQ.length) return; var items=VIEWQ.splice(0,40);
    try{ fetch(API,{method:'POST',keepalive:true,headers:{'content-type':'text/plain'},body:JSON.stringify({action:'view',s:slug,items:items})}).catch(function(){}); }catch(e){} }
  setInterval(flush,8000); addEventListener('pagehide',flush);

  /* ---------- request information ---------- */
  var RETURN=null;
  function focusables(){ return [].slice.call($('dlg').querySelectorAll('button:not([disabled]),a[href],input:not([tabindex="-1"]),textarea,select')).filter(function(x){return x.offsetParent!==null;}); }
  function open(html,label){ if(!$('ov').classList.contains('on')) RETURN=document.activeElement;
    $('dlg').innerHTML='<button class="x" type="button" aria-label="Close" data-close="1">×</button>'+html; $('ov').setAttribute('aria-label',label||'Request information'); $('ov').classList.add('on');
    var f=$('dlg').querySelector('h2'); if(f){ f.setAttribute('tabindex','-1'); f.focus(); } else $('dlg').focus(); }
  function close(){ if(!$('ov').classList.contains('on')) return; $('ov').classList.remove('on'); $('dlg').innerHTML=''; if(RETURN&&RETURN.focus&&document.contains(RETURN)) RETURN.focus(); RETURN=null; }
  /* p = the exact SKU (product page, or a one-option card) · about = a family name when no option was chosen: the request
     then names no SKU (review #70: never a size the visitor did not pick) and the message starts with the product's name */
  function ask(p,about){
    open('<h2 style="margin:0 0 4px">Request information</h2><div style="color:var(--ink2)">'+(p?'About: <b>'+esc(p.name)+'</b>'+(p.code?' (#'+esc(p.code)+')':''):about?'About: <b>'+esc(about)+'</b>':'Send a message to '+esc(D.dealer.name))+'</div>'+
      '<form id="f" novalidate><label>Your name<input name="name" maxlength="120" autocomplete="name" required></label><label>Email<input name="email" type="email" maxlength="200" autocomplete="email"></label>'+
      '<label>Phone<input name="phone" type="tel" maxlength="40" autocomplete="tel"></label><label>Message<textarea name="message" rows="4" maxlength="2000">'+(about?esc('I would like information about the '+about+'.'):'')+'</textarea></label>'+
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
        if(j&&j.ok){ $('dlg').innerHTML='<button class="x" type="button" aria-label="Close" data-close="1">×</button><h2>Thank you</h2><p class="ok">Your request was sent to '+esc(D.dealer.name)+'.</p><p>They will contact you soon.'+(D.dealer.phone?' To talk now, call <a href="tel:'+esc(tel(D.dealer.phone))+'">'+esc(D.dealer.phone)+'</a>.':'')+'</p>'; return; }
        b.disabled=false; $('ferr').textContent=(j&&j.error)||'Your request could not be sent — please call the dealer.';
      }).catch(function(){ b.disabled=false; $('ferr').textContent='Your request could not be sent — please call the dealer.'; });
    });
  }

  /* ---------- events ---------- */
  function setHash(h){ if(PREVIEW){ var m=h.match(/^#product\/(.+)$/); if(m){ var k=decodeURIComponent(m[1]).split('//'); pdp(k[0],k[1]); } else { var c=h.match(/^#category\/(.+)$/); if(c){F.cats={};F.cats[decodeURIComponent(c[1])]=true;} listing(); } return; } location.hash=h; }
  document.addEventListener('click',function(e){
    var t=e.target.closest?e.target:null; if(!t) return;
    if(t.closest('[data-close]')||t.id==='ov'){ close(); return; }
    var a=t.closest('a[href^="#"]'); if(a&&PREVIEW){ e.preventDefault(); var hh=a.getAttribute('href'); if(hh==='#'){F.cats={};listing();} else setHash(hh); return; }
    if(t.closest('#catbtn')){ var dd=$('catdrop'), on=!dd.classList.contains('on'); dd.classList.toggle('on',on); $('catbtn').setAttribute('aria-expanded',String(on)); if(on){ var f1=dd.querySelector('a'); if(f1) f1.focus(); } return; }
    var cl=t.closest('[data-catlink]'); if(cl){ e.preventDefault(); var cn=cl.getAttribute('data-catlink'); var dd2=$('catdrop'); if(dd2){ dd2.classList.remove('on'); $('catbtn').setAttribute('aria-expanded','false'); } F.cats={}; F.cats[cn]=true; F.shown=48; if(!PREVIEW) location.hash='category/'+encodeURIComponent(cn); else listing(); window.scrollTo(0,0); return; }
    if(t.closest('[data-catall]')){ CATSHOW=!CATSHOW; listing(); return; }
    if(t.closest('[data-browse]')){ toResults(); return; }
    if(t.closest('[data-about]')){ e.preventDefault(); var ab=$('about'); if(!ab){ F.q='';F.cats={};F.mfrs={};F.min='';F.max='';F.cap={};F.seat={};F.feat={}; if(!PREVIEW&&location.hash&&location.hash!=='#'){ location.hash=''; setTimeout(function(){ var a2=$('about'); if(a2) a2.scrollIntoView(); },60); return; } listing(); ab=$('about'); } if(ab) ab.scrollIntoView({behavior:'smooth'}); return; }
    if(t.closest('[data-all]')){ e.preventDefault(); F.q='';F.cats={};F.mfrs={};F.min='';F.max='';F.cap={};F.seat={};F.feat={};F.shown=48; var sq2=$('sq'); if(sq2) sq2.value=''; if(!PREVIEW&&location.hash&&location.hash!=='#'){ location.hash=''; setTimeout(toResults,60); } else { listing(); toResults(); } return; }
    if(!t.closest('#catdrop')&&$('catdrop')&&$('catdrop').classList.contains('on')){ $('catdrop').classList.remove('on'); $('catbtn').setAttribute('aria-expanded','false'); }
    if(t.closest('[data-home]')){ e.preventDefault(); F.q='';F.cats={};F.mfrs={};F.min='';F.max='';F.cap={};F.seat={};F.feat={};F.shown=48; var sq=$('sq'); if(sq) sq.value=''; if(PREVIEW||!location.hash||location.hash==='#') listing(); else location.hash=''; return; }
    var c=t.closest('[data-cat]'); if(c){ var name=c.getAttribute('data-cat'); var on=F.cats[name]&&count(F.cats)===1; F.cats={}; if(!on) F.cats[name]=true; F.shown=48; if(!PREVIEW&&(location.hash.indexOf('#product/')===0||(isNew()&&!on))) location.hash=on?'':'category/'+encodeURIComponent(name); else listing(); if(isNew()) window.scrollTo(0,0); return; }
    var o=t.closest('[data-opt]'); if(o){ var key=decodeURIComponent(location.hash.replace(/^#product\//,'')).split('//')[0]; var cur=PREVIEW?(o.closest('.pdp')&&o.closest('.pdp').getAttribute('data-k')):key; setHash('#product/'+encodeURIComponent((cur||key)+'//'+o.getAttribute('data-opt'))); return; }
    var g=t.closest('[data-g]'); if(g){ $('gmain').innerHTML=img(g.getAttribute('data-g'),''); [].forEach.call(document.querySelectorAll('[data-g]'),function(b){b.setAttribute('aria-pressed',String(b===g));}); return; }
    var af=t.closest('[data-askf]'); if(af){ var ff=BYKEY[af.getAttribute('data-askf')]; if(ff) ask(ff.ps.length===1?ff.ps[0]:null, ff.ps.length>1?ff.name:null); return; }
    var ak=t.closest('[data-ask]'); if(ak){ var i=ak.getAttribute('data-ask'); ask(i===''?null:D.products[+i]); return; }
    var cb=t.closest('input[data-f]'); if(cb){ F[cb.getAttribute('data-f')][cb.value]=cb.checked; F.shown=48; listing(); return; }
    var rm=t.closest('[data-rm]'); if(rm){ var g2=rm.getAttribute('data-rm'), v=rm.getAttribute('data-v'); if(g2==='q') F.q=''; else if(g2==='min') F.min=''; else if(g2==='max') F.max=''; else F[g2][v]=false; listing(); return; }
    if(t.closest('[data-clear]')){ F.q='';F.cats={};F.mfrs={};F.min='';F.max='';F.cap={};F.seat={};F.feat={};F.shown=48; listing(); return; }
    if(t.closest('[data-more]')){ F.shown+=48; listing(); return; }
    var vw=t.closest('[data-view]'); if(vw){ F.view=vw.getAttribute('data-view'); listing(); return; }
    if(t.closest('[data-fopen]')){ $('filters').classList.add('on'); var first=$('filters').querySelector('button,input'); if(first) first.focus(); return; }
    if(t.closest('[data-fclose]')){ $('filters').classList.remove('on'); return; }
  });
  addEventListener('keydown',function(e){
    if(e.key==='Escape'){ if($('catdrop')&&$('catdrop').classList.contains('on')){ $('catdrop').classList.remove('on'); $('catbtn').setAttribute('aria-expanded','false'); $('catbtn').focus(); return; } if($('filters')&&$('filters').classList.contains('on')) $('filters').classList.remove('on'); close(); return; }
    if(e.key==='Tab'&&$('ov').classList.contains('on')){ var f=focusables(); if(!f.length) return; var first=f[0], last=f[f.length-1];
      if(e.shiftKey&&(document.activeElement===first||!$('dlg').contains(document.activeElement))){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey&&document.activeElement===last){ e.preventDefault(); first.focus(); } }
  });
  load();
})();
