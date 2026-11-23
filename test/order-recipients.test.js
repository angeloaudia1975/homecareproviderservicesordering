'use strict';
/* Order email routing guard (owner 2026-11-23): only HCPS mailboxes; ORDER_TO can never add a manufacturer or outside address. */
const { _recipients: R } = require('../netlify/functions/submit-order.js');
let pass = 0, fail = 0; const t = (n, f) => { try { f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + e.message); } };
const eq = (a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b)); };
const O = 'orders@homecareproviderservices.us', A = 'angelo@homecareproviderservices.us';
const ee = console.error; console.error = () => {};
t('unset → default intake + owner', () => eq(R(undefined), [O, A]));
t('a manufacturer / outside address in ORDER_TO is dropped', () => { eq(R('orders@bemis.com'), [O, A]); eq(R('orders@homecareproviderservices.us, sales@ohiomedical.com'), [O, A]); });
t('lookalike domains are dropped (suffix and subdomain tricks)', () => { eq(R('x@homecareproviderservices.us.evil.com,y@evilhomecareproviderservices.us,z@sub.homecareproviderservices.us'), [O, A]); });
t('legitimate HCPS addresses are kept; owner always added once', () => { eq(R('lori@homecareproviderservices.us'), ['lori@homecareproviderservices.us', A]); eq(R('ANGELO@homecareproviderservices.us,' + O), [ 'ANGELO@homecareproviderservices.us', O ]); });
t('staff extras stay HCPS-only', () => eq(R([O, 'lori@homecareproviderservices.us'].join(',')), [O, 'lori@homecareproviderservices.us', A]));
console.error = ee;
console.log('\norder recipients: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
