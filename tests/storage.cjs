const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../core.js');
require('../nutrition.js');
const source = fs.readFileSync(path.resolve(__dirname, '../storage.js'), 'utf8');
function storage(backend) {
  const window = { RationCore: C };
  vm.runInNewContext(source, { window, localStorage: backend });
  return window.RationStorage;
}
const denied = storage({
  getItem() {
    throw Error('denied');
  },
  setItem() {
    throw Error('denied');
  }
});
assert.equal(denied.load().error, true);
assert.equal(denied.save(C.defaults()), false);
console.log('PASS Denied storage cannot crash startup or pretend to save');
const memory = new Map([['mii-ratsion.v1', '{broken backup']]);
const local = storage({
  getItem: (key) => memory.get(key),
  setItem: (key, value) => memory.set(key, value)
});
const loaded = local.load();
assert.equal(loaded.recovery, '{broken backup');
assert(local.save(loaded.state, loaded.recovery));
assert.equal(memory.get('mii-ratsion.v1.recovery'), '{broken backup');
console.log('PASS Corrupt original is preserved before replacement');
const before = memory.get('mii-ratsion.v1');
assert.equal(local.save({ ...C.defaults(), weights: [{ date: '2026-11-15', value: NaN }] }), false);
assert.equal(memory.get('mii-ratsion.v1'), before);
console.log('PASS Invalid state cannot overwrite the saved diary');
const quota = storage({
  getItem: () => before,
  setItem() {
    throw Error('quota');
  }
});
assert.equal(quota.load().error, false);
assert.equal(quota.save(C.defaults()), false);
console.log('PASS Storage quota is reported as a failed save');
