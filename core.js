(function (root) {
  'use strict';
  const factors = [1.2, 1.375, 1.55, 1.725, 1.9];
  const finite = (n, min = 0, max = 100000) =>
    typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  function dateKey(d = new Date()) {
    const x = new Date(d);
    return [
      x.getFullYear(),
      String(x.getMonth() + 1).padStart(2, '0'),
      String(x.getDate()).padStart(2, '0')
    ].join('-');
  }
  function validDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s + 'T12:00:00');
    return !isNaN(d) && dateKey(d) === s;
  }
  function calculate(p) {
    if (!validProfile(p)) throw Error('Invalid profile');
    if (p.special)
      return { kcal: null, p: null, f: null, c: null, mode: 'none', bmr: null, tdee: null };
    const age = Math.max(18, new Date().getFullYear() - p.birthYear),
      bmr = 10 * p.weight + 6.25 * p.height - 5 * age + (p.sex === 'male' ? 5 : -161),
      tdee = bmr * factors[p.activity];
    if (bmr <= 0)
      return { kcal: null, p: null, f: null, c: null, mode: 'none', bmr: null, tdee: null };
    const lowBMI = p.weight / (p.height / 100) ** 2 < 18.5,
      goal = p.goal === 'lose' && lowBMI ? 'maintain' : p.goal;
    const kcal =
      Math.round(Math.max(bmr, tdee * (goal === 'lose' ? 0.85 : goal === 'gain' ? 1.1 : 1)) / 10) *
      10;
    return {
      kcal,
      p: Math.round((kcal * 0.25) / 4),
      f: Math.round((kcal * 0.3) / 9),
      c: Math.round((kcal * 0.45) / 4),
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      mode: 'auto',
      lowBMI: p.goal === 'lose' && lowBMI
    };
  }
  function validProfile(p) {
    const y = new Date().getFullYear();
    return (
      p &&
      Number.isInteger(p.birthYear) &&
      finite(p.birthYear, y - 110, y - 1) &&
      finite(p.weight, 20, 350) &&
      finite(p.height, 80, 230) &&
      ['female', 'male'].includes(p.sex) &&
      Number.isInteger(p.activity) &&
      p.activity >= 0 &&
      p.activity <= 4 &&
      ['lose', 'maintain', 'gain'].includes(p.goal) &&
      typeof p.special === 'boolean'
    );
  }
  function validFood(f) {
    return (
      f &&
      typeof f.id === 'string' &&
      f.id.length < 150 &&
      Array.isArray(f.names) &&
      f.names.length === 3 &&
      f.names.every((x) => typeof x === 'string' && x.length > 0 && x.length <= 200) &&
      finite(f.kcal, 0, 1000) &&
      ['p', 'f', 'c'].every((k) => finite(f[k], 0, 100)) &&
      ['reference', 'custom', 'off', 'tablycja', 'usda', 'import'].includes(f.source) &&
      typeof f.emoji === 'string' &&
      f.emoji.length < 20 &&
      typeof f.category === 'string' &&
      f.category.length < 40 &&
      (!f.brand || (typeof f.brand === 'string' && f.brand.length < 200)) &&
      (!f.sourceUrl ||
        (typeof f.sourceUrl === 'string' &&
          /^https:\/\//.test(f.sourceUrl) &&
          f.sourceUrl.length < 1000))
    );
  }
  function validState(s) {
    if (
      !s ||
      s.version !== 2 ||
      !['uk', 'ru', 'en'].includes(s.lang) ||
      !(s.profile === null || validProfile(s.profile)) ||
      !s.targets ||
      !['kcal', 'p', 'f', 'c'].every(
        (k) => s.targets[k] === null || finite(s.targets[k], 0, k === 'kcal' ? 10000 : 1000)
      ) ||
      !s.settings ||
      !finite(s.settings.waterGoal, 0, 10000) ||
      typeof s.settings.reduceMotion !== 'boolean' ||
      typeof s.settings.compact !== 'boolean'
    )
      return false;
    if (
      !Array.isArray(s.customFoods) ||
      s.customFoods.length > 20000 ||
      !s.customFoods.every(validFood) ||
      !Array.isArray(s.favorites) ||
      s.favorites.length > 30000 ||
      !s.favorites.every((x) => typeof x === 'string')
    )
      return false;
    if (
      !s.days ||
      typeof s.days !== 'object' ||
      Array.isArray(s.days) ||
      Object.keys(s.days).length > 20000
    )
      return false;
    if (
      !Object.entries(s.days).every(
        ([key, day]) =>
          validDate(key) &&
          day &&
          Array.isArray(day.entries) &&
          day.entries.length <= 500 &&
          day.entries.every(
            (e) =>
              e &&
              typeof e.id === 'string' &&
              validFood(e.food) &&
              finite(e.grams, 0.1, 10000) &&
              Number.isInteger(e.meal) &&
              e.meal >= 0 &&
              e.meal <= 4
          ) &&
          Array.isArray(day.water) &&
          day.water.length <= 100 &&
          day.water.every((x) => finite(x, 1, 2000))
      )
    )
      return false;
    return (
      Array.isArray(s.weights) &&
      s.weights.length < 20000 &&
      s.weights.every((w) => validDate(w.date) && finite(w.value, 20, 350))
    );
  }
  function defaults() {
    return {
      version: 2,
      lang: 'uk',
      profile: null,
      targets: { kcal: null, p: null, f: null, c: null, mode: 'none' },
      settings: { waterGoal: 2000, reduceMotion: false, compact: true },
      days: {},
      customFoods: [],
      favorites: [],
      weights: []
    };
  }
  function migrate(input) {
    const s = JSON.parse(JSON.stringify(input));
    if (s.version === 1) {
      if (s.profile) {
        if (!Number.isInteger(s.profile.age) || !finite(s.profile.age, 1, 110))
          throw Error('Invalid profile');
        const { name, age, ...rest } = s.profile;
        s.profile = { ...rest, birthYear: new Date().getFullYear() - age };
      }
      s.version = 2;
      if (s.profile && s.targets?.mode === 'none' && !s.profile.special)
        s.targets = calculate(s.profile);
    }
    if (!validState(s)) throw Error('Invalid backup');
    return s;
  }
  function total(entries = []) {
    return entries.reduce(
      (a, e) => {
        for (const k of ['kcal', 'p', 'f', 'c']) a[k] += (e.food[k] * e.grams) / 100;
        return a;
      },
      { kcal: 0, p: 0, f: 0, c: 0 }
    );
  }
  function normalize(s) {
    return String(s)
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ё/g, 'е')
      .replace(/[іїй]/g, 'и')
      .replace(/є/g, 'е')
      .replace(/ґ/g, 'г')
      .replace(/[^a-zа-я0-9]+/g, ' ')
      .trim();
  }
  function distance(a, b) {
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const row = [i];
      for (let j = 1; j <= b.length; j++)
        row[j] = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + (a[i - 1] !== b[j - 1]));
      prev = row;
    }
    return prev[b.length];
  }
  function search(foods, q) {
    const query = normalize(q);
    if (!query) return foods;
    const aliases = {
      oats: 'овсянка вівсянка каша',
      chicken: 'курка курица',
      cottage: 'творог сир',
      buckwheat: 'гречка',
      potato: 'картошка картопля',
      tomato: 'томат помидор',
      yogurt: 'йогурт'
    };
    return foods
      .map((food) => {
        let text = food.names.join(' ') + ' ' + (food.brand || '');
        for (const [k, v] of Object.entries(aliases))
          if (text.toLowerCase().includes(k)) text += ' ' + v;
        const n = normalize(text),
          words = n.split(' ');
        let score = 0;
        for (const token of query.split(' ')) {
          if (n.includes(token)) {
            score += token.length + 5;
            continue;
          }
          let best = Infinity;
          for (const word of words) {
            if (Math.abs(word.length - token.length) <= 2)
              best = Math.min(best, distance(token, word));
          }
          if (best > (token.length >= 6 ? 2 : token.length >= 3 ? 1 : 0)) return null;
          score += 3 - best;
        }
        return { food, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.food);
  }
  root.RationCore = {
    dateKey,
    validDate,
    calculate,
    validProfile,
    validFood,
    validState,
    defaults,
    migrate,
    total,
    normalize,
    search,
    distance
  };
  if (typeof module !== 'undefined') module.exports = root.RationCore;
})(typeof window === 'undefined' ? globalThis : window);
