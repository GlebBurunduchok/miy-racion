/* Portions, recipe arithmetic, calendar streaks and reporting. No DOM or network. */
(function (root) {
  'use strict';
  const C = root.RationCore,
    N = root.RationNutrition;
  const finite = (n, min = 0, max = 100000) =>
    typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  const shiftDate = (date, offset) => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + offset);
    return C.dateKey(d);
  };
  const basis = (food) => (food.basis === 'ml' ? 'ml' : 'g');
  function unitFactor(food, unit, size) {
    const base = basis(food),
      m = food.measure || {};
    if (unit === base) return 1;
    if (unit === 'piece' || unit === 'package') {
      const value = size ?? m[unit];
      return finite(value, 0.01, 10000) ? value : null;
    }
    if (unit === 'ml' || unit === 'g') {
      const density = size ?? m.density;
      if (!finite(density, 0.01, 20)) return null;
      return base === 'g' ? density : 1 / density;
    }
    return null;
  }
  function portion(food, amount, unit = basis(food), size) {
    const factor = unitFactor(food, unit, size),
      value = amount * factor;
    if (!finite(amount, 0.001, 10000) || factor === null || !finite(value, 0.1, 10000))
      throw Error('Invalid portion');
    const updated = { ...food, measure: { ...food.measure } };
    if (unit !== basis(food) && size != null) {
      updated.measure[unit === 'g' || unit === 'ml' ? 'density' : unit] = size;
      updated.personalized = true;
    }
    return { food: updated, grams: value, amount, unit };
  }
  function recipeNutrition(ingredients, yieldAmount) {
    if (
      !Array.isArray(ingredients) ||
      !ingredients.length ||
      ingredients.length > 100 ||
      !finite(yieldAmount, 1, 100000)
    )
      throw Error('Invalid recipe');
    const totals = {};
    for (const key of [
      'kcal',
      'p',
      'f',
      'c',
      ...N.extras,
      'calcium',
      'iron',
      'potassium',
      'vitaminC'
    ]) {
      let total = 0,
        complete = true;
      for (const item of ingredients) {
        if (
          !C.validFood(item.food) ||
          item.food.kind === 'recipe' ||
          !finite(item.grams, 0.1, 10000)
        )
          throw Error('Invalid ingredient');
        if (N.known(item.food[key])) total += (item.food[key] * item.grams) / 100;
        else complete = false;
      }
      if (complete) totals[key] = (total * 100) / yieldAmount;
    }
    return totals;
  }
  function activityDays(state, today = C.dateKey()) {
    return Object.keys(state.days)
      .filter(
        (date) =>
          C.validDate(date) &&
          date <= today &&
          state.days[date].entries.some((entry) => !entry.loggedOn || entry.loggedOn === date)
      )
      .sort();
  }
  function streak(state, today = C.dateKey()) {
    const dates = activityDays(state, today),
      set = new Set(dates),
      lit = set.has(today),
      yesterday = shiftDate(today, -1);
    let count = 0,
      cursor = lit ? today : yesterday;
    while (set.has(cursor)) {
      count++;
      cursor = shiftDate(cursor, -1);
    }
    let best = 0,
      run = 0,
      last = null;
    for (const date of dates) {
      run = last && shiftDate(last, 1) === date ? run + 1 : 1;
      best = Math.max(best, run);
      last = date;
    }
    return { count, lit, best, today, last: dates.at(-1) || null, pending: !lit && count > 0 };
  }
  function streakTransition(before, after) {
    if (!before) return null;
    if (after.lit && (!before.lit || after.count > before.count)) return 'ignite';
    if (before.count > 0 && after.count === 0) return 'lost';
    if (before.lit && !after.lit) return 'cool';
    return null;
  }
  function recentMeals(state, date, meal, limit = 7) {
    return Object.keys(state.days)
      .filter((key) => key < date)
      .sort()
      .reverse()
      .map((key) => ({
        date: key,
        entries: state.days[key].entries.filter((e) => e.meal === meal)
      }))
      .filter((row) => row.entries.length)
      .slice(0, limit);
  }
  function report(state, length = 7, end = C.dateKey()) {
    if (![7, 30].includes(length) || !C.validDate(end)) throw Error('Invalid range');
    const days = Array.from({ length }, (_, i) => {
      const date = shiftDate(end, i - length + 1),
        entries = state.days[date]?.entries || [];
      return { date, count: entries.length, total: C.total(entries) };
    });
    const logged = days.filter((day) => day.count > 0),
      average = { kcal: 0, p: 0, f: 0, c: 0 };
    for (const key of Object.keys(average))
      average[key] = logged.length
        ? logged.reduce((sum, day) => sum + day.total[key], 0) / logged.length
        : null;
    const weights = state.weights
      .filter((w) => w.date >= days[0].date && w.date <= end)
      .sort((a, b) => a.date.localeCompare(b.date));
    return {
      days,
      logged: logged.length,
      average,
      weights,
      change: weights.length > 1 ? weights.at(-1).value - weights[0].value : null
    };
  }
  const previousFood = C.validFood;
  C.validFood = (food) =>
    previousFood(food) &&
    (!food.basis || ['g', 'ml'].includes(food.basis)) &&
    (!food.photoId || /^photo-[a-zA-Z0-9-]{1,100}$/.test(food.photoId)) &&
    (!food.measure ||
      (typeof food.measure === 'object' &&
        !Array.isArray(food.measure) &&
        Object.entries(food.measure).every(
          ([key, value]) =>
            ['density', 'piece', 'package'].includes(key) &&
            finite(value, 0.01, key === 'density' ? 20 : 10000)
        ))) &&
    (!food.kind || (food.kind === 'recipe' && !!food.recipe)) &&
    (!food.recipe ||
      (food.kind === 'recipe' &&
        finite(food.recipe.yieldAmount, 1, 100000) &&
        Array.isArray(food.recipe.ingredients) &&
        food.recipe.ingredients.length > 0 &&
        food.recipe.ingredients.length <= 100 &&
        food.recipe.ingredients.every(
          (item) =>
            item &&
            item.food?.kind !== 'recipe' &&
            C.validFood(item.food) &&
            finite(item.grams, 0.1, 10000)
        )));
  const previousState = C.validState;
  C.validPhoto = (data) =>
    typeof data === 'string' &&
    data.length <= 120000 &&
    /^data:image\/jpeg;base64,[a-zA-Z0-9+/]+=*$/.test(data);
  C.validState = (state) =>
    previousState(state) &&
    (!state.photos ||
      (typeof state.photos === 'object' &&
        !Array.isArray(state.photos) &&
        Object.keys(state.photos).length <= 64 &&
        Object.entries(state.photos).every(
          ([key, value]) => /^photo-[a-zA-Z0-9-]{1,100}$/.test(key) && C.validPhoto(value)
        ) &&
        Object.values(state.photos).reduce((sum, value) => sum + value.length, 0) <= 3000000)) &&
    Object.values(state.days).every((day) =>
      day.entries.every(
        (entry) =>
          (entry.loggedOn == null || C.validDate(entry.loggedOn)) &&
          (entry.unit == null || ['g', 'ml', 'piece', 'package'].includes(entry.unit)) &&
          (entry.amount == null || finite(entry.amount, 0.001, 10000))
      )
    );
  const previousDefaults = C.defaults,
    previousMigrate = C.migrate;
  C.defaults = () => ({ ...previousDefaults(), photos: {} });
  C.migrate = (input) => {
    const state = previousMigrate(input);
    state.photos ||= {};
    if (!C.validState(state)) throw Error('Invalid feature data');
    return state;
  };
  Object.assign(C, {
    basis,
    unitFactor,
    portion,
    recipeNutrition,
    shiftDate,
    activityDays,
    streak,
    streakTransition,
    recentMeals,
    report
  });
  if (typeof module !== 'undefined') module.exports = C;
})(typeof window === 'undefined' ? globalThis : window);
