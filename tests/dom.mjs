import { parseHTML, Event } from './vendor/linkedom.mjs';
import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const dir = new URL('../', import.meta.url),
  read = (n) => fs.readFileSync(new URL(n, dir), 'utf8'),
  delay = (ms) => new Promise((r) => setTimeout(r, ms));
let checks = 0;
function environment(seed, options = {}) {
  const { window, document } = parseHTML(read('index.html')),
    memory = new Map(seed ? [['mii-ratsion.v1', JSON.stringify(seed)]] : []),
    calls = [];
  const dialog = document.querySelector('dialog');
  dialog.showModal = () => (dialog.open = true);
  dialog.close = () => (dialog.open = false);
  window.scrollTo = () => {};
  window.HTMLInputElement.prototype.select = () => {};
  class FD {
    constructor(form) {
      this.data = new Map();
      for (const el of form.querySelectorAll('[name]')) {
        if (el.disabled) continue;
        const n = el.getAttribute('name');
        if (['radio', 'checkbox'].includes(el.type)) {
          if (el.checked) this.data.set(n, el.value || 'on');
        } else if (el.localName === 'select') {
          const o = el.querySelector('option[selected]') || el.querySelector('option');
          this.data.set(n, o?.getAttribute('value') || '');
        } else this.data.set(n, el.value);
      }
    }
    get(n) {
      return this.data.get(n) ?? null;
    }
    has(n) {
      return this.data.has(n);
    }
  }
  window.RationAPI = {
    ready: Promise.resolve(true),
    delay: () => 5,
    hasProxy: () => true,
    search: async (q, lang, signal) => {
      calls.push(q);
      await delay(q === 'slow' ? 60 : 5);
      return {
        foods: [
          {
            id: 'remote-' + q,
            names: [q, q, q],
            kcal: 123,
            p: 5,
            f: 3,
            c: 17,
            source: 'off',
            emoji: '📦',
            category: 'other'
          }
        ]
      };
    },
    barcode: async () => null
  };
  const context = vm.createContext({
    window,
    document,
    localStorage: {
      getItem: (k) => {
        if (options.denied) throw Error('denied');
        return memory.get(k) || null;
      },
      setItem: (k, v) => {
        if (options.denied || options.quota) throw Error('quota');
        memory.set(k, v);
      }
    },
    location: { protocol: 'file:' },
    navigator: { onLine: true },
    setTimeout,
    clearTimeout,
    console,
    structuredClone,
    FormData: FD,
    crypto: { randomUUID },
    URL,
    Blob,
    AbortController,
    AbortSignal
  });
  for (const f of [
    'data.js',
    'strings.js',
    'catalog.js',
    'product-assets.js',
    'product-photos.js',
    'core.js',
    'search.js',
    'nutrition.js',
    'providers.js',
    'storage.js',
    'app.js'
  ])
    vm.runInContext(read(f), context, { filename: f });
  const q = (s) => document.querySelector(s),
    all = (s) => [...document.querySelectorAll(s)],
    stored = () => JSON.parse(memory.get('mii-ratsion.v1'));
  const click = (s) => {
    assert(q(s), 'Missing ' + s);
    q(s).dispatchEvent(new Event('click', { bubbles: true }));
  };
  const set = (s, v) => {
    assert(q(s), 'Missing ' + s);
    q(s).value = String(v);
  };
  const input = (s, v) => {
    set(s, v);
    q(s).dispatchEvent(new Event('input', { bubbles: true }));
  };
  const submit = async (s) => {
    q(s).reportValidity = () => true;
    q(s).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await delay(10);
  };
  return { window, document, memory, calls, q, all, click, set, input, submit, stored };
}
const test = (name, fn) => {
  fn();
  checks++;
  console.log('PASS ' + name);
};
let a = environment();
test('Setup has birth year and no profile name field', () => {
  assert(a.q('[name=birthYear]'));
  assert(!a.q('[name=name]'));
  assert(!a.q('[name=age]'));
});
a.set('[name=birthYear]', new Date().getFullYear() - 16);
a.q('[name=goal][value=maintain]').checked = true;
await a.submit('#setup-form');
test('Single setup saves year and computes targets', () => {
  assert.equal(a.stored().profile.birthYear, new Date().getFullYear() - 16);
  assert(a.stored().targets.kcal > 0);
});
test('Diary has five meal groups', () => assert.equal(a.all('.meal-card').length, 5));
a.click('[data-action=add-food][data-meal="2"]');
a.click('#add-results [data-action=portion]');
a.set('#portion-grams', 150);
await a.submit('#portion-form');
test('Adding to lunch retains selected meal', () =>
  assert.equal(Object.values(a.stored().days)[0].entries[0].meal, 2));
a.click('[data-action=water][data-value="250"]');
const before = JSON.stringify(a.stored().days);
a.click('.topbar-right [data-action=nav][data-page=settings]');
test('Gear opens settings without restarting setup or losing data', () => {
  assert(a.q('#edit-profile-form'));
  assert(!a.q('.onboarding'));
  assert.equal(JSON.stringify(a.stored().days), before);
});
a.set('#edit-profile-form [name=weight]', 67);
a.q('#edit-profile-form [name=goal][value=maintain]').checked = true;
await a.submit('#edit-profile-form');
test('Saving profile preserves every diary record', () => {
  assert.equal(JSON.stringify(a.stored().days), before);
  assert.equal(a.stored().profile.weight, 67);
});
a.set('#targets-form [name=kcal]', 2100);
await a.submit('#targets-form');
a.set('#edit-profile-form [name=weight]', 68);
a.q('#edit-profile-form [name=goal][value=maintain]').checked = true;
await a.submit('#edit-profile-form');
test('Profile edits preserve custom calorie targets', () =>
  assert.equal(a.stored().targets.kcal, 2100));
test('No introductory or change-anytime filler is rendered', () => {
  assert(!a.document.body.textContent.includes('Мету можна змінити'));
  assert(!a.document.body.textContent.includes('маленьких кроків'));
});
a.click('[data-action=nav][data-page=foods]');
test('Large catalog uses bounded rendering', () => {
  assert.equal(a.all('.food-row').length, 40);
  assert(a.document.body.textContent.includes('8'));
});
a.input('#catalog-search', 'банн');
await delay(35);
test('Fuzzy local results appear', () =>
  assert(a.all('.food-row strong').some((n) => n.textContent === 'Банан')));
test('Remote search runs automatically without a button', () => {
  assert.deepEqual(a.calls, ['банн']);
  assert(!a.q('[data-action=online-search]'));
  assert(a.q('[data-id="remote-банн"]'));
});
a.input('#catalog-search', 'abc');
a.input('#catalog-search', 'abcd');
a.input('#catalog-search', 'abcde');
await delay(40);
test('Fast typing sends only the final debounced query', () =>
  assert.deepEqual(a.calls, ['банн', 'abcde']));
a.input('#catalog-search', 'slow');
await delay(12);
a.input('#catalog-search', 'fast');
await delay(90);
test('A stale response cannot overwrite the latest query', () => {
  assert(a.q('[data-id="remote-fast"]'));
  assert(!a.q('[data-id="remote-slow"]'));
});
a.input('#catalog-search', 'банан');
await delay(35);
a.click('.food-row [data-action=favorite]');
test('Favorite is saved', () => assert.equal(a.stored().favorites.length, 1));
a.click('[data-action=create-food]');
a.set('[name=name]', 'Test custom');
for (const [k, v] of Object.entries({ kcal: 100, p: 5, f: 2, c: 15 })) a.set('[name=' + k + ']', v);
await a.submit('#custom-food-form');
test('Custom food opens portion form', () => assert(a.q('#portion-form')));
a.click('[data-action=preset][data-grams="200"]');
test('Portion presets set the weight', () => assert.equal(a.q('#portion-grams').value, '200'));
await a.submit('#portion-form');
a.click('[data-action=nav][data-page=diary]');
a.click('[data-action=edit-entry]');
a.set('#portion-grams', 175);
await a.submit('#portion-form');
test('Editing changes the original entry without duplication', () =>
  assert.equal(Object.values(a.stored().days)[0].entries.length, 2));
a.click('[data-action=delete-entry]');
test('Deletion supports immediate undo', () => {
  assert.equal(Object.values(a.stored().days)[0].entries.length, 1);
  assert(a.q('[data-action=undo]'));
});
a.click('[data-action=undo]');
test('Undo restores entry', () =>
  assert.equal(Object.values(a.stored().days)[0].entries.length, 2));
a.click('[data-action=nav][data-page=insights]');
test('Progress renders seven real days', () => assert.equal(a.all('.bar-column').length, 7));
a.click('[data-action=log-weight]');
a.set('[name=value]', 64.5);
await a.submit('#weight-form');
test('Weight logging persists', () => assert.equal(a.stored().weights[0].value, 64.5));
a.click('[data-action=nav][data-page=settings]');
Object.defineProperty(a.q('#language'), 'value', { value: 'en' });
a.q('#language').dispatchEvent(new Event('change', { bubbles: true }));
test('English is applied', () => assert.equal(a.document.documentElement.lang, 'en'));
Object.defineProperty(a.q('#language'), 'value', { value: 'ru' });
a.q('#language').dispatchEvent(new Event('change', { bubbles: true }));
test('Russian is applied', () => assert.equal(a.document.documentElement.lang, 'ru'));
test('Final state validates', () => assert(a.window.RationCore.validState(a.stored())));
a.click('[data-action=nav][data-page=foods]');
a.input('#catalog-search', 'Milka Oreo');
await delay(45);
a.click('[data-action=portion][data-id="off-7622210834751"]');
test('Milka uses the real bundled product photograph', () =>
  assert(a.q('.photo-hero img').getAttribute('src').includes('milka-7622210834751.jpg')));
test('Product card has three daily contribution circles and grouped additional circles', () => {
  assert.equal(a.all('#portion-nutrition .portion-macros .metric').length, 3);
  assert(a.q('.composition-detail'));
  assert(!a.q('.composition-donut'));
  assert.equal(a.all('.product-extras .metric').length, 4);
});
test('Product sugar, salt and saturates are present', () => {
  assert(
    a.q('#portion-nutrition [data-nutrient=sugars] .metric-amount').textContent.includes('50')
  );
  assert(
    a.q('#portion-nutrition [data-nutrient=salt] .metric-amount').textContent.includes('0,45')
  );
  assert(
    a.q('#portion-nutrition [data-nutrient=saturatedFat] .metric-amount').textContent.includes('19')
  );
});
a.input('#portion-grams', '25');
test('Changing portion recalculates additional nutrients', () =>
  assert(
    a.q('#portion-nutrition [data-nutrient=sugars] .metric-amount').textContent.includes('12,5')
  ));
a.input('#portion-grams', '250');
test('Exceeding saturated fat reference changes its colour to red', () =>
  assert(a.q('#portion-nutrition [data-nutrient=saturatedFat]').classList.contains('tone-red')));
test('Rendered nutrition contains no invalid numeric values', () =>
  assert(!/NaN|undefined|Infinity/.test(a.q('#portion-nutrition').textContent)));
a.click('[data-action=close-modal]');
a.click('[data-action=nav][data-page=settings]');
a.set('[name="extra-salt"]', 4.5);
await a.submit('#targets-form');
test('Additional daily references save without losing diary', () => {
  assert.equal(a.stored().extraTargets.salt, 4.5);
  assert.equal(Object.values(a.stored().days)[0].entries.length, 2);
});
a.click('[data-action=nav][data-page=diary]');
a.click('[data-action=edit-entry]');
test('Editing does not double-count the original meal in projection', () => {
  const total = a.window.RationCore.total(Object.values(a.stored().days)[0].entries).kcal;
  assert(
    a.q('.day-projection strong').textContent.startsWith(Math.round(total).toLocaleString('ru-RU'))
  );
});
a.click('[data-action=close-modal]');
a.click('[data-action=nav][data-page=foods]');
a.input('#catalog-search', 'hydrate');
await delay(45);
a.window.RationAPI.details = async () => {
  await delay(35);
  return { imageUrl: 'https://images.openfoodfacts.org/images/test.jpg', sugars: 7, salt: 0.3 };
};
a.click('[data-action=portion][data-id="remote-hydrate"]');
a.input('#portion-grams', '75');
await delay(70);
test('Detail hydration preserves entered weight and fills missing nutrients', () => {
  assert.equal(a.q('#portion-grams').value, '75');
  assert(
    a.q('#portion-nutrition [data-nutrient=sugars] .metric-amount').textContent.includes('5,3')
  );
});
a.click('[data-action=close-modal]');
a.input('#catalog-search', 'latehydrate');
await delay(45);
a.click('[data-action=portion][data-id="remote-latehydrate"]');
a.click('[data-action=close-modal]');
a.input('#catalog-search', 'Milka Oreo');
await delay(45);
a.click('[data-action=portion][data-id="off-7622210834751"]');
await delay(70);
test('A closed card cannot overwrite another product after hydration', () =>
  assert(a.q('.product-heading-copy h3').textContent.includes('Milka')));
a.click('[data-action=close-modal]');
const reload = environment(a.stored());
test('Reload keeps records and skips onboarding', () => {
  assert(!reload.q('.onboarding'));
  assert.equal(Object.values(reload.stored().days)[0].entries.length, 2);
});
const seed = a.stored();
seed.version = 1;
seed.profile = {
  name: 'OLD',
  age: 16,
  sex: 'male',
  weight: 70,
  height: 180,
  activity: 1,
  goal: 'maintain',
  special: false
};
const legacy = environment(seed);
test('Legacy state migrates without name and retains diary', () => {
  assert.equal(legacy.stored().version, 2);
  assert(!('name' in legacy.stored().profile));
  assert.equal(Object.values(legacy.stored().days)[0].entries.length, 2);
});
const waterEnv = environment(a.stored());
waterEnv.click('[data-action=scan]');
waterEnv.set('#barcode-input', '4820051240233');
await waterEnv.submit('#barcode-form');
test('Known water opens missing-label form with blank macros', () => {
  assert(waterEnv.q('#complete-food-form'));
  for (const k of ['kcal', 'p', 'f', 'c']) assert.equal(waterEnv.q('[name=' + k + ']').value, '');
  assert(waterEnv.q('.photo-hero img'));
});
await waterEnv.submit('#complete-food-form');
test('Blank label cannot save fake zero nutrition', () =>
  assert(waterEnv.q('#complete-food-form')));
waterEnv.click('[data-action=plain-water]');
await waterEnv.submit('#complete-food-form');
test('Explicit plain-water confirmation creates a valid local record', () => {
  assert(waterEnv.q('#portion-form'));
  const f = waterEnv.stored().customFoods.find((f) => f.barcode === '4820051240233');
  assert(f);
  assert.equal(f.kcal, 0);
  assert.equal(f.salt, undefined);
  assert(waterEnv.window.RationCore.validState(waterEnv.stored()));
});
await waterEnv.submit('#portion-form');
const recalledWater = environment(waterEnv.stored());
recalledWater.window.RationAPI.barcode = async () => {
  throw Error('offline');
};
recalledWater.click('[data-action=scan]');
recalledWater.set('#barcode-input', '04820051240233');
await recalledWater.submit('#barcode-form');
test('Saved barcode is recalled offline after reload with GTIN padding', () =>
  assert(recalledWater.q('#portion-form')));
const unknown = environment(a.stored());
unknown.click('[data-action=scan]');
unknown.set('#barcode-input', '12345670');
await unknown.submit('#barcode-form');
test('Absent barcode opens manual label entry retaining the code', () => {
  assert(unknown.q('#complete-food-form'));
  assert.equal(unknown.q('[name=name]').value, '');
  assert.equal(unknown.q('[name=kcal]').value, '');
});
unknown.set('[name=name]', 'My bottle');
for (const [k, v] of Object.entries({ kcal: 10, p: 0, f: 0, c: 2.5 }))
  unknown.set('[name=' + k + ']', v);
await unknown.submit('#complete-food-form');
test('Manual barcode label persists correct values', () => {
  const f = unknown.stored().customFoods.find((f) => f.barcode === '12345670');
  assert.equal(f.kcal, 10);
  assert.equal(f.c, 2.5);
  assert(unknown.q('#portion-form'));
});
test('Daily additional circles are inside summary under macros', () => {
  const d = environment(waterEnv.stored());
  assert(d.q('.summary .daily-extras .extra-circle-grid'));
  assert(!d.q('.right-column .daily-extras'));
});
const limitSeed = structuredClone(a.stored());
const limitDate = Object.keys(limitSeed.days)[0];
const limitEntry = limitSeed.days[limitDate].entries[0];
limitSeed.days[limitDate].entries = Array.from({ length: 500 }, (_, i) => ({
  ...structuredClone(limitEntry),
  id: 'limit-' + i
}));
const limitUI = environment(limitSeed);
limitUI.click('[data-action=edit-entry]');
limitUI.set('#portion-grams', '125');
await limitUI.submit('#portion-form');
test('Editing a full 500-entry day remains possible', () => {
  assert.equal(limitUI.stored().days[limitDate].entries.length, 500);
  assert.equal(limitUI.stored().days[limitDate].entries.at(-1).grams, 125);
});
limitUI.click('[data-action=edit-entry]');
limitUI.set('#portion-grams', '0.01');
await limitUI.submit('#portion-form');
test('Too-small portions cannot corrupt saved state', () => {
  assert(limitUI.q('#portion-form'));
  assert(limitUI.window.RationCore.validState(limitUI.stored()));
});
const invalidWeightUI = environment(a.stored());
invalidWeightUI.click('[data-action=nav][data-page=insights]');
invalidWeightUI.click('[data-action=log-weight]');
invalidWeightUI.set('[name=value]', 'invalid');
const weightBefore = JSON.stringify(invalidWeightUI.stored().weights);
await invalidWeightUI.submit('#weight-form');
test('Nonfinite weight is rejected before saving', () =>
  assert.equal(JSON.stringify(invalidWeightUI.stored().weights), weightBefore));
const deniedUI = environment(null, { denied: true });
test('Denied browser storage still renders onboarding', () => assert(deniedUI.q('#setup-form')));
const quotaUI = environment(a.stored(), { quota: true });
const quotaBefore = JSON.stringify(quotaUI.stored());
quotaUI.click('[data-action=water][data-value="250"]');
test('Failed writes retain old data and show an error', () => {
  assert.equal(JSON.stringify(quotaUI.stored()), quotaBefore);
  assert(quotaUI.q('.offline-banner'));
  assert(quotaUI.q('#toast').classList.contains('error'));
});
console.log(checks + ' DOM scenarios passed.');
