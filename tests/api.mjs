import vm from 'node:vm';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url),
  C = require('../core.js');
require('../nutrition.js');
const P = require('../providers.js');
const code = await fs.readFile(new URL('../api.js', import.meta.url), 'utf8');
function env(fetch) {
  const window = {};
  vm.runInNewContext(code, {
    window,
    fetch,
    location: { protocol: 'file:' },
    RationCore: C,
    RationProviders: P,
    URLSearchParams,
    AbortSignal,
    setTimeout,
    Date
  });
  return window.RationAPI;
}
const missing = env(async () => ({
  ok: false,
  status: 404,
  text: async () => JSON.stringify({ status: 0, status_verbose: 'product not found' })
}));
assert.equal(await missing.barcode('12345670'), null);
console.log('PASS OFF HTTP 404 means absent barcode, not offline');
const calls = [],
  equivalent = env(async (url) => {
    calls.push(url);
    return calls.length === 1
      ? { ok: false, status: 404, text: async () => '{"status":0}' }
      : {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              status: 1,
              product: {
                code: '0012345678905',
                product_name: 'Test',
                nutriments: {
                  'energy-kcal_100g': 0,
                  proteins_100g: 0,
                  fat_100g: 0,
                  carbohydrates_100g: 0
                }
              }
            })
        };
  });
assert.equal((await equivalent.barcode('012345678905')).kcal, 0);
assert.equal(calls.length, 2);
assert(calls[1].includes('/0012345678905.json'));
console.log('PASS Leading-zero equivalent is tried after missing exact code');
const unavailable = env(async () => ({ ok: false, status: 503, text: async () => '{"status":0}' }));
await assert.rejects(unavailable.barcode('12345670'), /service:503/);
console.log('PASS Service outage remains distinct from absent product');
