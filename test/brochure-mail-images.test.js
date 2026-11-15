'use strict';
/* A mailed brochure must not carry site-relative photos (they arrive broken in mail). */
const assert = require('assert');
const { absolutizeImages } = require('../netlify/functions/brochure.js');
const h = '<img src="/assets/products/ohio-medical/RS-00502-X-D.jpg" alt=""><img class="dlogo" src="https://x.supabase.co/a.png"><img src="//cdn.example/a.png"><img src="data:image/png;base64,AAAA"><a href="/assets/x">x</a>';
const out = absolutizeImages(h, 'https://hcpsonlineordering.netlify.app/');
assert.ok(out.includes('src="https://hcpsonlineordering.netlify.app/assets/products/ohio-medical/RS-00502-X-D.jpg"'));
assert.ok(out.includes('src="https://x.supabase.co/a.png"'), 'absolute untouched');
assert.ok(out.includes('src="//cdn.example/a.png"'), 'protocol-relative untouched');
assert.ok(out.includes('src="data:image/png;base64,AAAA"'), 'data URI untouched');
assert.ok(out.includes('<a href="/assets/x">'), 'only images change');
console.log('brochure-mail-images: ok');
