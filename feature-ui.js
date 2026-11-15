/* Stateful editors and presentation for portions, recipes, reports and streaks. */
window.RationFeatureUI = function (env) {
  'use strict';
  const {
    state,
    context,
    setContext,
    date,
    t,
    fmt,
    name,
    esc,
    icon,
    action,
    photo,
    find,
    list,
    open,
    close,
    save,
    render,
    notify,
    uid,
    openSearch
  } = env;
  const C = window.RationCore,
    N = window.RationNutrition,
    $ = (s) => document.querySelector(s);
  let draft = null,
    picking = false,
    range = 7,
    pendingEffect = null,
    celebrationTimer;
  let previous = state().streakSeen ? { ...state().streakSeen } : C.streak(state());
  const unitLabel = (unit) =>
    t({ g: 'unitG', ml: 'unitMl', piece: 'unitPiece', package: 'unitPackage' }[unit] || 'unitG');
  const entryLabel = (entry) =>
    fmt(entry.amount ?? entry.grams, 1) + ' ' + unitLabel(entry.unit || C.basis(entry.food));
  const dayWord = (count) =>
    t(
      count % 10 === 1 && count % 100 !== 11
        ? 'streakDayOne'
        : [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)
          ? 'streakDayFew'
          : 'streakDayMany'
    );
  const flame = () =>
    '<svg class="flame" viewBox="0 0 32 40" aria-hidden="true"><path class="flame-outer" d="M18 1c3 10-5 12-2 19 3-2 5-5 5-9 8 8 13 17 7 24-5 7-17 7-23-1C-3 24 6 17 10 12c-1 7 0 9 2 10C8 12 17 9 18 1Z"/><path class="flame-inner" d="M17 23c2 4 7 5 6 10-1 6-11 6-12 0-1-4 3-6 6-10Z"/></svg>';
  function streakBadge() {
    const s = C.streak(state());
    return action(
      'streak-info',
      '',
      null,
      'streak-pill ' +
        (s.lit ? 'is-lit' : s.count ? 'is-pending' : 'is-off') +
        (pendingEffect ? ' ' + pendingEffect : ''),
      `aria-label="${esc(t('streak') + ': ' + s.count + ' ' + dayWord(s.count))}" title="${esc(t(s.lit ? 'streakActive' : s.count ? 'streakPending' : 'streakStart'))}"`
    ).replace('</button>', flame() + `<span>${s.count || '—'}</span></button>`);
  }
  function beforeRender() {
    const next = C.streak(state());
    pendingEffect = C.streakTransition(previous, next);
    previous = next;
  }
  function afterRender() {
    if (!pendingEffect) return;
    const effect = pendingEffect;
    pendingEffect = null;
    if (effect === 'cool') return;
    const current = C.streak(state());
    clearTimeout(celebrationTimer);
    $('#streak-celebration')?.remove();
    const box = document.createElement('div');
    box.id = 'streak-celebration';
    box.className = 'streak-celebration ' + effect;
    box.setAttribute('role', 'status');
    box.innerHTML = `<div class="celebration-flame">${flame()}<i></i><i></i><i></i></div><div><strong>${effect === 'lost' ? t('streakLost') : t(current.count === 1 ? 'streakIgnite' : 'streakContinued')}</strong><span>${effect === 'lost' ? t('streakFresh') : current.count + ' ' + dayWord(current.count)}</span></div>`;
    document.body.append(box);
    celebrationTimer = setTimeout(() => box.remove(), 3200);
  }
  function portionFields(food, entry, meal) {
    const unit = entry?.unit || C.basis(food),
      amount = entry?.amount ?? entry?.grams ?? 100;
    return `<div class="portion-input-row"><label>${t('quantity')}<div class="quantity-combo"><input id="portion-grams" name="grams" type="number" min=".001" max="10000" step="any" inputmode="decimal" value="${amount}" required><select id="portion-unit" name="unit" aria-label="${esc(t('portion'))}">${['g', 'ml', 'piece', 'package'].map((key) => `<option value="${key}" ${unit === key ? 'selected' : ''}>${unitLabel(key)}</option>`).join('')}</select></div></label><label class="meal-select-label">${t('meal')}<select name="meal">${Array.from({ length: 5 }, (_, i) => `<option value="${i}" ${i === (entry?.meal ?? meal) ? 'selected' : ''}>${t('meal' + i)}</option>`).join('')}</select></label></div><label class="calibration-field" id="portion-size-label" hidden><span id="portion-size-text"></span><input id="portion-size" name="unitSize" type="number" min=".01" max="10000" step="any" inputmode="decimal" disabled></label><p class="conversion-status" id="portion-conversion-status"></p><div class="portion-presets" id="portion-presets"></div>`;
  }
  function syncUnits(changed = false) {
    const ctx = context(),
      form = $('#portion-form');
    if (!form || ctx.type !== 'portion') return;
    const unit = $('#portion-unit').value,
      base = C.basis(ctx.food),
      field = $('#portion-size'),
      label = $('#portion-size-label'),
      calibrated = unit !== base,
      key = unit === 'g' || unit === 'ml' ? 'density' : unit;
    if (changed) {
      let oldBase = null;
      try {
        oldBase = C.portion(
          ctx.food,
          Number($('#portion-grams').value),
          form.dataset.unit || base,
          field.disabled ? undefined : Number(field.value)
        ).grams;
      } catch {}
      if (!field.disabled && field.value !== '' && Number(field.value) > 0) {
        const oldUnit = form.dataset.unit || base;
        ctx.food.measure = {
          ...ctx.food.measure,
          [oldUnit === 'g' || oldUnit === 'ml' ? 'density' : oldUnit]: Number(field.value)
        };
        ctx.food.personalized = true;
      }
      field.value = ctx.food.measure?.[key] ?? '';
      const factor = C.unitFactor(ctx.food, unit);
      $('#portion-grams').value =
        oldBase != null && factor
          ? String(Math.round((oldBase / factor) * 1000) / 1000)
          : unit === 'piece' || unit === 'package'
            ? '1'
            : '100';
    } else if (!form.dataset.unit) field.value = ctx.food.measure?.[key] ?? '';
    label.hidden = !calibrated;
    field.disabled = !calibrated;
    field.required = calibrated;
    field.max = key === 'density' ? '20' : '10000';
    $('#portion-size-text').textContent =
      key === 'density'
        ? t('density')
        : t(key === 'piece' ? 'pieceWeight' : 'packageWeight') + ' (' + unitLabel(base) + ')';
    form.dataset.unit = unit;
    const presets =
      unit === 'piece'
        ? [0.5, 1, 2, 3]
        : unit === 'package'
          ? [0.25, 0.5, 1, 2]
          : unit === 'ml'
            ? [100, 200, 250, 330, 500]
            : [50, 100, 150, 200, 250];
    $('#portion-presets').innerHTML = presets
      .map((value) =>
        action(
          'preset',
          fmt(value, 2) + ' ' + unitLabel(unit),
          null,
          'filter',
          `data-grams="${value}"`
        )
      )
      .join('');
  }
  function readPortion() {
    const ctx = context(),
      unit = $('#portion-unit')?.value || C.basis(ctx.food),
      field = $('#portion-size');
    if (field && !field.disabled && field.value === '') throw Error('Missing unit size');
    return C.portion(
      ctx.food,
      Number($('#portion-grams').value),
      unit,
      field && !field.disabled && field.value !== '' ? Number(field.value) : undefined
    );
  }
  function refreshConversion(result) {
    const target = $('#portion-conversion-status');
    if (!target) return;
    target.textContent = result
      ? entryLabel(result) + ' = ' + fmt(result.grams, 1) + ' ' + unitLabel(C.basis(result.food))
      : t('calibratePortion');
    target.classList.toggle('needs-value', !result);
  }
  function stashRecipe() {
    const form = $('#recipe-form');
    if (!form || !draft) return;
    draft.title = form.elements?.name?.value || $('[name=recipeName]')?.value || draft.title;
    draft.title = $('#recipe-name')?.value ?? draft.title;
    draft.yieldAmount = Number($('#recipe-yield')?.value) || 0;
    draft.servings = Number($('#recipe-servings')?.value) || 0;
    draft.photoDraft = context().photoDraft ?? draft.photoDraft;
    draft.removePhoto = context().removePhoto ?? draft.removePhoto;
  }
  function recipeHTML() {
    const foods = state().customFoods.filter((food) => food.kind === 'recipe');
    return `<div class="page-head between"><div><p class="eyebrow">${t('myKitchen')}</p><h1>${t('recipes')}</h1></div>${action('new-recipe', t('newRecipe'), 'plus', 'btn')}</div><div class="page-tabs">${action('show-foods', t('foods'), null, 'tab')}${action('show-recipes', t('recipes'), null, 'tab active')}</div>${foods.length ? `<div class="recipe-grid">${foods.map((food) => `<article class="recipe-card">${photo(food, 'hero')}<div><h3>${esc(name(food))}</h3><p>${food.recipe.ingredients.length} ${t('ingredients').toLowerCase()} · ${fmt(food.kcal)} ${t('kcal')} / 100 ${t('g')}</p></div><div class="recipe-actions">${action('edit-recipe', t('editRecipe'), 'edit', 'icon-btn', `data-id="${esc(food.id)}" aria-label="${t('editRecipe')}"`)}${action('portion', t('add'), 'plus', 'btn small', `data-id="${esc(food.id)}"`)}</div></article>`).join('')}</div>` : `<section class="empty-state"><div class="empty-symbol">${icon('food')}</div><h2>${t('recipeEmpty')}</h2><p>${t('recipeEmptyNote')}</p>${action('new-recipe', t('newRecipe'), 'plus', 'btn')}</section>`}`;
  }
  function showRecipe(food = null, resume = false) {
    picking = false;
    if (!resume)
      draft = food
        ? {
            id: food.id,
            title: name(food),
            food: structuredClone(food),
            ingredients: structuredClone(food.recipe.ingredients),
            yieldAmount: food.recipe.yieldAmount,
            servings: food.recipe.servings || 1,
            yieldManual: true
          }
        : {
            id: null,
            title: '',
            food: null,
            ingredients: [],
            yieldAmount: 0,
            servings: 1,
            yieldManual: false
          };
    open(
      draft.id ? t('editRecipe') : t('newRecipe'),
      `<form id="recipe-form"><label>${t('recipeName')}<input id="recipe-name" name="recipeName" maxlength="200" value="${esc(draft.title)}" required></label><div class="editor-photo-row"><div id="editor-photo-preview">${draft.photoDraft ? `<img class="uploaded-preview" src="${draft.photoDraft}" alt="${t('emptyPhoto')}">` : draft.food ? photo(draft.food, 'hero') : `<div class="photo-empty">${icon('food')}</div>`}</div><label class="btn secondary file-label">${icon('camera')}${t('addPhoto')}<input id="recipe-photo-file" type="file" accept="image/jpeg,image/png,image/webp"></label></div><div class="between form-section-title"><h3>${t('ingredients')}</h3>${action('add-ingredient', t('addIngredient'), 'plus', 'text-button')}</div><div class="ingredient-list">${draft.ingredients.map((item, index) => `<div class="ingredient-row"><div><strong>${esc(name(item.food))}</strong><small>${entryLabel(item)}</small></div><span>${fmt((item.food.kcal * item.grams) / 100)} ${t('kcal')}</span>${action('remove-ingredient', '', 'close', 'icon-btn', `data-index="${index}" aria-label="${t('delete')}"`)}</div>`).join('') || `<p class="empty-inline">${t('recipeAddFirst')}</p>`}</div><div class="field-grid gap-top"><label>${t('cookedWeight')}<input id="recipe-yield" name="yieldAmount" type="number" min="1" max="100000" step=".1" inputmode="decimal" value="${draft.yieldAmount || ''}" required><small class="field-note">${t('cookedWeightNote')}</small></label><label>${t('recipeServings')}<input id="recipe-servings" name="servings" type="number" min=".1" max="1000" step=".1" inputmode="decimal" value="${draft.servings || 1}" required></label></div><div id="recipe-preview"></div><div class="dialog-actions">${action('close-modal', t('cancel'), null, 'btn secondary')}<button class="btn" type="submit">${t('saveRecipe')}</button></div></form>`,
      true
    );
    setContext({ type: 'recipe', photoDraft: draft.photoDraft, removePhoto: draft.removePhoto });
    refreshRecipe();
  }
  function refreshRecipe() {
    if (!draft || !$('#recipe-preview')) return;
    const weight = Number($('#recipe-yield').value),
      servings = Number($('#recipe-servings').value);
    let values = null;
    try {
      values = C.recipeNutrition(draft.ingredients, weight);
    } catch {}
    $('#recipe-preview').innerHTML =
      `<div class="recipe-summary"><span>${t('per100Any')}</span><strong>${values ? fmt(values.kcal) : '—'} <small>${t('kcal')}</small></strong><div>${[
        ['p', 'protein'],
        ['f', 'fat'],
        ['c', 'carbs']
      ]
        .map(
          ([key, label]) =>
            `<span>${t(label)} <b>${values ? fmt(values[key], 1) : '—'} ${t('g')}</b></span>`
        )
        .join(
          ''
        )}</div><small>${t('perServing')}: ${values && servings > 0 ? fmt((values.kcal * weight) / 100 / servings) + ' ' + t('kcal') : '—'}</small></div>`;
  }
  function captureIngredient(item) {
    if (!draft || draft.ingredients.length >= 100) {
      notify(t('recipeLimit'), true);
      return false;
    }
    draft.ingredients.push({
      food: structuredClone(item.food),
      grams: item.grams,
      amount: item.amount,
      unit: item.unit
    });
    if (!draft.yieldManual)
      draft.yieldAmount = draft.ingredients.every((row) => C.basis(row.food) === 'g')
        ? draft.ingredients.reduce((sum, row) => sum + row.grams, 0)
        : 0;
    showRecipe(null, true);
    return true;
  }
  function editor(food) {
    open(
      t('editFood'),
      `<form id="food-editor-form"><div class="editor-photo-row"><div id="editor-photo-preview">${photo(food, 'hero')}</div><div><label class="btn secondary file-label">${icon('camera')}${t(food.photoId ? 'changePhoto' : 'addPhoto')}<input id="food-photo-file" type="file" accept="image/jpeg,image/png,image/webp"></label>${food.photoId ? action('remove-own-photo', t('removePhoto'), null, 'text-button') : ''}</div></div><p class="field-note">${t('photoLocal')}</p><label>${t('foodName')}<input name="name" maxlength="200" value="${esc(name(food))}" required></label><div class="field-grid gap-top"><label>${t('nutritionBasis')}<select name="basis"><option value="g" ${C.basis(food) === 'g' ? 'selected' : ''}>${t('basisG')}</option><option value="ml" ${C.basis(food) === 'ml' ? 'selected' : ''}>${t('basisMl')}</option></select></label><label>${t('barcodeOptional')}<input name="barcode" inputmode="numeric" pattern="[0-9]{8,14}" maxlength="14" value="${esc(food.barcode || '')}"></label></div><h3 class="form-section-title">${t('yourLabel')}</h3><div class="field-grid">${[['kcal', 'kcal', 1000], ['p', 'protein', 100], ['f', 'fat', 100], ['c', 'carbs', 100], ...N.extras.map((key) => [key, key, 100])].map(([key, label, max]) => `<label>${t(label)}<input name="${key}" type="number" min="0" max="${max}" step="any" inputmode="decimal" value="${food[key] ?? ''}" ${['kcal', 'p', 'f', 'c'].includes(key) ? 'required' : ''}></label>`).join('')}</div><details class="editor-measures"><summary>${t('measureTitle')}</summary><p class="field-note">${t('measureOptional')}</p><div class="field-grid">${[
        ['piece', 'pieceWeight', 10000],
        ['package', 'packageWeight', 10000],
        ['density', 'density', 20]
      ]
        .map(
          ([key, label, max]) =>
            `<label>${t(label)}${key === 'density' ? '' : ' (' + unitLabel(C.basis(food)) + ')'}<input name="measure-${key}" type="number" min=".01" max="${max}" step="any" inputmode="decimal" value="${food.measure?.[key] ?? ''}"></label>`
        )
        .join(
          ''
        )}</div></details><p class="field-note">${t('foodEditNote')}</p><div class="dialog-actions">${action('close-modal', t('cancel'), null, 'btn secondary')}<button type="submit" class="btn">${t('saveFood')}</button></div></form>`,
      true
    );
    setContext({ type: 'food-editor', food: structuredClone(food) });
  }
  function attachPhoto(food, ctx) {
    const photos = { ...state().photos };
    if (ctx.removePhoto) delete food.photoId;
    if (ctx.photoDraft) {
      const id = 'photo-' + uid();
      photos[id] = ctx.photoDraft;
      food.photoId = id;
      const used = new Set();
      const visit = (item) => {
        if (item?.photoId) used.add(item.photoId);
        for (const row of item?.recipe?.ingredients || []) visit(row.food);
      };
      for (const item of state().customFoods) visit(item.id === food.id ? food : item);
      visit(food);
      for (const day of Object.values(state().days)) for (const row of day.entries) visit(row.food);
      for (const key of Object.keys(photos)) if (!used.has(key)) delete photos[key];
      if (
        Object.keys(photos).length > 64 ||
        Object.values(photos).reduce((sum, value) => sum + value.length, 0) > 3000000
      )
        throw Error('photo-limit');
      food.photoId = id;
    }
    return photos;
  }
  function upsert(food, photos) {
    if (!C.validFood(food)) throw Error('invalid');
    const existing = state().customFoods.find((item) => item.id === food.id);
    if (!existing && state().customFoods.length >= 20000) throw Error('limit');
    if (existing) Object.assign(existing, food);
    else state().customFoods.push(food);
    state().photos = photos;
    return save();
  }
  function statsHTML() {
    const report = C.report(state(), range),
      streak = C.streak(state()),
      weights = report.weights,
      last = [...state().weights]
        .filter((w) => w.date <= C.dateKey())
        .sort((a, b) => b.date.localeCompare(a.date))[0],
      max = Math.max(1, ...report.days.map((day) => day.total.kcal));
    let line = '';
    if (weights.length) {
      const lo = Math.min(...weights.map((w) => w.value)),
        hi = Math.max(...weights.map((w) => w.value)),
        span = hi - lo || 1;
      const points = weights.map((w, i) => [
        40 + (weights.length === 1 ? 260 : (i / (weights.length - 1)) * 520),
        135 - ((w.value - lo) / span) * 95
      ]);
      line = `<svg viewBox="0 0 600 180" role="img" aria-label="${esc(weights.map((w) => w.date + ': ' + w.value + ' ' + t('kg')).join('; '))}"><path class="chart-grid" d="M40 40H560M40 90H560M40 140H560"/><polyline class="weight-line" points="${points.map((point) => point.join(',')).join(' ')}"/>${points.map((point) => `<circle class="weight-point" cx="${point[0]}" cy="${point[1]}" r="4"/>`).join('')}<text x="40" y="170">${weights[0].date.slice(5)}</text><text x="510" y="170">${weights.at(-1).date.slice(5)}</text><text x="5" y="45">${fmt(hi, 1)}</text><text x="5" y="140">${fmt(lo, 1)}</text></svg>`;
    }
    return `<div class="page-head between"><div><p class="eyebrow">${t('insights')}</p><h1>${t('insights')}</h1></div>${action('log-weight', t('logWeight'), 'plus', 'btn')}</div><div class="range-tabs">${[7, 30].map((value) => action('report-range', t(value === 7 ? 'weekRange' : 'monthRange'), null, 'tab' + (value === range ? ' active' : ''), `data-value="${value}" aria-pressed="${value === range}"`)).join('')}</div><div class="progress-stats"><div class="stat-card"><p>${t('averageDaily')}</p><strong>${report.average.kcal == null ? '—' : fmt(report.average.kcal)}<small>${t('kcal')}</small></strong><span>${t('averageNote')}</span></div><div class="stat-card"><p>${t('daysLogged')}</p><strong>${report.logged}<small>/ ${range}</small></strong><span>${streak.best} ${dayWord(streak.best)} · ${t('bestStreak').toLowerCase()}</span></div><div class="stat-card"><p>${t('weightChange')}</p><strong>${report.change == null ? '—' : (report.change > 0 ? '+' : '') + fmt(report.change, 1)}<small>${t('kg')}</small></strong><span>${last ? fmt(last.value, 1) + ' ' + t('kg') : t('needMoreWeights')}</span></div></div><section class="panel chart-panel"><div class="between"><h2>${t('energyHistory')}</h2><small>${t('kcal')}</small></div><div class="bar-chart range-${range}" role="img" aria-label="${esc(report.days.map((day) => day.date + ': ' + (day.count ? fmt(day.total.kcal) : '—')).join('; '))}">${report.days.map((day, index) => `<div class="bar-column"><div class="bar-value">${range === 7 && day.count ? fmt(day.total.kcal) : ''}</div><div class="bar-wrap"><div class="bar" style="--height:${day.count ? Math.max(1, (day.total.kcal / max) * 100) : 0}%"></div></div><span class="bar-label">${range === 7 || index % 5 === 0 ? day.date.slice(8) : ''}</span></div>`).join('')}</div>${!report.logged ? `<p class="empty-inline">${t('noRangeData')}</p>` : ''}<div class="average-macros">${[
      ['p', 'protein'],
      ['f', 'fat'],
      ['c', 'carbs']
    ]
      .map(
        ([key, label]) =>
          `<span>${t(label)}<b>${report.average[key] == null ? '—' : fmt(report.average[key], 1) + ' ' + t('g')}</b></span>`
      )
      .join(
        ''
      )}</div></section><section class="panel weight-chart"><div class="between"><h2>${t('weightTrend')}</h2>${action('log-weight', '', 'plus', 'icon-btn', `aria-label="${t('logWeight')}"`)}</div>${line || `<p class="empty-inline">${t('needMoreWeights')}</p>`}</section><section class="panel"><h2>${t('weightHistory')}</h2>${
      [...state().weights]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 40)
        .map(
          (w) =>
            `<div class="weight-row"><span>${esc(w.date)}</span><div class="flex"><strong>${fmt(w.value, 1)} ${t('kg')}</strong>${action('delete-weight', '', 'trash', 'icon-btn', `data-date="${w.date}" aria-label="${t('delete')}"`)}</div></div>`
        )
        .join('') || `<p class="empty-inline">${t('noEntries')}</p>`
    }</section>`;
  }
  function click(button) {
    const a = button.dataset.action;
    if (a === 'new-recipe') {
      showRecipe();
      return true;
    }
    if (a === 'edit-recipe') {
      const food = find(button.dataset.id);
      if (food?.recipe) showRecipe(food);
      return true;
    }
    if (a === 'edit-food') {
      const food = find(button.dataset.id || context().food?.id) || context().food;
      if (food) food.kind === 'recipe' ? showRecipe(food) : editor(food);
      return true;
    }
    if (a === 'add-ingredient') {
      stashRecipe();
      if (draft.ingredients.length >= 100) {
        notify(t('recipeLimit'), true);
        return true;
      }
      picking = true;
      openSearch();
      return true;
    }
    if (a === 'remove-ingredient') {
      stashRecipe();
      draft.ingredients.splice(Number(button.dataset.index), 1);
      if (!draft.yieldManual)
        draft.yieldAmount = draft.ingredients.every((item) => C.basis(item.food) === 'g')
          ? draft.ingredients.reduce((sum, item) => sum + item.grams, 0)
          : 0;
      showRecipe(null, true);
      return true;
    }
    if (a === 'remove-own-photo') {
      context().removePhoto = true;
      context().photoDraft = null;
      $('#editor-photo-preview').innerHTML =
        '<div class="photo-empty">' + icon('camera') + '</div>';
      return true;
    }
    if (a === 'report-range') {
      range = Number(button.dataset.value) === 30 ? 30 : 7;
      render();
      return true;
    }
    if (a === 'streak-info') {
      const s = C.streak(state());
      open(
        t('streakDetails'),
        `<div class="streak-detail ${s.lit ? 'is-lit' : ''}">${flame()}<strong>${s.count}</strong><span>${dayWord(s.count)}</span><p>${t(s.lit ? 'streakActive' : s.count ? 'streakPending' : 'streakStart')}</p></div><p class="help">${t('streakHow')}</p><div class="streak-best">${t('bestStreak')}<b>${s.best} ${dayWord(s.best)}</b></div>`
      );
      return true;
    }
    if (a === 'repeat-meal') {
      const meal = Number(button.dataset.meal),
        rows = C.recentMeals(state(), date(), meal);
      open(
        t('repeatMeal'),
        `<div class="repeat-list">${rows.map((row) => action('use-meal', '', null, 'repeat-option', `data-date="${row.date}" data-meal="${meal}"`).replace('</button>', `<span><strong>${new Date(row.date + 'T12:00:00').toLocaleDateString({ uk: 'uk-UA', ru: 'ru-RU', en: 'en-GB' }[state().lang], { day: 'numeric', month: 'long' })}</strong><small>${esc(row.entries.map((entry) => name(entry.food)).join(' · '))}</small></span><b>${fmt(C.total(row.entries).kcal)} ${t('kcal')}</b>${icon('plus')}</button>`)).join('') || `<p class="empty-inline">${t('noRecentMeals')}</p>`}</div>`
      );
      return true;
    }
    if (a === 'use-meal') {
      const meal = Number(button.dataset.meal),
        source =
          state().days[button.dataset.date]?.entries.filter((entry) => entry.meal === meal) || [],
        target = state().days[date()] || { entries: [], water: [] };
      if (target.entries.length + source.length > 500) {
        notify(t('required'), true);
        return true;
      }
      const added = source.map((entry) => ({
        ...structuredClone(entry),
        id: uid(),
        loggedOn: C.dateKey()
      }));
      target.entries.push(...added);
      state().days[date()] = target;
      save();
      close();
      render();
      notify(t('added'), false, () => {
        target.entries = target.entries.filter(
          (entry) => !added.some((item) => item.id === entry.id)
        );
        save();
        render();
      });
      return true;
    }
    if (a === 'close-modal' && picking) {
      picking = false;
      showRecipe(null, true);
      return true;
    }
    return false;
  }
  function submit(form, data) {
    if (form.id === 'recipe-form') {
      stashRecipe();
      try {
        const values = C.recipeNutrition(draft.ingredients, draft.yieldAmount);
        if (
          !Number.isFinite(draft.servings) ||
          draft.servings < 0.1 ||
          draft.servings > 1000 ||
          !draft.title.trim()
        )
          throw Error();
        const food = {
          ...(draft.food || {}),
          id: draft.id || 'custom-recipe-' + uid(),
          names: [draft.title.trim(), draft.title.trim(), draft.title.trim()],
          ...values,
          basis: 'g',
          kind: 'recipe',
          source: 'custom',
          category: 'other',
          emoji: '🍳',
          measure: { piece: draft.yieldAmount / draft.servings },
          recipe: {
            ingredients: structuredClone(draft.ingredients),
            yieldAmount: draft.yieldAmount,
            servings: draft.servings
          },
          detailsLoaded: true
        };
        const photos = attachPhoto(food, {
          photoDraft: draft.photoDraft,
          removePhoto: draft.removePhoto
        });
        if (upsert(food, photos)) {
          close();
          render();
          notify(t('saved'));
          draft = null;
        }
      } catch (error) {
        notify(t(error.message === 'photo-limit' ? 'photoLimit' : 'recipeNeedsIngredients'), true);
      }
      return true;
    }
    if (form.id === 'food-editor-form') {
      const ctx = context(),
        label = String(data.get('name') || '').trim(),
        code = String(data.get('barcode') || '').trim();
      try {
        if (!label || (code && !C.barcodeKey(code))) throw Error();
        if (
          code &&
          list().some(
            (food) =>
              food.id !== ctx.food.id &&
              food.barcode &&
              C.barcodeKey(food.barcode) === C.barcodeKey(code) &&
              C.validFood(food)
          )
        ) {
          notify(t('barcodeUsed'), true);
          return true;
        }
        const food = {
          ...ctx.food,
          names: label === name(ctx.food) ? ctx.food.names : [label, label, label],
          source: 'custom',
          originSource: ctx.food.originSource || ctx.food.source,
          personalized: true,
          basis: data.get('basis'),
          barcode: code || undefined,
          measure: {},
          detailsLoaded: true
        };
        if (code !== ctx.food.barcode && ctx.food.barcode) delete food.sourceUrl;
        for (const key of ['kcal', 'p', 'f', 'c', ...N.extras]) {
          const value = data.get(key);
          if (value !== null && value !== '') food[key] = Number(value);
          else if (N.extras.includes(key)) delete food[key];
          else throw Error();
        }
        for (const key of ['density', 'piece', 'package'])
          if (data.get('measure-' + key) !== '')
            food.measure[key] = Number(data.get('measure-' + key));
        const photos = attachPhoto(food, ctx);
        if (upsert(food, photos)) {
          close();
          render();
          notify(t('saved'));
        }
      } catch (error) {
        notify(t(error.message === 'photo-limit' ? 'photoLimit' : 'required'), true);
      }
      return true;
    }
    return false;
  }
  async function changePhoto(file) {
    const ctx = context();
    try {
      const image = await window.RationMedia.prepare(file);
      if (context() !== ctx) return;
      ctx.photoDraft = image;
      ctx.removePhoto = false;
      $('#editor-photo-preview').innerHTML =
        `<img class="uploaded-preview" src="${image}" alt="${t('emptyPhoto')}">`;
    } catch {
      if (context() === ctx) notify(t('photoError'), true);
    }
  }
  return {
    streakBadge,
    flame,
    beforeRender,
    afterRender,
    portionFields,
    syncUnits,
    readPortion,
    refreshConversion,
    entryLabel,
    unitLabel,
    recipeHTML,
    statsHTML,
    click,
    submit,
    changePhoto,
    refreshRecipe,
    isPicking: () => picking,
    captureIngredient,
    editor,
    showRecipe,
    onRecipeInput: (id) => {
      if (id === 'recipe-yield' && draft) draft.yieldManual = true;
      refreshRecipe();
    },
    cancelPicking: () => {
      if (picking) {
        picking = false;
        showRecipe(null, true);
        return true;
      }
      return false;
    }
  };
};
