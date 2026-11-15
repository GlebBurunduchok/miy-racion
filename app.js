(() => {
  'use strict';
  const C = window.RationCore,
    N = window.RationNutrition,
    API = window.RationAPI,
    S = window.RationStorage,
    $ = (s) => document.querySelector(s),
    app = $('#app'),
    modal = $('#modal');
  const initialStorage = S.load();
  const icons = {
    repeat: 'M4 7h12a4 4 0 0 1 4 4M4 7l4-4M4 7l4 4M20 17H8a4 4 0 0 1-4-4m16 4-4-4m4 4-4 4',
    leaf: 'M20 4C8 2 2 9 7 17c8 5 15-1 13-13ZM5 21l10-13',
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    book: 'M4 3h13a3 3 0 0 1 3 3v15H6a3 3 0 0 1 0-6h14M4 3v15M8 7h7M8 11h5',
    food: 'M6 3v7m-3-7v5a3 3 0 0 0 6 0V3M6 11v10M17 3c-4 3-4 10 0 10V3Zm0 10v8',
    chart: 'M4 20V10m8 10V4m8 16v-7',
    settings:
      'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z',
    plus: 'M12 5v14M5 12h14',
    chevron: 'm9 5 7 7-7 7',
    left: 'm15 5-7 7 7 7',
    close: 'm6 6 12 12M6 18 18 6',
    check: 'm5 12 4 4L19 6',
    arrow: 'M4 12h16m-6-6 6 6-6 6',
    sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',
    sunrise: 'M3 17h18M5 21h14M7 17a5 5 0 0 1 10 0M12 3v5m-8 2 3 2m13-2-3 2m-8-6 3-3 3 3',
    moon: 'M20 15A9 9 0 0 1 9 4 9 9 0 1 0 20 15Z',
    coffee: 'M4 8h12v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4ZM16 9h2a3 3 0 0 1 0 6h-2M7 3v2m5-2v2',
    drop: 'M12 3C9 8 5 11 5 15a7 7 0 0 0 14 0c0-4-4-7-7-12ZM9 15a3 3 0 0 0 3 3',
    search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 6 6',
    scan: 'M3 8V3h5m8 0h5v5m0 8v5h-5M8 21H3v-5M7 8v8m3-8v8m4-8v8m3-8v8',
    star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z',
    trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
    edit: 'm16 3 5 5-12 12-6 1 1-6ZM13 6l5 5',
    calendar: 'M3 5h18v16H3ZM7 3v4m10-4v4M3 10h18',
    info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 11v6m0-10v1',
    shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Zm-4 9 3 3 5-6',
    download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
    upload: 'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5',
    globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3 12h18M12 3c-5 5-5 13 0 18m0-18c5 5 5 13 0 18',
    camera: 'M3 7h5l2-3h4l2 3h5v14H3ZM12 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
    spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z',
    activity: 'M2 12h5l3-8 4 16 3-8h5',
    lock: 'M5 10h14v11H5ZM8 10V6a4 4 0 0 1 8 0v4M12 14v3',
    weight: 'M4 5h16l2 16H2ZM8 9h8m-4 0 2-2'
  };

  const icon = (n) =>
    `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[n] || icons.food}"/></svg>`;
  const esc = (s) =>
    String(s ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  let state = initialStorage.state,
    page = 'diary',
    selectedDate = C.dateKey(),
    modalContext = {},
    toastTimer,
    scannerControls = null,
    scannerToken = 0,
    storageFailure = initialStorage.error,
    recovery = initialStorage.recovery,
    installPrompt = null,
    undoAction = null;

  const t = (k) => window.RATION_TEXT[k]?.[{ uk: 0, ru: 1, en: 2 }[state.lang]] || k;
  const locale = () => ({ uk: 'uk-UA', ru: 'ru-RU', en: 'en-GB' })[state.lang];
  const fmt = (n, dec = 0) =>
    Number(n || 0).toLocaleString(locale(), { maximumFractionDigits: dec });
  const name = (f) => f.names[{ uk: 0, ru: 1, en: 2 }[state.lang]];
  const day = (date = selectedDate) => state.days[date] || { entries: [], water: [] };
  const ensureDay = (date = selectedDate) => (state.days[date] ||= { entries: [], water: [] });
  const uid = () =>
    globalThis.crypto?.randomUUID?.() || Date.now() + '-' + Math.random().toString(36).slice(2);
  const baseFoods = [
      ...window.RATION_FOODS,
      ...(window.RATION_EXTENDED || []),
      ...(window.RATION_BARCODE_CATALOG || [])
    ].sort((a, b) => Number(!!b.imageUrl) - Number(!!a.imageUrl)),
    baseMap = new Map(baseFoods.map((f) => [f.id, f]));
  const remoteMap = new Map();
  function foodList() {
    return [...new Map([...baseFoods, ...state.customFoods].map((f) => [f.id, f])).values()];
  }
  function foodById(id) {
    return (
      state.customFoods.find((f) => f.id === id) ||
      remoteMap.get(id) ||
      baseMap.get(id) ||
      Object.values(state.days)
        .flatMap((d) => d.entries)
        .find((e) => e.food.id === id)?.food
    );
  }
  const sourceName = (f) =>
    ({
      tablycja: 'Таблиця Калорійності',
      usda: 'USDA',
      off: 'Open Food Facts',
      reference: t('basicFoods'),
      custom: t('customSource'),
      import: t('imported')
    })[f.source];
  const action = (a, label, ic, cls = 'btn', extra = '') =>
    `<button type="button" class="${cls}" data-action="${a}" ${extra}>${ic ? icon(ic) : ''}${esc(label || '')}</button>`;
  const ib = (a, ic, label, extra = '') =>
    action(a, '', ic, 'icon-btn', `aria-label="${esc(label)}" title="${esc(label)}" ${extra}`);
  function persist() {
    const current = C.streak(state);
    state.streakSeen = { date: C.dateKey(), count: current.count, lit: current.lit };
    if (S.save(state, recovery)) {
      recovery = null;
      storageFailure = false;
      return true;
    }
    storageFailure = true;
    toast(t('storageError'), true);
    return false;
  }
  function toast(message, error = false, undo = null) {
    if (storageFailure && !error) {
      message = t('storageError');
      error = true;
      undo = null;
    }
    clearTimeout(toastTimer);
    undoAction = undo;
    $('#toast').innerHTML =
      `<span>${esc(message)}</span>${undo ? action('undo', t('undo'), null, 'toast-undo') : ''}`;
    $('#toast').className = 'visible' + (error ? ' error' : '');
    toastTimer = setTimeout(
      () => {
        $('#toast').className = '';
        undoAction = null;
      },
      undo ? 6500 : error ? 6000 : 2300
    );
  }
  function preferences() {
    document.documentElement.lang = state.lang;
    document.title = 'Мій раціон';
    document.body.classList.toggle('reduce-motion', state.settings.reduceMotion);
    document.body.classList.toggle('compact', state.settings.compact);
  }
  function formatDate(d, opts = { day: 'numeric', month: 'long' }) {
    return new Date(d + 'T12:00:00').toLocaleDateString(locale(), opts);
  }
  function brand() {
    return `<div class="brand"><img src="assets/icon-v2-3.svg" alt=""><span>Мій раціон</span></div>`;
  }
  function nav(bottom = false) {
    return [
      ['diary', 'book'],
      ['foods', 'food'],
      ['insights', 'chart'],
      ['settings', 'settings']
    ]
      .map(
        ([id, ic], i) =>
          (bottom && i === 2
            ? action('add-food', '', 'plus', 'floating-add', `aria-label="${t('addFood')}"`)
            : '') +
          action(
            'nav',
            t(id),
            ic,
            id === page || (id === 'foods' && page === 'recipes') ? 'active' : '',
            `data-page="${id}" ${id === page || (id === 'foods' && page === 'recipes') ? 'aria-current="page"' : ''}`
          )
      )
      .join('');
  }
  function render() {
    preferences();
    if (!state.profile) {
      renderOnboarding();
      return;
    }
    FUI.beforeRender();
    app.innerHTML = `<div class="shell"><aside class="sidebar">${brand()}<p class="sidebar-caption">${t('diarySubtitle')}</p><nav class="nav">${nav()}</nav><div class="sidebar-recipe">${action('show-recipes', t('recipes'), 'food', 'sidebar-kitchen')}</div><div class="sidebar-bottom"><div class="saved-state">${icon('lock')}<span>${t('deviceStorage')}</span></div></div></aside><div class="workspace"><header class="topbar"><div class="mobile-brand">${brand()}</div><span class="top-crumb">${t(page)}</span><div class="topbar-right">${FUI.streakBadge()}${ib('scan', 'scan', t('scan'))}${ib('nav', 'settings', t('settings'), 'data-page="settings"')}</div></header><main class="content" id="main">${storageFailure ? '<div class="offline-banner">' + t('storageError') + '</div>' : ''}${page === 'diary' ? diaryHTML() : page === 'foods' ? catalogHTML() : page === 'recipes' ? FUI.recipeHTML() : page === 'insights' ? progressHTML() : settingsHTML()}</main></div><nav class="bottom-nav">${nav(true)}</nav></div>`;
    FUI.afterRender();
  }
  function dateControls() {
    return `<div class="date-control">${ib('date-prev', 'left', t('previous'))}<label class="sr-only" for="diary-date">${t('date')}</label><input id="diary-date" type="date" value="${selectedDate}">${ib('date-next', 'chevron', t('following'))}${selectedDate !== C.dateKey() ? action('today', t('today'), null, 'btn small secondary') : ''}</div>`;
  }
  function header(title, subtitle = '', buttons = '') {
    return `<div class="page-head between"><div><h1>${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>${buttons}</div>`;
  }
  function diaryHTML() {
    const entries = day().entries,
      total = C.total(entries),
      target = state.targets.kcal,
      remaining = target == null ? null : target - total.kcal,
      pct = target > 0 ? Math.min(100, (total.kcal / target) * 100) : 0,
      water = day().water.reduce((sum, value) => sum + value, 0),
      wg = state.settings.waterGoal,
      weekday = (new Date(selectedDate + 'T12:00:00').getDay() + 6) % 7;
    const days = Array.from({ length: 7 }, (_, index) =>
      C.shiftDate(selectedDate, index - weekday)
    );
    return `<div class="diary-heading"><div><p class="eyebrow">${formatDate(selectedDate, { month: 'long', year: 'numeric' })}</p><h1>${selectedDate === C.dateKey() ? t('todayTitle') : formatDate(selectedDate, { day: 'numeric', month: 'long' })}</h1></div>${dateControls()}</div><div class="day-strip">${days.map((key) => action('select-day', '', null, 'day-chip' + (key === selectedDate ? ' selected' : ''), `data-date="${key}" aria-label="${esc(formatDate(key, { day: 'numeric', month: 'long' }))}" aria-pressed="${key === selectedDate}"`).replace('</button>', `<span>${formatDate(key, { weekday: 'short' })}</span><strong>${Number(key.slice(8))}</strong><i class="${day(key).entries.length ? 'has-records' : ''}"></i></button>`)).join('')}</div><section class="panel summary"><div class="calorie-overview"><div><p class="nutrition-overline">${t('eaten')}</p><div class="calorie-total"><strong>${fmt(total.kcal)}</strong><span>${t('kcal')}</span></div></div><div class="calorie-remaining"><strong>${remaining == null ? '—' : fmt(Math.abs(remaining))}</strong><span>${remaining == null ? t('noTarget') : t(remaining >= 0 ? 'leftToday' : 'overToday')}</span></div></div><div class="budget-track"><span style="width:${pct}%"></span></div><div class="budget-caption"><span>${t('dailyBudget')}</span><strong>${target == null ? '—' : fmt(target) + ' ' + t('kcal')}</strong></div>${dailyMacroHTML(total)}<details class="nutrient-details" id="daily-nutrients" ${state.settings.extrasOpen ? 'open' : ''}><summary><span>${t('extraNutrients')}</span>${icon('chevron')}</summary>${dailyExtrasHTML()}</details></section><div class="section-heading"><h2>${t('diary')}</h2><span>${entries.length} ${t('items')}</span></div><div class="dashboard-grid"><div class="meal-list">${Array.from({ length: 5 }, (_, index) => mealHTML(index)).join('')}</div><aside class="right-column"><section class="panel water-panel"><div class="between"><div class="water-title">${icon('drop')}<h2>${t('waterShort')}</h2></div><span>${fmt(water)} <small>/ ${fmt(wg)} ${t('ml')}</small></span></div><div class="track water-track"><span style="width:${wg ? Math.min(100, (water / wg) * 100) : 0}%"></span></div><div class="water-actions">${[150, 250, 500].map((value) => action('water', '+' + value + ' ' + t('ml'), null, 'btn secondary', `data-value="${value}"`)).join('')}</div>${action('water-undo', t('undo'), null, 'water-undo', day().water.length ? '' : 'disabled')}</section><section class="panel quick-tools"><h2>${t('myKitchen')}</h2>${action('show-recipes', t('recipes'), 'food', 'quick-action')}${action('nav', t('favorites'), 'star', 'quick-action', 'data-page="foods" data-filter="favorites"')}${action('log-weight', t('logWeight'), 'weight', 'quick-action')}</section></aside></div>`;
  }
  function mealHTML(index) {
    const rows = day().entries.filter((entry) => entry.meal === index),
      total = C.total(rows),
      recent = C.recentMeals(state, selectedDate, index, 1).length;
    return `<section class="meal-card meal-${index}"><div class="meal-head"><span class="meal-icon">${icon(['sunrise', 'coffee', 'sun', 'coffee', 'moon'][index])}</span><div class="meal-text"><h3>${t('meal' + index)}</h3><span>${fmt(total.kcal)} ${t('kcal')}</span></div>${recent ? ib('repeat-meal', 'repeat', t('repeatMeal'), `data-meal="${index}"`) : ''}${rows.length ? action('add-food', '', 'plus', 'meal-add', `data-meal="${index}" aria-label="${esc(t('addFood') + ' · ' + t('meal' + index))}"`) : ''}</div>${rows.map((entry) => `<div class="entry-row">${photoHTML(entry.food, 'entry')}<button class="entry-main" data-action="edit-entry" data-id="${esc(entry.id)}"><strong>${esc(name(entry.food))}</strong><small>${FUI.entryLabel(entry)}</small></button><span class="entry-kcal">${fmt((entry.food.kcal * entry.grams) / 100)}</span>${ib('delete-entry', 'trash', t('delete'), `data-id="${esc(entry.id)}"`)}</div>`).join('') || `<div class="meal-empty"><span>${t('mealEmpty')}</span>${action('add-food', t('mealAddShort'), 'plus', 'text-button', `data-meal="${index}" aria-label="${esc(t('addFood') + ' · ' + t('meal' + index))}"`)}</div>`}</section>`;
  }

  function searchState() {
    return {
      q: '',
      filter: 'all',
      category: 'all',
      shown: 40,
      remote: [],
      busy: false,
      error: false,
      timer: null,
      controller: null,
      generation: 0
    };
  }
  let catalog = searchState(),
    addSearch = null;
  function selectedFoods(s) {
    let list = foodList();
    if (s.filter === 'favorites') list = list.filter((f) => state.favorites.includes(f.id));
    if (FUI.isPicking()) list = list.filter((food) => food.kind !== 'recipe');
    if (s.filter === 'custom')
      list = state.customFoods.filter(
        (f) => ['custom', 'import'].includes(f.source) || f.personalized
      );
    if (s.filter === 'recent') {
      const entries = Object.keys(state.days)
        .sort()
        .reverse()
        .flatMap((d) => state.days[d].entries.slice().reverse());
      list = [...new Map(entries.map((e) => [e.food.id, e.food])).values()];
    }
    if (s.category !== 'all') list = list.filter((f) => f.category === s.category);
    return C.search(list, s.q);
  }
  function mergedFoods(s) {
    const local = selectedFoods(s);
    return s.filter === 'all' && s.category === 'all'
      ? C.search([...new Map([...local, ...s.remote].map((f) => [f.id, f])).values()], s.q)
      : local;
  }
  function searchToolbar(s, mode) {
    return `<div class="search-line"><div class="searchbox">${icon('search')}<input id="${mode === 'catalog' ? 'catalog-search' : 'add-search'}" type="search" autocomplete="off" placeholder="${t('search')}" aria-label="${t('search')}" value="${esc(s.q)}"></div>${ib('scan', 'scan', t('scan'))}${ib('create-food', 'plus', t('createFood'))}</div><div class="search-filters">${['all', 'recent', 'favorites', 'custom'].map((f) => action('search-filter', t(f), f === 'favorites' ? 'star' : null, 'filter' + (s.filter === f ? ' active' : ''), `data-filter="${f}" data-mode="${mode}" aria-pressed="${s.filter === f}"`)).join('')}<select id="${mode}-category" aria-label="${t('category')}"><option value="all">${t('category')}</option>${['grain', 'protein', 'veg', 'fruit', 'dairy', 'fat', 'drink', 'other'].map((c) => `<option value="${c}" ${s.category === c ? 'selected' : ''}>${t(c === 'protein' ? 'proteinCat' : c === 'fat' ? 'fatCat' : c)}</option>`).join('')}</select></div>`;
  }
  function foodRow(f) {
    const chosen = state.favorites.includes(f.id);
    return `<article class="food-row" data-food-id="${esc(f.id)}">${photoHTML(f)}<button class="food-result-main" data-action="portion" data-id="${esc(f.id)}"><strong>${esc(name(f))}</strong><small>${f.brand ? esc(f.brand) + ' · ' : ''}${C.validFood(f) ? fmt(f.kcal) + ' ' + t('kcal') + ' · ' + t('pShort') + ' ' + fmt(f.p, 1) + ' · ' + t('fShort') + ' ' + fmt(f.f, 1) + ' · ' + t('cShort') + ' ' + fmt(f.c, 1) : t('nutritionMissing')} <span class="result-source">${esc(sourceName(f))}</span></small></button>${action('favorite', '', 'star', 'icon-btn favorite' + (chosen ? ' chosen' : ''), `data-id="${esc(f.id)}" aria-label="${t(chosen ? 'favoriteRemove' : 'favoriteAdd')}" aria-pressed="${chosen}"`)}${action('portion', '', 'plus', 'meal-add', `data-id="${esc(f.id)}" aria-label="${esc(t('addFood') + ' · ' + name(f))}"`)}</article>`;
  }
  function searchResults(s, mode) {
    const list = mergedFoods(s);
    return `<div class="results-meta"><span>${fmt(list.length)} ${t('results')} · ${t('per100Any')}</span><span role="status">${s.busy ? '<i class="load-spinner"></i> ' + t('loading') : s.error ? t('searchUnavailable') : ''}</span></div><div class="food-list">${list.slice(0, s.shown).map(foodRow).join('') || `<div class="empty">${s.busy ? t('loading') : t('noResults')}</div>`}</div>${list.length > s.shown ? action('more', t('showMore') + ' (' + fmt(list.length - s.shown) + ')', null, 'btn secondary full gap-top', `data-mode="${mode}"`) : ''}`;
  }
  function catalogHTML() {
    return `${header(t('foods'), fmt(foodList().length) + ' ' + t('inCatalog'), action('import-catalog', '', 'upload', 'icon-btn', `aria-label="${t('importCatalog')}"`))}<div class="page-tabs">${action('show-foods', t('foods'), null, 'tab active')}${action('show-recipes', t('recipes'), null, 'tab')}</div>${searchToolbar(catalog, 'catalog')}<div id="catalog-results">${searchResults(catalog, 'catalog')}</div>`;
  }

  function watchVisiblePhotos(s) {
    if (!window.IntersectionObserver) return;
    const container = $(s === catalog ? '#catalog-results' : '#add-results');
    if (!container) return;
    const generation = s.generation;
    API.ready.then(() => {
      if (!API.hasProxy?.() || !container.isConnected || generation !== s.generation) return;
      s.photoObserver?.disconnect();
      s.photoControllers ||= new Set();
      if (s.photoGeneration !== generation) {
        s.photoGeneration = generation;
        s.photoSeen = new Set();
        s.photoCount = 0;
      }
      const queue = [];
      let active = 0;
      const run = () => {
        if (generation !== s.generation || !container.isConnected) {
          queue.length = 0;
          return;
        }
        while (active < 2 && queue.length) {
          const food = queue.shift(),
            controller = new AbortController();
          active++;
          s.photoControllers.add(controller);
          const timer = setTimeout(() => controller.abort(), 14000);
          API.details(food, controller.signal)
            .then((detail) => {
              if (!detail || controller.signal.aborted || generation !== s.generation) return;
              const updated = { ...food, ...detail, detailsLoaded: true };
              if (!C.validCatalogFood(updated)) return;
              const base = baseMap.get(updated.id);
              if (base) Object.assign(base, updated);
              remoteMap.set(updated.id, updated);
              const saved = state.customFoods.find((f) => f.id === updated.id);
              if (saved && C.validFood(updated)) {
                Object.assign(saved, updated);
                persist();
              }
              if (container.isConnected) {
                const row = [...container.querySelectorAll('[data-food-id]')].find(
                    (el) => el.dataset.foodId === updated.id
                  ),
                  photo = row?.querySelector('.product-photo');
                if (photo) photo.outerHTML = photoHTML(updated);
              }
            })
            .catch(() => {})
            .finally(() => {
              clearTimeout(timer);
              s.photoControllers.delete(controller);
              active--;
              run();
            });
        }
      };
      s.photoObserver = new window.IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const row = entry.target,
              id = row.dataset.foodId;
            s.photoObserver.unobserve(row);
            const food = foodById(id);
            if (
              !food ||
              food.imageUrl ||
              food.detailsLoaded ||
              food.source !== 'tablycja' ||
              s.photoSeen.has(id) ||
              s.photoCount >= 12
            )
              continue;
            s.photoSeen.add(id);
            s.photoCount++;
            queue.push(food);
          }
          run();
        },
        { root: s === catalog ? null : container, rootMargin: '100px' }
      );
      for (const row of container.querySelectorAll('[data-food-id]')) s.photoObserver.observe(row);
    });
  }

  function refreshSearch(s) {
    const id = s === catalog ? 'catalog-results' : 'add-results';
    if ($('#' + id)) $('#' + id).innerHTML = searchResults(s, s === catalog ? 'catalog' : 'add');
    watchVisiblePhotos(s);
  }
  function cancelSearch(s) {
    if (!s) return;
    s.photoObserver?.disconnect();
    if (s.photoControllers) for (const controller of s.photoControllers) controller.abort();
    clearTimeout(s.timer);
    s.controller?.abort();
    s.generation++;
    s.busy = false;
  }
  async function scheduleSearch(s) {
    cancelSearch(s);
    s.remote = [];
    s.error = false;
    s.shown = 40;
    if (s.q.trim().length < 2 || s.filter !== 'all' || s.category !== 'all') {
      refreshSearch(s);
      return;
    }
    s.busy = true;
    refreshSearch(s);
    const generation = s.generation;
    await API.ready;
    if (generation !== s.generation) return;
    s.timer = setTimeout(async () => {
      const controller = new AbortController();
      s.controller = controller;
      const timeout = setTimeout(() => controller.abort('timeout'), 17000);
      try {
        const result = await API.search(s.q.trim(), state.lang, controller.signal);
        if (generation !== s.generation) return;
        s.remote = result.foods;
        for (const f of s.remote) remoteMap.set(f.id, f);
      } catch {
        if (generation === s.generation) s.error = true;
      } finally {
        clearTimeout(timeout);
        if (generation === s.generation) {
          s.busy = false;
          refreshSearch(s);
        }
      }
    }, API.delay());
  }
  function profileFields(p) {
    const year = new Date().getFullYear();
    return `<div class="field-grid"><label>${t('birthYear')}<input name="birthYear" type="number" inputmode="numeric" min="${year - 110}" max="${year - 1}" step="1" value="${p.birthYear || ''}" placeholder="2000" required></label><label>${t('sex')}<select name="sex"><option value="female" ${p.sex === 'female' ? 'selected' : ''}>${t('female')}</option><option value="male" ${p.sex === 'male' ? 'selected' : ''}>${t('male')}</option></select></label><label>${t('height')} (${t('cm')})<input name="height" type="number" inputmode="decimal" min="80" max="230" step=".1" value="${p.height}" required></label><label>${t('weight')} (${t('kg')})<input name="weight" type="number" inputmode="decimal" min="20" max="350" step=".1" value="${p.weight}" required></label></div><label class="gap-top">${t('activity')}<select name="activity">${Array.from({ length: 5 }, (_, i) => `<option value="${i}" ${p.activity === i ? 'selected' : ''}>${t('act' + i)}</option>`).join('')}</select></label><fieldset class="goal-options"><legend>${t('goal')}</legend>${['lose', 'maintain', 'gain'].map((g) => `<label class="goal-option"><input type="radio" name="goal" value="${g}" ${p.goal === g ? 'checked' : ''}><span>${t(g)}</span></label>`).join('')}</fieldset><label class="check-label"><input name="special" type="checkbox" ${p.special ? 'checked' : ''}><span>${t('manualPlan')}</span></label>`;
  }
  function renderOnboarding() {
    app.innerHTML = `<div class="onboarding"><aside class="onboard-art"><div class="art-content">${brand()}<h1>${t('setupTitle')}</h1></div></aside><main class="onboard-main" id="main"><div class="onboard-lang">${['uk', 'ru', 'en'].map((l) => action('lang', l.toUpperCase(), null, 'lang-btn' + (l === state.lang ? ' active' : ''), `data-lang="${l}"`)).join('')}</div><div class="onboard-form"><h2>${t('profile')}</h2><form id="setup-form" class="gap-top">${profileFields({ birthYear: null, sex: 'female', height: 170, weight: 65, activity: 1, goal: 'maintain', special: false })}<button class="btn full gap-top" type="submit">${t('begin')}${icon('arrow')}</button></form><p class="setup-privacy">${icon('lock')}${t('deviceStorage')}</p></div></main></div>`;
  }
  function settingsHTML() {
    return `${header(t('settings'))}<div class="settings-layout"><section class="panel settings-panel"><h2>${t('profile')}</h2><form id="edit-profile-form" class="gap-top">${profileFields(state.profile)}<button class="btn gap-top" type="submit">${t('saveProfile')}</button></form></section><section class="panel settings-panel" id="target-settings"><div class="between"><h2>${t('targets')}</h2>${ib('recalculate', 'activity', t('restoreAuto'))}</div><form id="targets-form" class="gap-top"><div class="settings-grid">${[
      ['kcal', 'kcal', 10000],
      ['p', 'protein', 1000],
      ['f', 'fat', 1000],
      ['c', 'carbs', 1000]
    ]
      .map(
        ([k, l, max]) =>
          `<label>${t(l)}${k === 'kcal' ? '' : ' (' + t('g') + ')'}<input name="${k}" type="number" min="0" max="${max}" step="1" inputmode="numeric" placeholder="—" value="${state.targets[k] ?? ''}"></label>`
      )
      .join(
        ''
      )}</div><div class="field-grid gap-top"><label>${t('waterGoal')} (${t('ml')})<input name="waterGoal" type="number" min="0" max="10000" step="50" value="${state.settings.waterGoal}" required></label><div class="save-cell"><button class="btn" type="submit">${t('save')}</button></div></div>${extraTargetFields()}</form></section><section class="panel settings-panel"><h2>${t('interface')}</h2><div class="setting-row"><label for="language">${t('language')}</label><select id="language">${[
      ['uk', 'Українська'],
      ['ru', 'Русский'],
      ['en', 'English']
    ]
      .map(([v, l]) => `<option value="${v}" ${state.lang === v ? 'selected' : ''}>${l}</option>`)
      .join('')}</select></div>${[
      ['reduce-motion', 'reduceMotion'],
      ['compact', 'compact']
    ]
      .map(
        ([id, key]) =>
          `<div class="setting-row"><label for="${id}">${t(key)}</label><input id="${id}" type="checkbox" class="switch" role="switch" ${state.settings[id === 'compact' ? 'compact' : 'reduceMotion'] ? 'checked' : ''}></div>`
      )
      .join(
        ''
      )}</section><section class="panel settings-panel"><h2>${t('data')}</h2><div class="data-buttons">${action('export', t('export'), 'download', 'btn secondary')}<label class="btn secondary file-label">${icon('upload')}${t('import')}<input id="import-file" type="file" accept="application/json,.json"></label>${action('import-catalog', t('importCatalog'), 'food', 'btn secondary')}</div><p class="help gap-top">${t('dataNote')}</p><details class="danger-zone"><summary>${t('reset')}</summary>${action('reset', t('reset'), 'trash', 'btn danger gap-top')}</details></section><section class="panel settings-panel"><div class="between"><h2>${t('about')}</h2><span class="pill">3.0</span></div><div class="about-links"><a href="https://www.tablycjakalorijnosti.com.ua/tablytsya-yizhyi" target="_blank" rel="noopener">Таблиця Калорійності ↗</a><a href="https://fdc.nal.usda.gov" target="_blank" rel="noopener">USDA ↗</a><a href="https://world.openfoodfacts.org" target="_blank" rel="noopener">Open Food Facts ↗</a></div><p class="source-foot">USDA: public domain · Open Food Facts: ODbL</p>${action('install', t('install'), 'download', 'btn secondary full gap-top')}</section></div>`;
  }
  function progressHTML() {
    return FUI.statsHTML();
  }

  function stopScanner() {
    scannerToken++;
    try {
      scannerControls?.stop();
    } catch {}
    scannerControls = null;
    const v = $('#scan-video');
    if (v?.srcObject) v.srcObject.getTracks().forEach((track) => track.stop());
  }
  function openModal(title, body, wide = false) {
    modalContext.detailController?.abort();
    stopScanner();
    cancelSearch(addSearch);
    addSearch = null;
    modalContext = {};
    modal.className = wide ? 'wide' : '';
    modal.innerHTML = `<div class="dialog-head"><h2 id="modal-title">${esc(title)}</h2>${ib('close-modal', 'close', t('close'))}</div>${body}`;
    if (!modal.open) modal.showModal();
  }
  function closeModal() {
    modalContext.detailController?.abort();
    stopScanner();
    cancelSearch(addSearch);
    addSearch = null;
    modalContext = {};
    modal.close();
  }
  function addFoodModal(meal = 0) {
    openModal(
      t('addFood'),
      `<div class="add-meal-control"><label for="add-meal">${t('meal')}</label><select id="add-meal">${Array.from({ length: 5 }, (_, i) => `<option value="${i}" ${i === meal ? 'selected' : ''}>${t('meal' + i)}</option>`).join('')}</select></div><div id="add-search-area"></div><div class="search-results" id="add-results"></div>`,
      true
    );
    addSearch = searchState();
    modalContext = { type: 'search', meal };
    $('#add-search-area').innerHTML = searchToolbar(addSearch, 'add');
    refreshSearch(addSearch);
    $('#add-search').focus();
  }

  function photoHTML(food, size = 'list') {
    const local = state.photos?.[food.photoId] || window.RATION_PRODUCT_IMAGES?.[food.id],
      fresh = remoteMap.get(food.id) || baseMap.get(food.id),
      url =
        local ||
        (size === 'list'
          ? food.thumbnailUrl || food.imageUrl || fresh?.thumbnailUrl || fresh?.imageUrl
          : food.imageUrl || food.thumbnailUrl || fresh?.imageUrl || fresh?.thumbnailUrl);
    const tag = size === 'list' ? 'button' : 'span',
      attrs =
        size === 'list'
          ? ` type="button" data-action="portion" data-id="${esc(food.id)}" aria-label="${esc(t('nutrition') + ' · ' + name(food))}"`
          : '';
    return `<${tag} class="product-photo photo-${size}${url ? ' has-image' : ''}"${attrs}><span class="photo-placeholder" aria-hidden="true">${icon(food.category === 'drink' ? 'drop' : food.category === 'veg' || food.category === 'fruit' ? 'leaf' : 'food')}</span>${url ? `<img src="${esc(url)}" alt="${esc(name(food))}" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ''}</${tag}>`;
  }
  function metricDial(key, label, value, target, mode = 'goal', compact = false, options = {}) {
    const known = N.known(value),
      unit = options.unit || t('g'),
      partial = !!options.partial,
      pct = known ? N.percent(value, target) : null,
      tone = N.tone(value, target, mode, !partial),
      r = 39,
      circ = 2 * Math.PI * r,
      fill = pct == null ? 0 : Math.min(100, Math.max(0, pct)),
      prefix = partial ? '≥ ' : '';
    const center = !known
      ? '—'
      : pct != null
        ? prefix + fmt(pct) + '<small>%</small>'
        : prefix + fmt(value, key === 'salt' ? 2 : 1) + `<small>${esc(unit)}</small>`;
    return `<div class="metric metric-${key} tone-${tone}${compact ? ' metric-compact' : ''}${!known ? ' metric-unknown' : ''}${known && pct === null ? ' metric-without-target' : ''}" data-nutrient="${key}"><div class="metric-dial"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="dial-bg" cx="50" cy="50" r="${r}"/><circle class="dial-fill" cx="50" cy="50" r="${r}" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - fill / 100)}"/></svg><strong>${center}</strong></div><b>${esc(label)}</b><span class="metric-amount">${known && pct !== null ? prefix + fmt(value, key === 'salt' ? 2 : 1) + ` <small>${esc(unit)}</small>` : known ? '' : '—'}</span><small class="metric-target">${!known ? t('noNutrientData') : target > 0 ? t('of') + ' ' + fmt(target, 1) + ' ' + esc(unit) : t('amountInPortion')}</small></div>`;
  }

  function dailyMacroHTML(total) {
    return `<div class="daily-macro-circles">${[
      ['p', 'protein', 'var(--protein)'],
      ['f', 'fat', 'var(--fat)'],
      ['c', 'carbs', 'var(--carbs)']
    ]
      .map(([key, label, color]) => {
        const target = state.targets[key],
          pct = N.percent(total[key], target);
        return `<div class="daily-macro" style="--macro-color:${color}"><span>${t(label)}</span><strong>${fmt(total[key], 1)}<small> / ${target == null ? '—' : fmt(target)} ${t('g')}</small></strong><div class="macro-track"><i style="width:${pct == null ? 0 : Math.min(100, pct)}%"></i></div></div>`;
      })
      .join('')}</div>`;
  }

  function dailyExtrasHTML() {
    const rows = N.extras.map((k) => ({ k, ...N.total(day().entries, k) })),
      micro = ['calcium', 'iron', 'potassium', 'vitaminC']
        .map((k) => ({ k, ...N.total(day().entries, k) }))
        .filter((r) => r.known > 0),
      incomplete = rows.some((r) => !r.complete) || micro.some((r) => !r.complete);
    return `<section class="daily-extras nutrient-group"><div class="nutrient-group-heading"><h3>${t('extraNutrients')}</h3><span class="info-dot" tabindex="0" title="${esc(t('referenceNote'))}">i</span></div><div class="extra-circle-grid">${rows.map((r) => metricDial(r.k, t(r.k), r.known || !r.count ? r.value : null, state.extraTargets[r.k], r.k === 'fiber' ? 'minimum' : 'reference', true, { partial: !r.complete })).join('')}${micro.map((r) => metricDial(r.k, t(r.k), r.value, null, 'goal', true, { unit: t('mg'), partial: !r.complete })).join('')}</div>${incomplete ? `<p class="coverage-note">${t('partialNutrients')}</p>` : ''}</section>`;
  }

  function portionNutrition(food, grams) {
    const amount = (k) => (N.known(food[k]) ? (food[k] * grams) / 100 : null),
      energy = (food.kcal * grams) / 100,
      ep = N.percent(energy, state.targets.kcal),
      ctx = modalContext,
      date = $('#portion-form [name=date]')?.value || selectedDate,
      others = day(date).entries.filter((e) => e.id !== ctx.entryId),
      projected = C.total(others).kcal + energy,
      projectedPercent = N.percent(projected, state.targets.kcal),
      mix = N.distribution(food),
      micro = ['calcium', 'iron', 'potassium', 'vitaminC'].filter((k) => N.known(food[k]));
    return `<section class="portion-energy tone-${N.tone(energy, state.targets.kcal)}"><div><span class="nutrition-overline">${t('inThisPortion')}</span><strong>${fmt(energy)} <small>${t('kcal')}</small></strong></div><div class="portion-daily"><strong>${ep == null ? '—' : fmt(ep) + '%'}</strong><span>${t('ofDailyTarget')}</span></div><div class="energy-track"><span style="width:${ep == null ? 0 : Math.min(100, ep)}%"></span></div></section><section class="nutrient-group primary-nutrients"><div class="nutrient-group-heading"><h3>${t('dailyContribution')}</h3><span>${fmt(grams, 1)} ${FUI.unitLabel(C.basis(food))}</span></div><div class="portion-macros">${[
      ['p', 'protein'],
      ['f', 'fat'],
      ['c', 'carbs']
    ]
      .map(([k, l]) => metricDial(k, t(l), amount(k), state.targets[k]))
      .join(
        ''
      )}</div></section><section class="product-extras nutrient-group"><div class="nutrient-group-heading"><h3>${t('extraNutrients')}</h3><span class="info-dot" tabindex="0" title="${esc(t('referenceNote'))}">i</span></div><div class="extra-circle-grid">${N.extras.map((k) => metricDial(k, t(k), amount(k), state.extraTargets[k], k === 'fiber' ? 'minimum' : 'reference', true)).join('')}${micro.map((k) => metricDial(k, t(k), amount(k), null, 'goal', true, { unit: t('mg') })).join('')}</div></section><details class="composition-detail"><summary>${t('energyComposition')}</summary><div class="energy-split" role="img" aria-label="${esc(t('protein') + ' ' + fmt(mix.p) + '%, ' + t('fat') + ' ' + fmt(mix.f) + '%, ' + t('carbs') + ' ' + fmt(mix.c) + '%')}">${[
      ['p', 'var(--purple)'],
      ['f', 'var(--orange)'],
      ['c', 'var(--blue)']
    ]
      .map(([k, color]) => `<span style="width:${mix[k]}%;background:${color}"></span>`)
      .join('')}</div><div class="split-legend">${[
      ['p', 'protein'],
      ['f', 'fat'],
      ['c', 'carbs']
    ]
      .map(([k, l]) => `<span>${t(l)} <b>${fmt(mix[k], 1)}%</b></span>`)
      .join(
        ''
      )}</div></details>${projectedPercent == null ? '' : `<div class="day-projection tone-${N.tone(projected, state.targets.kcal)}"><span>${t('dayAfterAdding')}</span><strong>${fmt(projected)} / ${fmt(state.targets.kcal)} ${t('kcal')} <small>${fmt(projectedPercent)}%</small></strong></div>`}`;
  }

  function refreshPortion() {
    if (modalContext.type !== 'portion') return;
    let result = null;
    try {
      result = FUI.readPortion();
    } catch {}
    FUI.refreshConversion(result);
    const el = $('#portion-nutrition');
    if (el) el.innerHTML = result
      ? portionNutrition(result.food, result.grams)
      : `<p class="empty-inline">${t('calibratePortion')}</p>`;
  }

  function productHeading(food) {
    return `${action('edit-food', '', 'edit', 'product-edit icon-btn', `data-id="${esc(food.id)}" aria-label="${t('editFood')}"`)}${photoHTML(food, 'hero')}<div class="product-heading-copy"><h3>${esc(name(food))}</h3><small class="muted">${esc(sourceName(food))}${food.brand && food.brand.toLowerCase() !== name(food).toLowerCase() ? ' · ' + esc(food.brand) : ''}</small><div class="product-badges">${food.nutriScore ? `<span class="nutri-score nutri-${food.nutriScore}">Nutri-Score ${food.nutriScore.toUpperCase()}</span>` : ''}${(food.source === 'off' || food.imageSource === 'off') && food.imageUrl ? `<a href="${esc(food.sourceUrl)}" target="_blank" rel="noopener" class="photo-credit">${t('photoSource')}: Open Food Facts</a>` : ''}</div><span id="product-detail-status" class="product-detail-status"></span></div>`;
  }
  async function hydrateProduct() {
    const ctx = modalContext;
    if (
      ctx.type !== 'portion' ||
      !API.details ||
      ctx.food.detailsLoaded ||
      !['off', 'tablycja'].includes(ctx.food.source)
    )
      return;
    const controller = new AbortController();
    const detailTimer = setTimeout(() => controller.abort(), 15000);
    ctx.detailController = controller;
    const indicator = $('#product-detail-status');
    if (indicator) indicator.innerHTML = '<i class="load-spinner"></i>';
    try {
      const fresh = await API.details(ctx.food, controller.signal);
      if (modalContext !== ctx || controller.signal.aborted || !fresh) return;
      const updated = { ...ctx.food, ...fresh, detailsLoaded: true };
      if (ctx.entryId) {
        for (const key of ['kcal', 'p', 'f', 'c']) updated[key] = ctx.food[key];
      }
      if (!C.validFood(updated)) return;
      ctx.food = updated;
      remoteMap.set(updated.id, updated);
      const base = baseMap.get(updated.id);
      if (base) Object.assign(base, updated);
      const custom = state.customFoods.find((f) => f.id === updated.id);
      if (custom) {
        Object.assign(custom, updated);
        persist();
      }
      const heading = $('.dialog-food-name');
      if (heading) heading.innerHTML = productHeading(updated);
      refreshPortion();
    } catch {
    } finally {
      clearTimeout(detailTimer);
      if (modalContext === ctx && $('#product-detail-status'))
        $('#product-detail-status').textContent = '';
    }
  }
  function extraTargetFields() {
    return `<details class="extra-target-settings"><summary>${t('extraTargets')}</summary><p class="help">${t('referenceNote')}</p><div class="settings-grid">${N.extras.map((k) => `<label>${t(k)} (${t('g')})<input name="extra-${k}" type="number" min="0" max="1000" step=".1" placeholder="—" value="${state.extraTargets[k] ?? ''}"></label>`).join('')}</div></details>`;
  }

  function portionModal(food, entry = null, date = selectedDate, meal = modalContext.meal ?? 0) {
    if (!food) return;
    if (!C.validFood(food)) {
      completionModal(food, meal, food.barcode || '');
      return;
    }
    const ingredient = FUI.isPicking();
    openModal(
      ingredient ? t('ingredientAdd') : entry ? t('editEntry') : t('addFood'),
      `<div class="dialog-food-name">${productHeading(food)}</div><form id="portion-form">${FUI.portionFields(food, entry, meal)}<label>${t('date')}<input name="date" type="date" value="${date}" required></label><div class="nutrition-grid" id="portion-nutrition"></div>${food.sourceUrl ? `<a class="source-foot" href="${esc(food.sourceUrl)}" target="_blank" rel="noopener">${t('source')} ↗</a>` : ''}<div class="dialog-actions">${action('back-search', t('back'), 'left', 'btn secondary', `data-meal="${meal}"`)}<button class="btn" type="submit">${icon('check')}${t(ingredient ? 'ingredientAdd' : entry ? 'save' : 'add')}</button></div></form>`
    );
    modalContext = {
      type: 'portion',
      food: structuredClone(food),
      entryId: entry?.id,
      originalDate: date,
      meal,
      recipeIngredient: ingredient
    };
    FUI.syncUnits();
    refreshPortion();
    hydrateProduct();
    $('#portion-grams').select();
  }
  function completionModal(food, meal = modalContext.meal ?? 0, code = food.barcode || '') {
    const found = !!food.sourceUrl;
    openModal(
      found ? t('completeLabel') : t('addByBarcode'),
      `<div class="dialog-food-name">${photoHTML(food, 'hero')}<div class="product-heading-copy"><h3>${esc(found ? name(food) : t('newFood'))}</h3><small class="muted">${esc(code)}</small></div></div><p class="completion-note">${t(found ? 'foundIncomplete' : 'barcodeAbsent')}</p><form id="complete-food-form"><label>${t('foodName')}<input name="name" maxlength="200" value="${esc(found ? name(food) : '')}" required></label><div class="field-grid gap-top">${[
        ['kcal', 'kcal', 1000],
        ['p', 'protein', 100],
        ['f', 'fat', 100],
        ['c', 'carbs', 100]
      ]
        .map(
          ([k, l, max]) =>
            `<label>${t(l)} · ${t('per100')}<input name="${k}" type="number" min="0" max="${max}" step=".1" inputmode="decimal" value="${N.known(food[k]) ? food[k] : ''}" required></label>`
        )
        .join(
          ''
        )}</div>${food.plainWaterCandidate ? action('plain-water', t('plainWater'), 'drop', 'btn secondary full gap-top') : ''}<div class="dialog-actions">${action('close-modal', t('cancel'), null, 'btn secondary')}<button type="submit" class="btn">${t('saveLabel')}</button></div></form>`
    );
    modalContext = { type: 'completion', food: structuredClone(food), meal, code };
  }
  function unknownBarcodeModal(code, meal = modalContext.meal ?? 0) {
    completionModal(
      {
        id: 'custom-barcode-' + code,
        names: [code, code, code],
        kcal: null,
        p: null,
        f: null,
        c: null,
        source: 'custom',
        category: 'other',
        emoji: '🍽️',
        barcode: code
      },
      meal,
      code
    );
  }
  function customFoodModal() {
    const meal = modalContext.meal ?? 0;
    openModal(
      t('createFood'),
      `<form id="custom-food-form"><label>${t('foodName')}<input name="name" maxlength="200" required></label><p class="help gap-top">${t('per100')}</p><div class="field-grid gap-top">${[
        ['kcal', 'kcal', 1000],
        ['p', 'protein', 100],
        ['f', 'fat', 100],
        ['c', 'carbs', 100]
      ]
        .map(
          ([k, l, max]) =>
            `<label>${t(l)}<input name="${k}" type="number" min="0" max="${max}" step=".1" inputmode="decimal" required></label>`
        )
        .join(
          ''
        )}</div><details class="extra-target-settings"><summary>${t('extraNutrients')}</summary><div class="field-grid gap-top">${N.extras.map((k) => `<label>${t(k)} (${t('g')})<input name="food-${k}" type="number" min="0" max="100" step=".01" inputmode="decimal" placeholder="—"></label>`).join('')}</div></details><div class="dialog-actions"><button class="btn" type="submit">${t('save')}</button></div></form>`
    );
    modalContext = { type: 'custom', meal };
  }
  function confirmation(message, callback) {
    openModal(
      t('confirmTitle'),
      `<p>${esc(message)}</p><div class="dialog-actions">${action('close-modal', t('cancel'), null, 'btn secondary')}${action('confirm', t('done'), 'check', 'btn danger')}</div>`
    );
    modalContext = { type: 'confirm', callback };
  }
  function logWeightModal() {
    openModal(
      t('logWeight'),
      `<form id="weight-form"><div class="field-grid"><label>${t('weight')} (${t('kg')})<input name="value" type="number" min="20" max="350" step=".1" inputmode="decimal" value="${state.weights.at(-1)?.value ?? state.profile.weight}" required></label><label>${t('date')}<input name="date" type="date" value="${C.dateKey()}" required></label></div><div class="dialog-actions"><button class="btn" type="submit">${t('save')}</button></div></form>`
    );
  }
  async function loadZXing() {
    if (window.ZXingBrowser) return window.ZXingBrowser;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'vendor/zxing-browser.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.append(s);
    });
    return window.ZXingBrowser;
  }
  function scannerModal() {
    const meal = modalContext.meal ?? 0;
    openModal(
      t('scan'),
      `<p class="help" style="margin-bottom:16px">${t('scanSub')}</p><div class="camera-frame"><video id="scan-video" playsinline muted autoplay></video><div class="scan-guide"></div></div><div class="grid2">${action('start-camera', t('startCamera'), 'camera', 'btn secondary')}${action('stop-camera', t('stopCamera'), null, 'btn secondary')}</div><label class="btn ghost full file-label" style="margin-top:10px">${icon('upload')}${t('uploadCode')}<input id="barcode-image" type="file" accept="image/*" capture="environment"></label><p id="scan-status" class="help" role="status" style="margin-top:13px"></p><form id="barcode-form" class="barcode-form gap-top"><label>${t('manualCode')}<input name="code" id="barcode-input" type="text" inputmode="numeric" pattern="[0-9]{8,14}" minlength="8" maxlength="14" required autocomplete="off" placeholder="4820000000000"></label><button class="btn" type="submit">${t('lookup')}</button></form>`
    );
    modalContext = { type: 'scan', meal };
  }
  async function startCamera() {
    stopScanner();
    const token = scannerToken;
    const status = $('#scan-status'),
      button = $('[data-action="start-camera"]');
    if (button) button.disabled = true;
    status.textContent = t('loading');
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext)
        throw Error('secure context');
      const z = await loadZXing();
      if (token !== scannerToken || !modal.open) return;
      const reader = new z.BrowserMultiFormatReader();
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        $('#scan-video'),
        (result, error, ctrl) => {
          if (result && token === scannerToken) {
            ctrl.stop();
            const code = result.getText();
            stopScanner();
            lookupBarcode(code);
          }
        }
      );
      if (token !== scannerToken) {
        controls.stop();
        return;
      }
      scannerControls = controls;
      status.textContent = t('scanSub');
    } catch {
      if (token === scannerToken && $('#scan-status')) status.textContent = t('cameraError');
    } finally {
      if (button?.isConnected) button.disabled = false;
    }
  }
  async function scanImage(file) {
    const token = scannerToken,
      status = $('#scan-status');
    if (!file) return;
    status.textContent = t('loading');
    let url;
    try {
      const z = await loadZXing();
      if (token !== scannerToken) return;
      url = URL.createObjectURL(file);
      const reader = new z.BrowserMultiFormatReader();
      const result = await reader.decodeFromImageUrl(url);
      if (token === scannerToken) await lookupBarcode(result.getText());
    } catch {
      if (token === scannerToken && status.isConnected) status.textContent = t('scanPhotoError');
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  }

  let barcodeBusy = false,
    lastBarcode = 0;
  async function lookupBarcode(raw) {
    const code = String(raw).replace(/\D/g, '');
    if (!C.barcodeKey(code)) {
      toast(t('required'), true);
      return;
    }
    const meal = modalContext.meal ?? 0;
    const key = C.barcodeKey(code),
      local = foodList()
        .filter((f) => f.barcode && C.barcodeKey(f.barcode) === key)
        .sort(
          (a, b) =>
            Number(C.validFood(b)) - Number(C.validFood(a)) ||
            Number(!!b.personalized) - Number(!!a.personalized)
        )[0];
    if (local) {
      stopScanner();
      portionModal(local, null, selectedDate, meal);
      return;
    }
    if (barcodeBusy) return;
    if (Date.now() - lastBarcode < 4200) {
      toast(t('rateLimit'), true);
      return;
    }
    stopScanner();
    lastBarcode = Date.now();
    barcodeBusy = true;
    const token = scannerToken,
      status = $('#scan-status');
    modalContext.lookupCode = code;
    if (status) status.textContent = t('loading');
    try {
      const food = await API.barcode(code, AbortSignal.timeout(20000));
      if (token !== scannerToken || !modal.open) return;
      if (!food) {
        unknownBarcodeModal(code, meal);
        return;
      }
      remoteMap.set(food.id, food);
      portionModal(food, null, selectedDate, meal);
    } catch {
      if (token === scannerToken && status?.isConnected)
        status.innerHTML = `${esc(t('searchUnavailable'))}${action('manual-barcode', t('addByBarcode'), 'plus', 'btn secondary full gap-top', `data-code="${esc(code)}"`)}`;
    } finally {
      barcodeBusy = false;
    }
  }

  function storeFood(f) {
    const existing = state.customFoods.find((x) => x.id === f.id);
    if (existing) {
      Object.assign(existing, structuredClone(f));
      return true;
    }
    if (
      !baseMap.has(f.id) ||
      f.source === 'custom' ||
      f.personalized ||
      !C.validFood(baseMap.get(f.id))
    ) {
      if (state.customFoods.length >= 20000) return false;
      state.customFoods.push(structuredClone(f));
    }
    return true;
  }
  function download(blob, filename) {
    const url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  function exportBackup() {
    download(
      new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }),
      'mii-ratsion-backup-' + C.dateKey() + '.json'
    );
  }
  async function importBackup(file) {
    try {
      if (!file || file.size > 25 * 1024 * 1024) throw Error();
      const data = C.migrate(JSON.parse(await file.text()));
      confirmation(t('importConfirm'), () => {
        cancelSearch(catalog);
        state = data;
        persist();
        closeModal();
        render();
        toast(t('saved'));
      });
    } catch {
      toast(t('importError'), true);
    }
  }
  function importCatalogModal() {
    openModal(
      t('importCatalog'),
      `<p class="help">${t('catalogFormat')}</p><label class="btn full file-label gap-top">${icon('upload')}${t('chooseFile')}<input id="catalog-file" type="file" accept=".csv,.tsv,.json,text/csv,application/json"></label><div class="dialog-actions">${action('csv-template', t('downloadTemplate'), 'download', 'btn secondary')}</div>`
    );
  }
  async function importCatalog(file) {
    try {
      if (!file || file.size > 15 * 1024 * 1024) throw Error();
      const foods = C.importFoods(await file.text());
      if (state.customFoods.length + foods.length > 20000) throw Error();
      const existing = new Set(
          foodList().map((f) => C.normalize(f.names[0]) + ':' + [f.kcal, f.p, f.f, f.c].join('/'))
        ),
        fresh = foods.filter((f) => {
          const k = C.normalize(f.names[0]) + ':' + [f.kcal, f.p, f.f, f.c].join('/');
          if (existing.has(k)) return false;
          existing.add(k);
          return true;
        });
      openModal(
        t('importCatalog'),
        `<p>${fmt(fresh.length)} ${t('readyToImport')}</p><div class="dialog-actions">${action('close-modal', t('cancel'), null, 'btn secondary')}${action('confirm-import', t('add'), 'check', 'btn')}</div>`
      );
      modalContext = { foods: fresh };
    } catch {
      toast(t('catalogImportError'), true);
    }
  }
  function navigate(target, initialFilter) {
    cancelSearch(catalog);
    page = target;
    if (page === 'foods' && initialFilter) catalog.filter = initialFilter;
    render();
    if (page === 'foods') watchVisiblePhotos(catalog);
    window.scrollTo(0, 0);
  }
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-action]');
    if (!b || b.disabled) return;
    if (FUI.click(b)) return;
    switch (b.dataset.action) {
      case 'show-foods':
        navigate('foods');
        break;
      case 'show-recipes':
        navigate('recipes');
        break;
      case 'select-day':
        if (C.validDate(b.dataset.date)) {
          selectedDate = b.dataset.date;
          render();
        }
        break;
      case 'nav':
        navigate(b.dataset.page, b.dataset.filter);
        break;
      case 'profile':
        navigate('settings');
        break;
      case 'add-food':
      case 'back-search':
        addFoodModal(Number(b.dataset.meal || 0));
        break;
      case 'portion':
        portionModal(foodById(b.dataset.id));
        break;
      case 'preset':
        $('#portion-grams').value = b.dataset.grams;
        refreshPortion();
        break;
      case 'edit-entry': {
        const x = day().entries.find((x) => x.id === b.dataset.id);
        if (x) portionModal(x.food, x);
        break;
      }
      case 'delete-entry': {
        const date = selectedDate,
          d = ensureDay(date),
          i = d.entries.findIndex((x) => x.id === b.dataset.id);
        if (i < 0) break;
        const [record] = d.entries.splice(i, 1);
        persist();
        render();
        toast(t('removed'), false, () => {
          ensureDay(date).entries.splice(i, 0, record);
          persist();
          render();
        });
        break;
      }
      case 'undo': {
        const fn = undoAction;
        undoAction = null;
        $('#toast').className = '';
        if (fn) fn();
        break;
      }
      case 'water': {
        const d = ensureDay();
        if (d.water.length < 100) d.water.push(Number(b.dataset.value));
        persist();
        render();
        break;
      }
      case 'water-undo':
        ensureDay().water.pop();
        persist();
        render();
        break;
      case 'date-prev':
      case 'date-next': {
        const d = new Date(selectedDate + 'T12:00:00');
        d.setDate(d.getDate() + (b.dataset.action === 'date-prev' ? -1 : 1));
        selectedDate = C.dateKey(d);
        render();
        break;
      }
      case 'today':
        selectedDate = C.dateKey();
        render();
        break;
      case 'favorite': {
        const f = foodById(b.dataset.id);
        if (!f) break;
        if (!C.validFood(f)) {
          completionModal(f);
          break;
        }
        if (!storeFood(f)) {
          toast(t('required'), true);
          break;
        }
        state.favorites = state.favorites.includes(f.id)
          ? state.favorites.filter((id) => id !== f.id)
          : [...state.favorites, f.id];
        persist();
        refreshSearch(catalog);
        if (addSearch) refreshSearch(addSearch);
        break;
      }
      case 'search-filter': {
        const s = b.dataset.mode === 'catalog' ? catalog : addSearch;
        if (!s) break;
        s.filter = b.dataset.filter;
        scheduleSearch(s);
        b.parentElement.querySelectorAll('[data-filter]').forEach((x) => {
          x.classList.toggle('active', x.dataset.filter === s.filter);
          x.setAttribute('aria-pressed', String(x.dataset.filter === s.filter));
        });
        break;
      }
      case 'more': {
        const s = b.dataset.mode === 'catalog' ? catalog : addSearch;
        s.shown += 60;
        refreshSearch(s);
        break;
      }
      case 'plain-water':
        for (const key of ['kcal', 'p', 'f', 'c'])
          $('#complete-food-form [name=' + key + ']').value = '0';
        break;
      case 'manual-barcode':
        unknownBarcodeModal(b.dataset.code);
        break;
      case 'create-food':
        customFoodModal();
        break;
      case 'scan':
        scannerModal();
        break;
      case 'start-camera':
        await startCamera();
        break;
      case 'stop-camera':
        stopScanner();
        if ($('#scan-status')) $('#scan-status').textContent = '';
        break;
      case 'close-modal':
        closeModal();
        break;
      case 'confirm':
        modalContext.callback?.();
        break;
      case 'lang': {
        const form = $('#setup-form'),
          values = form ? new FormData(form) : null;
        state.lang = b.dataset.lang;
        persist();
        render();
        if (values) {
          for (const el of $('#setup-form').querySelectorAll('[name]')) {
            if (el.type === 'radio') el.checked = values.get(el.name) === el.value;
            else if (el.type === 'checkbox') el.checked = values.get(el.name) === 'on';
            else if (values.has(el.name)) el.value = values.get(el.name);
          }
        }
        break;
      }
      case 'log-weight':
        logWeightModal();
        break;
      case 'delete-weight': {
        const old = state.weights.find((w) => w.date === b.dataset.date);
        state.weights = state.weights.filter((w) => w.date !== b.dataset.date);
        persist();
        render();
        toast(t('removed'), false, () => {
          state.weights.push(old);
          persist();
          render();
        });
        break;
      }
      case 'copy-day': {
        const d = new Date(selectedDate + 'T12:00:00');
        d.setDate(d.getDate() - 1);
        const rows = day(C.dateKey(d)).entries;
        if (!rows.length) {
          toast(t('noEntries'));
          break;
        }
        const date = selectedDate;
        if (day(date).entries.length + rows.length > 500) {
          toast(t('required'), true);
          break;
        }
        confirmation(t('copyConfirm'), () => {
          ensureDay(date).entries.push(
            ...rows.map((x) => ({ ...structuredClone(x), id: uid(), loggedOn: C.dateKey() }))
          );
          persist();
          closeModal();
          render();
          toast(t('saved'));
        });
        break;
      }
      case 'recalculate':
        state.targets = C.calculate(state.profile);
        persist();
        render();
        toast(t('saved'));
        break;
      case 'export':
        exportBackup();
        break;
      case 'import-catalog':
        importCatalogModal();
        break;
      case 'csv-template':
        download(
          new Blob(['name,kcal,p,f,c\nExample,100,5,2,15\n'], { type: 'text/csv;charset=utf-8' }),
          'foods-template.csv'
        );
        break;
      case 'confirm-import':
        state.customFoods.push(...modalContext.foods);
        persist();
        closeModal();
        render();
        toast(t('saved'));
        break;
      case 'reset':
        confirmation(t('resetConfirm'), () => {
          state = C.defaults();
          persist();
          closeModal();
          catalog = searchState();
          render();
        });
        break;
      case 'install':
        if (installPrompt) {
          installPrompt.prompt();
          await installPrompt.userChoice;
          installPrompt = null;
        } else openModal(t('install'), `<p class="help">${t('installHelp')}</p>`);
        break;
    }
  });
  document.addEventListener('input', (e) => {
    const id = e.target.id;
    if (id === 'catalog-search' || id === 'add-search') {
      const s = id === 'catalog-search' ? catalog : addSearch;
      s.q = e.target.value;
      scheduleSearch(s);
    } else if (id === 'portion-grams' || id === 'portion-size') refreshPortion();
    else if (['recipe-yield', 'recipe-servings'].includes(id)) FUI.onRecipeInput(id);
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.id === 'portion-unit') {
      FUI.syncUnits(true);
      refreshPortion();
      return;
    }
    if (['food-photo-file', 'recipe-photo-file'].includes(el.id)) {
      FUI.changePhoto(el.files?.[0]);
      return;
    }
    if (el.id === 'diary-date' && C.validDate(el.value)) {
      selectedDate = el.value;
      render();
    } else if (el.id === 'language') {
      cancelSearch(catalog);
      state.lang = el.value;
      persist();
      render();
      if (page === 'foods' && catalog.q) scheduleSearch(catalog);
    } else if (el.id === 'catalog-category' || el.id === 'add-category') {
      const s = el.id === 'catalog-category' ? catalog : addSearch;
      s.category = el.value;
      scheduleSearch(s);
    } else if (el.id === 'add-meal') modalContext.meal = Number(el.value);
    else if (el.id === 'import-file') importBackup(el.files[0]);
    else if (el.id === 'catalog-file') importCatalog(el.files[0]);
    else if (el.id === 'barcode-image') scanImage(el.files[0]);
    else if (['compact', 'reduce-motion'].includes(el.id)) {
      state.settings[el.id === 'compact' ? 'compact' : 'reduceMotion'] = el.checked;
      persist();
      preferences();
    }
  });
  function readProfile(f) {
    return {
      birthYear: Number(f.get('birthYear')),
      sex: String(f.get('sex')),
      height: Number(f.get('height')),
      weight: Number(f.get('weight')),
      activity: Number(f.get('activity')),
      goal: String(f.get('goal')),
      special: f.get('special') === 'on'
    };
  }
  document.addEventListener('submit', async (e) => {
    const form = e.target;
    if (!form.id) return;
    e.preventDefault();
    if (!form.reportValidity()) return;
    const f = new FormData(form);
    if (FUI.submit(form, f)) return;
    switch (form.id) {
      case 'setup-form':
      case 'edit-profile-form': {
        const p = readProfile(f);
        if (!C.validProfile(p)) {
          toast(t('required'), true);
          break;
        }
        const first = !state.profile;
        state.profile = p;
        if (first || state.targets.mode !== 'manual') state.targets = C.calculate(p);
        if (first) state.weights.push({ date: C.dateKey(), value: p.weight });
        persist();
        render();
        if (first) window.scrollTo(0, 0);
        if (!first) toast(t('saved'));
        break;
      }
      case 'targets-form': {
        const targets = { mode: 'manual' };
        for (const k of ['kcal', 'p', 'f', 'c'])
          targets[k] = f.get(k) === '' ? null : Number(f.get(k));
        state.targets = targets;
        for (const key of N.extras)
          if (f.has('extra-' + key))
            state.extraTargets[key] =
              f.get('extra-' + key) === '' ? null : Number(f.get('extra-' + key));
        state.settings.waterGoal = Number(f.get('waterGoal'));
        persist();
        render();
        toast(t('saved'));
        break;
      }
      case 'portion-form': {
        const ctx = modalContext;
        let selected;
        try {
          selected = FUI.readPortion();
        } catch {
          toast(t('required'), true);
          break;
        }
        if (ctx.recipeIngredient) {
          FUI.captureIngredient(selected);
          break;
        }
        const grams = selected.grams,
          meal = Number(f.get('meal')),
          date = String(f.get('date'));
        if (
          !C.validDate(date) ||
          !Number.isInteger(meal) ||
          meal < 0 ||
          meal > 4 ||
          day(date).entries.filter((entry) => entry.id !== ctx.entryId).length >= 500 ||
          !C.validFood(selected.food)
        ) {
          toast(t('required'), true);
          break;
        }
        const old = ctx.entryId
          ? day(ctx.originalDate).entries.find((entry) => entry.id === ctx.entryId)
          : null;
        const record = {
          id: ctx.entryId || uid(),
          food: structuredClone(selected.food),
          grams,
          amount: selected.amount,
          unit: selected.unit,
          meal,
          loggedOn:
            old && date === ctx.originalDate ? old.loggedOn || ctx.originalDate : C.dateKey()
        };
        if (!storeFood(record.food)) {
          toast(t('required'), true);
          break;
        }
        if (ctx.entryId)
          ensureDay(ctx.originalDate).entries = day(ctx.originalDate).entries.filter(
            (entry) => entry.id !== ctx.entryId
          );
        ensureDay(date).entries.push(record);
        selectedDate = date;
        persist();
        closeModal();
        render();
        toast(t(ctx.entryId ? 'saved' : 'added'));
        break;
      }
      case 'custom-food-form': {
        const n = String(f.get('name')).trim(),
          food = {
            id: 'custom-' + uid(),
            names: [n, n, n],
            kcal: Number(f.get('kcal')),
            p: Number(f.get('p')),
            f: Number(f.get('f')),
            c: Number(f.get('c')),
            category: 'other',
            source: 'custom',
            emoji: '🍽️'
          };
        for (const key of N.extras) {
          const value = f.get('food-' + key);
          if (value !== null && value !== '') food[key] = Number(value);
        }
        if (!C.validFood(food) || state.customFoods.length >= 20000) {
          toast(t('required'), true);
          break;
        }
        const meal = modalContext.meal;
        state.customFoods.push(food);
        persist();
        if (page === 'foods') render();
        portionModal(food, null, selectedDate, meal);
        break;
      }
      case 'weight-form': {
        const date = String(f.get('date')),
          value = Number(f.get('value'));
        if (
          !C.validDate(date) ||
          !Number.isFinite(value) ||
          value < 20 ||
          value > 350 ||
          (!state.weights.some((w) => w.date === date) && state.weights.length >= 19999)
        ) {
          toast(t('required'), true);
          break;
        }
        state.weights = state.weights.filter((w) => w.date !== date);
        state.weights.push({ date, value });
        persist();
        closeModal();
        render();
        toast(t('saved'));
        break;
      }
      case 'complete-food-form': {
        const ctx = modalContext,
          n = String(f.get('name') || '').trim();
        if (
          !n ||
          ['kcal', 'p', 'f', 'c'].some((k) => f.get(k) === null || String(f.get(k)).trim() === '')
        ) {
          toast(t('required'), true);
          break;
        }
        const completed = {
          ...ctx.food,
          names: [n, n, n],
          source: 'custom',
          originSource: ctx.food.source,
          imageSource: ctx.food.imageSource || (ctx.food.source === 'off' ? 'off' : undefined),
          barcode: ctx.code || ctx.food.barcode,
          kcal: Number(f.get('kcal')),
          p: Number(f.get('p')),
          f: Number(f.get('f')),
          c: Number(f.get('c')),
          nutritionIncomplete: false,
          detailsLoaded: true
        };
        if (!C.validFood(completed)) {
          toast(t('required'), true);
          break;
        }
        if (!storeFood(completed)) {
          toast(t('required'), true);
          break;
        }
        persist();
        remoteMap.set(completed.id, completed);
        portionModal(completed, null, selectedDate, ctx.meal);
        break;
      }
      case 'barcode-form':
        await lookupBarcode(String(f.get('code')));
        break;
    }
  });
  modal.addEventListener('cancel', (event) => {
    if (FUI.isPicking()) {
      event.preventDefault();
      FUI.cancelPicking();
      return;
    }
    modalContext.detailController?.abort();
    stopScanner();
    cancelSearch(addSearch);
    addSearch = null;
    modalContext = {};
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopScanner();
  });
  window.addEventListener('pagehide', () => {
    stopScanner();
    cancelSearch(catalog);
    cancelSearch(addSearch);
  });
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
  });
  document.addEventListener(
    'error',
    (e) => {
      if (e.target.matches?.('.product-photo img')) {
        e.target.hidden = true;
        e.target.parentElement.classList.remove('has-image');
      }
    },
    true
  );
  document.addEventListener('change', (e) => {
    if (e.target.matches('#portion-form [name=date]')) refreshPortion();
  });
  const FUI = window.RationFeatureUI({
    state: () => state,
    context: () => modalContext,
    setContext: (value) => (modalContext = value),
    date: () => selectedDate,
    t,
    fmt,
    name,
    esc,
    icon,
    action,
    photo: photoHTML,
    find: foodById,
    list: foodList,
    open: openModal,
    close: closeModal,
    save: persist,
    render,
    notify: toast,
    uid,
    openSearch: addFoodModal
  });
  document.addEventListener(
    'toggle',
    (event) => {
      if (
        event.target.id === 'daily-nutrients' &&
        state.settings.extrasOpen !== event.target.open
      ) {
        state.settings.extrasOpen = event.target.open;
        persist();
      }
    },
    true
  );
  let localDay = C.dateKey();
  function checkLocalDay() {
    const next = C.dateKey();
    if (next !== localDay) {
      if (selectedDate === localDay) selectedDate = next;
      localDay = next;
      render();
      if (state.profile) persist();
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkLocalDay();
  });
  window.addEventListener('focus', checkLocalDay);
  function watchMidnight() {
    const timer = setTimeout(() => {
      checkLocalDay();
      watchMidnight();
    }, 60000);
    timer?.unref?.();
  }
  watchMidnight();
  render();
  if (page === 'foods') watchVisiblePhotos(catalog);
  if (state.profile && !storageFailure) persist();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol))
    navigator.serviceWorker.register('./sw.js').catch(() => {});
})();
