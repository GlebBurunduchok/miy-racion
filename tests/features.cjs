const assert = require('node:assert/strict');
const C = require('../core.js');
require('../nutrition.js');
require('../features.js');
let count = 0;
const test = (label, fn) => {
  fn();
  count++;
  console.log('PASS ' + label);
};
const food = {
  id: 'test',
  names: ['Test', 'Test', 'Test'],
  kcal: 100,
  p: 5,
  f: 2,
  c: 15,
  sugars: 0,
  category: 'other',
  emoji: '🍽️',
  source: 'custom'
};
const entry = (loggedOn) => ({ id: 'e-' + loggedOn, food, grams: 100, meal: 0, loggedOn });
const day = (loggedOn) => ({ entries: [entry(loggedOn)], water: [] });
test('Piece and package sizes use explicit, remembered amounts', () => {
  const f = { ...food, measure: { piece: 125, package: 200 } };
  assert.equal(C.portion(f, 2, 'piece').grams, 250);
  assert.equal(C.portion(f, 0.5, 'package').grams, 100);
  assert.equal(C.portion(f, 3, 'piece', 100).food.measure.piece, 100);
  assert.equal(f.measure.piece, 125);
});
test('Volume needs a density instead of assuming one millilitre equals one gram', () => {
  assert.throws(() => C.portion(food, 250, 'ml'));
  assert.equal(C.portion(food, 250, 'ml', 1.03).grams, 257.5);
  assert.equal(
    C.portion({ ...food, basis: 'ml', measure: { density: 1.03 } }, 103, 'g').grams,
    100
  );
});
test('Invalid or tiny portions cannot enter the diary', () => {
  for (const amount of [NaN, -1, 0, 0.00001, 10001])
    assert.throws(() => C.portion(food, amount, 'g'));
  assert.throws(() => C.portion(food, 1, 'piece', 0));
});
test('Recipes use the cooked yield, not the uncooked sum', () => {
  const values = C.recipeNutrition([{ food, grams: 200 }], 400);
  assert.equal(values.kcal, 50);
  assert.equal(values.p, 2.5);
  assert.equal(values.sugars, 0);
  assert.equal(values.fiber, undefined);
});
test('A missing ingredient nutrient is not invented as zero', () => {
  const values = C.recipeNutrition(
    [
      { food: { ...food, fiber: 2 }, grams: 100 },
      { food, grams: 100 }
    ],
    200
  );
  assert.equal(values.fiber, undefined);
  assert.equal(values.sugars, 0);
});
test('Empty and nested recipes are rejected', () => {
  assert.throws(() => C.recipeNutrition([], 100));
  assert.throws(() => C.recipeNutrition([{ food: { ...food, kind: 'recipe' }, grams: 100 }], 100));
});
test('First log lights one day; the next day is pending until a log', () => {
  const state = C.defaults();
  state.days['2026-11-10'] = day('2026-11-10');
  assert.equal(C.streak(state, '2026-11-10').count, 1);
  assert.equal(C.streak(state, '2026-11-10').lit, true);
  assert.equal(C.streak(state, '2026-11-11').count, 1);
  assert.equal(C.streak(state, '2026-11-11').lit, false);
  state.days['2026-11-11'] = day('2026-11-11');
  assert.equal(C.streak(state, '2026-11-11').count, 2);
});
test('Missing a full day resets the count and the next log starts at one', () => {
  const state = C.defaults();
  state.days['2026-11-10'] = day('2026-11-10');
  state.days['2026-11-11'] = day('2026-11-11');
  assert.equal(C.streak(state, '2026-11-13').count, 0);
  state.days['2026-11-13'] = day('2026-11-13');
  assert.equal(C.streak(state, '2026-11-13').count, 1);
  assert.equal(C.streak(state, '2026-11-13').best, 2);
});
test('Backfilled, future and water-only days do not fake a daily streak', () => {
  const state = C.defaults();
  state.days['2026-11-10'] = day('2026-11-12');
  state.days['2026-11-13'] = day('2026-11-12');
  state.days['2026-11-12'] = { entries: [], water: [250] };
  assert.equal(C.streak(state, '2026-11-12').count, 0);
});
test('Multiple entries in one date count only once', () => {
  const state = C.defaults();
  state.days['2026-11-10'] = {
    entries: [entry('2026-11-10'), { ...entry('2026-11-10'), id: 'other' }],
    water: []
  };
  assert.equal(C.streak(state, '2026-11-10').count, 1);
  state.days['2026-11-10'].entries = [];
  assert.equal(C.streak(state, '2026-11-10').count, 0);
});
test('Legacy diary entries count without requiring a reset', () => {
  const state = C.defaults();
  state.days['2026-11-10'] = { entries: [{ id: 'old', food, grams: 100, meal: 0 }], water: [] };
  assert.equal(C.streak(state, '2026-11-11').count, 1);
});
test('Streak animations distinguish ignition, cooling and loss', () => {
  assert.equal(C.streakTransition({ count: 1, lit: false }, { count: 2, lit: true }), 'ignite');
  assert.equal(C.streakTransition({ count: 2, lit: true }, { count: 2, lit: false }), 'cool');
  assert.equal(C.streakTransition({ count: 2, lit: false }, { count: 0, lit: false }), 'lost');
  assert.equal(C.streakTransition({ count: 2, lit: true }, { count: 2, lit: true }), null);
});
test('Week and month averages include logged days, with real weight changes', () => {
  const state = C.defaults();
  state.days['2026-11-10'] = day('2026-11-10');
  state.days['2026-11-12'] = { entries: [{ ...entry('2026-11-12'), grams: 200 }], water: [] };
  state.weights = [
    { date: '2026-11-10', value: 70 },
    { date: '2026-11-12', value: 69.5 }
  ];
  const report = C.report(state, 7, '2026-11-12');
  assert.equal(report.days.length, 7);
  assert.equal(report.logged, 2);
  assert.equal(report.average.kcal, 150);
  assert.equal(report.change, -0.5);
  assert.equal(C.report(state, 30, '2026-11-12').days.length, 30);
});
test('Portion, recipe, photo and streak metadata survive a backup round trip', () => {
  const state = C.defaults(),
    data = 'data:image/jpeg;base64,/9j/2Q==';
  const recipe = {
    ...food,
    id: 'r',
    kind: 'recipe',
    recipe: { ingredients: [{ food, grams: 100 }], yieldAmount: 100, servings: 1 },
    measure: { piece: 100 },
    photoId: 'photo-test'
  };
  state.customFoods = [recipe];
  state.photos = { 'photo-test': data };
  state.days['2026-11-10'] = {
    entries: [{ ...entry('2026-11-10'), amount: 1, unit: 'piece' }],
    water: []
  };
  const restored = C.migrate(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.photos['photo-test'], data);
  assert.equal(restored.customFoods[0].recipe.yieldAmount, 100);
  assert(C.validState(restored));
});
test('Unsafe image data and invalid unit sizes are rejected', () => {
  assert(!C.validFood({ ...food, measure: { density: -1 } }));
  assert(!C.validFood({ ...food, photoId: '../escape' }));
  const state = C.defaults();
  state.photos = { 'photo-x': 'data:image/svg+xml,<script>' };
  assert(!C.validState(state));
});
test('Calendar arithmetic crosses month and daylight-saving boundaries', () => {
  assert.equal(C.shiftDate('2026-03-29', 1), '2026-03-30');
  assert.equal(C.shiftDate('2026-11-01', -1), '2026-10-31');
});
console.log(count + ' feature checks passed.');
