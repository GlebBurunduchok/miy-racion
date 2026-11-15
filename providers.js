(function (root) {
  const C = root.RationCore;
  const nutrient = (value, max = 100) => {
    if (value == null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
  };
  function fromOFF(p) {
    if (!p || typeof p !== 'object' || !/^\d{8,14}$/.test(String(p.code || ''))) return null;
    const n = p.nutriments || {},
      names = [p.product_name_uk, p.product_name_ru, p.product_name_en],
      base =
        p.product_name ||
        names.find(Boolean) ||
        (Array.isArray(p.brands) ? p.brands.join(', ') : p.brands) ||
        'Product ' + p.code;
    let kcal = n['energy-kcal_100g'];
    if (kcal == null && n.energy_100g != null && n.energy_100g !== '')
      kcal = Number(n.energy_100g) / 4.184;
    if (!p.code) return null;
    const number = nutrient,
      categories = Array.isArray(p.categories_tags) ? p.categories_tags : [];
    const f = {
      id: 'off-' + p.code,
      names: names.map((x) => String(x || base).slice(0, 200)),
      brand: (Array.isArray(p.brands) ? p.brands.join(', ') : String(p.brands || '')).slice(0, 180),
      kcal: number(kcal, 1000),
      p: number(n.proteins_100g),
      f: number(n.fat_100g),
      c: number(n.carbohydrates_100g),
      category: categories.includes('en:waters') ? 'drink' : 'other',
      emoji: categories.includes('en:waters') ? '💧' : '📦',
      source: 'off',
      barcode: String(p.code),
      sourceUrl: 'https://world.openfoodfacts.org/product/' + encodeURIComponent(p.code)
    };
    if (p.nutrition_data_per === '100ml') f.basis = 'ml';
    const pack = String(p.quantity || '')
      .trim()
      .match(/^(\d+(?:[.,]\d+)?)\s*(kg|кг|g|г|ml|мл|l|л)\b/i);
    if (pack) {
      const amount =
          Number(pack[1].replace(',', '.')) * (/^(kg|кг|l|л)$/i.test(pack[2]) ? 1000 : 1),
        unit = /^(ml|мл|l|л)$/i.test(pack[2]) ? 'ml' : 'g';
      if (unit === (f.basis || 'g') && amount > 0 && amount <= 10000)
        f.measure = { package: amount };
    }
    f.nutritionIncomplete = ['kcal', 'p', 'f', 'c'].some((k) => f[k] === null);
    f.plainWaterCandidate =
      categories.includes('en:waters') &&
      !categories.some((c) => /flavou|sweetened|juice/.test(c)) &&
      !/лимон|lemon|flavou|смак|сахар|цукр/i.test(f.names.join(' '));
    for (const [k, field, mult] of [
      ['sugars', 'sugars', 1],
      ['salt', 'salt', 1],
      ['saturatedFat', 'saturated-fat', 1],
      ['fiber', 'fiber', 1],
      ['calcium', 'calcium', 1000],
      ['iron', 'iron', 1000],
      ['potassium', 'potassium', 1000],
      ['vitaminC', 'vitamin-c', 1000]
    ]) {
      const v = n[field + '_100g'];
      const parsed = nutrient(v, mult === 1000 ? 100 : 100);
      if (parsed !== null) f[k] = parsed * mult;
    }
    if (f.salt == null) {
      const sodium = nutrient(n.sodium_100g, 40);
      if (sodium !== null) f.salt = sodium * 2.5;
    }
    const front = p.selected_images?.front,
      pick = (obj) =>
        obj &&
        (obj.uk || obj.ru || obj.en || Object.values(obj).find((x) => typeof x === 'string'));
    const image = pick(front?.display) || p.image_front_url || p.image_url,
      thumb = pick(front?.small) || p.image_front_small_url || image;
    if (root.RationNutrition?.safeImage(image)) {
      f.imageUrl = image;
      f.imageSource = 'off';
    }
    if (root.RationNutrition?.safeImage(thumb)) f.thumbnailUrl = thumb;
    const grade = p.nutriscore_grade || p.nutrition_grades;
    if (/^[abcde]$/.test(grade)) f.nutriScore = grade;
    return C.validCatalogFood(f) ? f : null;
  }
  function fromTable(p) {
    if (!p || typeof p !== 'object' || !p.id || !String(p.title || '').trim()) return null;
    const n = String(p.title || '')
      .trim()
      .slice(0, 200);
    const f = {
      id: 'tab-' + p.id,
      names: [n, n, n],
      brand: String(p.brandName || '').slice(0, 180),
      kcal: nutrient(
        p.energy == null || p.energy === ''
          ? null
          : Number(p.energy) / (p.energyUnit === 'kJ' ? 4.184 : 1),
        1000
      ),
      p: nutrient(p.protein),
      f: nutrient(p.fat),
      c: nutrient(p.carbohydrate),
      category: 'other',
      emoji: '🍽️',
      source: 'tablycja',
      sourceUrl: 'https://www.tablycjakalorijnosti.com.ua/stravy/' + encodeURIComponent(p.url || '')
    };
    for (const [key, field] of [
      ['fiber', 'fiber'],
      ['sugars', 'sugar'],
      ['salt', 'salt'],
      ['saturatedFat', 'saturatedFattyAcid'],
      ['calcium', 'calcium']
    ]) {
      const parsed = nutrient(p[field], key === 'calcium' ? 100000 : 100);
      if (parsed !== null) f[key] = parsed;
    }
    const image = p.imageUrl || p.photoThumbGastroPartnerUrl;
    if (root.RationNutrition?.safeImage(image)) f.imageUrl = image;
    f.nutritionIncomplete = ['kcal', 'p', 'f', 'c'].some((k) => f[k] === null);
    return C.validCatalogFood(f) ? f : null;
  }
  function tableDetails(html) {
    const result = {};
    const tag = (html.match(/<meta[^>]+og:image[^>]*>/g) || [])[0],
      url = tag?.match(/content=["']([^"']+)["']/)?.[1]?.replace(/&amp;/g, '&');
    if (root.RationNutrition?.safeImage(url)) result.imageUrl = url;
    const labels = {
      цукор: 'sugars',
      сіль: 'salt',
      волокна: 'fiber',
      клітковина: 'fiber',
      'насичені жирні кислоти': 'saturatedFat',
      кальцій: 'calcium',
      залізо: 'iron',
      калій: 'potassium',
      'вітамін c': 'vitaminC'
    };
    for (const match of html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g
    )) {
      try {
        const json = JSON.parse(match[1]),
          rows = Array.isArray(json) ? json : [json];
        for (const data of rows)
          for (const kw of data.keywords || []) {
            if (typeof kw !== 'string') continue;
            const parts = kw.split(':'),
              key = labels[parts[0].trim().toLowerCase()];
            if (!key) continue;
            const value = parts
              .slice(1)
              .join(':')
              .match(/([0-9]+(?:[.,][0-9]+)?)\s*(мг|г)?/);
            if (!value) continue;
            let number = Number(value[1].replace(',', '.'));
            const mg = ['calcium', 'iron', 'potassium', 'vitaminC'].includes(key);
            if (mg && value[2] === 'г') number *= 1000;
            if (!mg && value[2] === 'мг') number /= 1000;
            if (number >= 0 && number <= (mg ? 100000 : 100)) result[key] = number;
          }
      } catch {}
    }
    return result;
  }
  root.RationProviders = { fromOFF, fromTable, tableDetails };
  if (typeof module !== 'undefined') module.exports = root.RationProviders;
})(typeof window === 'undefined' ? globalThis : window);
