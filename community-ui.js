/* Optional local profile, streak calendar and private, on-device label scanning. */
(function () {
  const baseFactory = window.RationFeatureUI;
  window.RationFeatureUI = function (env) {
    const base = baseFactory(env),
      C = window.RationCore,
      N = window.RationNutrition;
    const { state, t, esc, icon, action, open, close, save, render, notify, uid } = env;
    const $ = (s) => document.querySelector(s);
    let month = C.dateKey().slice(0, 7),
      previous = C.streak(state()),
      milestone = 0;
    const dayWord = (count) =>
      t(
        count % 10 === 1 && count % 100 !== 11
          ? 'streakDayOne'
          : [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)
            ? 'streakDayFew'
            : 'streakDayMany'
      );
    const locale = () => ({ uk: 'uk-UA', ru: 'ru-RU', en: 'en-GB' })[state().lang];
    const avatar = (profile) =>
      `<span class="local-avatar avatar-${profile?.color || 'mint'}" aria-hidden="true">${profile ? esc([...profile.displayName.trim()][0].toUpperCase()) : icon('food')}</span>`;
    function localProfileHTML() {
      const profile = state().localProfile;
      return `<section class="panel local-profile-card">${avatar(profile)}<div><p class="eyebrow">${t('localProfileTitle')}</p><h2>${profile ? esc(profile.displayName) : t('createLocalProfile')}</h2><span class="device-label">${icon('lock')}${t('localOnly')}</span></div>${action('local-profile', '', profile ? 'edit' : 'plus', 'icon-btn', `aria-label="${t(profile ? 'editLocalProfile' : 'createLocalProfile')}"`)}</section>`;
    }
    function editProfile() {
      const p = state().localProfile;
      open(
        t(p ? 'editLocalProfile' : 'createLocalProfile'),
        `<form id="local-profile-form"><div class="profile-preview" id="profile-preview">${avatar(p)}</div><label>${t('displayName')}<input name="displayName" maxlength="40" value="${esc(p?.displayName || '')}" autocomplete="nickname" required></label><fieldset class="avatar-colors"><legend>${t('avatarColor')}</legend>${['mint', 'sky', 'lilac', 'peach'].map((color) => `<label class="color-option avatar-${color}"><input name="color" type="radio" value="${color}" ${color === (p?.color || 'mint') ? 'checked' : ''}><span>${t(color)}</span></label>`).join('')}</fieldset><p class="help">${t('localProfileNote')}</p><div class="dialog-actions">${action('close-modal', t('cancel'), null, 'btn secondary')}<button class="btn" type="submit">${t('save')}</button></div></form>`
      );
      env.setContext({ type: 'local-profile' });
    }
    function showCalendar() {
      const streak = C.streak(state()),
        cal = C.streakCalendar(state(), month);
      const monthName = new Date(month + '-01T12:00:00').toLocaleDateString(locale(), {
        month: 'long',
        year: 'numeric'
      });
      const week = Array.from({ length: 7 }, (_, i) =>
        new Date(2026, 10, 9 + i).toLocaleDateString(locale(), { weekday: 'short' })
      );
      open(
        t('calendarStreak'),
        `<div class="calendar-hero ${streak.lit ? 'is-lit' : 'is-pending'}"><div class="calendar-flame">${base.flame()}</div><div><strong>${streak.count}<small>${dayWord(streak.count)}</small></strong><p>${t(streak.lit ? 'streakActive' : streak.count ? 'streakPending' : 'streakStart')}</p></div></div><div class="streak-best"><span>${t('bestStreak')}</span><b>${streak.best} ${dayWord(streak.best)}</b></div><div class="calendar-month"><button class="icon-btn" data-action="calendar-month" data-offset="-1" aria-label="${t('monthPrevious')}">${icon('left')}</button><h3>${esc(monthName)}</h3><button class="icon-btn" data-action="calendar-month" data-offset="1" aria-label="${t('monthNext')}" ${month >= C.dateKey().slice(0, 7) ? 'disabled' : ''}>${icon('chevron')}</button></div><div class="streak-calendar" role="group" aria-label="${esc(monthName)}">${week.map((day) => `<span class="calendar-weekday">${esc(day)}</span>`).join('')}${'<span class="calendar-blank" aria-hidden="true"></span>'.repeat(cal.offset)}${cal.days.map((day) => `<div class="calendar-day${day.active ? ' logged' : ''}${day.today ? ' today' : ''}${day.future ? ' future' : ''}" ${day.today ? 'aria-current="date"' : ''} aria-label="${day.date}: ${t(day.active ? 'recordedDay' : 'noRecordedDay')}"><span>${Number(day.date.slice(8))}</span>${day.active ? '<i>' + icon('check') + '</i>' : ''}</div>`).join('')}</div><div class="calendar-legend"><i></i>${t('recordedDay')}</div><h3 class="form-section-title">${t('milestones')}</h3><div class="milestone-row">${[7, 30, 100].map((count) => `<div class="milestone-card milestone-${count}${streak.best >= count ? ' reached' : ''}">${base.flame()}<strong>${count}</strong><span>${t('milestone' + count)}</span></div>`).join('')}</div><p class="field-note">${t('streakHow')}</p>`
      );
      env.setContext({ type: 'streak-calendar' });
    }
    const extraKeys = ['calcium', 'iron', 'potassium', 'vitaminC', 'sodium'];
    function scanButton() {
      return action('scan-label', t('scanLabel'), 'camera', 'btn scan-label-button full gap-top');
    }
    function addLabelFields(form) {
      if (!form) return;
      if (!form.querySelector('[name=basis]'))
        form.insertAdjacentHTML(
          'afterbegin',
          `<label class="gap-top">${t('nutritionBasis')}<select name="basis"><option value="g">${t('basisG')}</option><option value="ml">${t('basisMl')}</option></select></label>`
        );
      if (!form.querySelector('[data-label-micro]')) {
        const details = document.createElement('details');
        details.className = 'label-micronutrients';
        details.dataset.labelMicro = '';
        details.innerHTML = `<summary>${t('labelDetails')}</summary><div class="field-grid gap-top">${[
          ...N.extras,
          ...extraKeys
        ]
          .filter(
            (key) =>
              !form.querySelector(`[name="${key}"]`) && !form.querySelector(`[name="food-${key}"]`)
          )
          .map(
            (key) =>
              `<label>${t(key)} (${t(extraKeys.includes(key) ? 'mg' : 'g')})<input name="label-${key}" type="number" min="0" max="${extraKeys.includes(key) ? 100000 : 100}" step="any" inputmode="decimal"></label>`
          )
          .join('')}</div>`;
        form.querySelector('.dialog-actions')?.before(details);
        for (const key of [...N.extras, ...extraKeys]) {
          const field = details.querySelector(`[name="label-${key}"]`);
          if (field) field.value = env.context().food?.[key] ?? '';
        }
      }
    }
    // A second dialog keeps the unfinished food form and barcode intact.
    let scanDialog,
      targetForm,
      source,
      rect,
      drag,
      worker,
      scanToken = 0,
      result,
      cropPreview;
    function endScan() {
      scanToken++;
      worker?.terminate().catch(() => {});
      worker = null;
      scanDialog?.close();
      scanDialog?.remove();
      scanDialog = null;
      source = null;
      result = null;
      targetForm = null;
      cropPreview = null;
    }
    function scanner() {
      endScan();
      targetForm = $('#food-editor-form') || $('#custom-food-form') || $('#complete-food-form');
      if (!targetForm) return;
      addLabelFields(targetForm);
      scanDialog = document.createElement('dialog');
      scanDialog.className = 'label-scanner';
      scanDialog.setAttribute('aria-labelledby', 'label-title');
      scanDialog.innerHTML = `<div class="dialog-head"><h2 id="label-title">${t('scanLabel')}</h2><button class="icon-btn" data-label-action="close" aria-label="${t('close')}">${icon('close')}</button></div><div id="label-stage"></div>`;
      document.body.append(scanDialog);
      scanDialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        endScan();
      });
      scanDialog.addEventListener('click', (event) => {
        const button = event.target.closest('[data-label-action]');
        if (!button) return;
        const a = button.dataset.labelAction;
        if (a === 'close') endScan();
        if (a === 'rotate' && source) {
          const rotated = document.createElement('canvas');
          rotated.width = source.height;
          rotated.height = source.width;
          const ctx = rotated.getContext('2d');
          ctx.translate(rotated.width, 0);
          ctx.rotate(Math.PI / 2);
          ctx.drawImage(source, 0, 0);
          source = rotated;
          rect = { x: 0, y: 0, w: 1, h: 1 };
          paint();
        }
        if (a === 'reset') {
          rect = { x: 0, y: 0, w: 1, h: 1 };
          paint();
        }
        if (a === 'read') void recognize();
        if (a === 'retry') {
          scanToken++;
          worker?.terminate().catch(() => {});
          worker = null;
          source = null;
          choose();
        }
      });
      scanDialog.addEventListener('change', (event) => {
        if (event.target.matches('[data-label-file]')) void loadPhoto(event.target.files?.[0]);
      });
      scanDialog.addEventListener('submit', (event) => {
        if (event.target.id === 'label-review-form') {
          event.preventDefault();
          useResult(event.target);
        }
      });
      choose();
      scanDialog.showModal();
    }
    function choose() {
      $('#label-stage').innerHTML =
        `<div class="label-intro-art">${icon('camera')}<i></i><span>100 g / 100 ml</span></div><p class="label-instruction">${t('labelIntro')}</p><div class="label-photo-actions"><label class="btn file-label">${icon('camera')}${t('takeLabel')}<input data-label-file type="file" accept="image/*" capture="environment"></label><label class="btn secondary file-label">${icon('upload')}${t('chooseLabel')}<input data-label-file type="file" accept="image/*"></label></div><p class="field-note">${icon('lock')}${t('labelPrivacy')}</p>`;
    }
    async function loadPhoto(file) {
      if (!file) return;
      const token = ++scanToken;
      try {
        if (file.size > 20 * 1024 * 1024 || !file.type.startsWith('image/')) throw Error();
        const url = URL.createObjectURL(file),
          image = new Image();
        try {
          await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = reject;
            image.src = url;
          });
        } finally {
          URL.revokeObjectURL(url);
        }
        if (token !== scanToken || !scanDialog) return;
        if (image.naturalWidth * image.naturalHeight > 48000000) throw Error();
        const factor = Math.min(1, 3000 / Math.max(image.naturalWidth, image.naturalHeight));
        source = document.createElement('canvas');
        source.width = Math.round(image.naturalWidth * factor);
        source.height = Math.round(image.naturalHeight * factor);
        const ctx = source.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, source.width, source.height);
        ctx.drawImage(image, 0, 0, source.width, source.height);
        rect = { x: 0, y: 0, w: 1, h: 1 };
        $('#label-stage').innerHTML =
          `<p class="field-note">${t('cropLabel')}</p><div class="crop-surface"><canvas id="label-canvas" aria-label="${t('cropLabel')}"></canvas></div><div class="crop-tools"><button class="btn secondary" data-label-action="rotate">${icon('repeat')}${t('rotatePhoto')}</button><button class="text-button" data-label-action="reset">${t('resetCrop')}</button></div><label>${t('labelLanguage')}<select id="ocr-language"><option value="ukr+eng" ${state().lang === 'uk' ? 'selected' : ''}>Українська + English</option><option value="rus+eng" ${state().lang === 'ru' ? 'selected' : ''}>Русский + English</option><option value="eng" ${state().lang === 'en' ? 'selected' : ''}>English</option></select></label><div class="dialog-actions"><button class="btn" data-label-action="read">${icon('spark')}${t('recognize')}</button></div>`;
        const canvas = $('#label-canvas');
        const point = (e) => {
          const r = canvas.getBoundingClientRect();
          return {
            x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
            y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))
          };
        };
        canvas.addEventListener('pointerdown', (e) => {
          drag = point(e);
          canvas.setPointerCapture(e.pointerId);
          e.preventDefault();
        });
        canvas.addEventListener('pointermove', (e) => {
          if (!drag) return;
          const p = point(e);
          rect = {
            x: Math.min(drag.x, p.x),
            y: Math.min(drag.y, p.y),
            w: Math.abs(p.x - drag.x),
            h: Math.abs(p.y - drag.y)
          };
          paint();
        });
        canvas.addEventListener('pointerup', () => {
          drag = null;
          if (rect.w < 0.025 || rect.h < 0.025) rect = { x: 0, y: 0, w: 1, h: 1 };
          paint();
        });
        canvas.addEventListener('pointercancel', () => {
          drag = null;
          rect = { x: 0, y: 0, w: 1, h: 1 };
          paint();
        });
        paint();
      } catch {
        if (token === scanToken) notify(t('ocrError'), true);
      }
    }
    function paint() {
      const canvas = $('#label-canvas');
      if (!canvas || !source) return;
      const scale = Math.min(1, 960 / Math.max(source.width, source.height));
      canvas.width = Math.round(source.width * scale);
      canvas.height = Math.round(source.height * scale);
      const ctx = canvas.getContext('2d'),
        { width: w, height: h } = canvas;
      ctx.drawImage(source, 0, 0, w, h);
      ctx.fillStyle = '#09131bac';
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.beginPath();
      ctx.rect(rect.x * w, rect.y * h, rect.w * w, rect.h * h);
      ctx.clip();
      ctx.drawImage(source, 0, 0, w, h);
      ctx.restore();
      ctx.strokeStyle = '#74e3c2';
      ctx.lineWidth = 3;
      ctx.strokeRect(
        rect.x * w + 1,
        rect.y * h + 1,
        Math.max(0, rect.w * w - 2),
        Math.max(0, rect.h * h - 2)
      );
    }
    const cdnOCR = () =>
      !!window.RATION_CDN_OCR || !!window.RATION_STANDALONE || location.protocol === 'file:';
    let libraryPromise;
    function loadOCR() {
      if (window.Tesseract) return Promise.resolve(window.Tesseract);
      if (libraryPromise) return libraryPromise;
      libraryPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = cdnOCR()
          ? 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js'
          : 'vendor/ocr/tesseract.min.js';
        s.onload = () => resolve(window.Tesseract);
        s.onerror = () => {
          libraryPromise = null;
          s.remove();
          reject(Error('load'));
        };
        document.head.append(s);
      });
      return libraryPromise;
    }
    async function recognize() {
      if (!source) return;
      const token = ++scanToken,
        lang = $('#ocr-language').value;
      const crop = document.createElement('canvas'),
        width = source.width * rect.w,
        height = source.height * rect.h,
        scale = Math.min(3, 2200 / Math.max(width, height));
      crop.width = Math.max(1, Math.round(width * scale));
      crop.height = Math.max(1, Math.round(height * scale));
      crop
        .getContext('2d')
        .drawImage(
          source,
          rect.x * source.width,
          rect.y * source.height,
          width,
          height,
          0,
          0,
          crop.width,
          crop.height
        );
      $('#label-stage').innerHTML =
        `<div class="ocr-working"><div class="scanner-orbit">${icon('scan')}</div><h3>${t('recognizing')}</h3><p id="ocr-status" role="status">${t('preparingOCR')}</p><progress id="ocr-progress" max="1" value="0"></progress><button class="text-button" data-label-action="retry">${t('cancel')}</button></div>`;
      cropPreview = crop.toDataURL('image/jpeg', 0.82);
      let timeout,
        finished = false;
      try {
        const task = (async () => {
          const T = await loadOCR();
          if (token !== scanToken || finished) return;
          const local = !cdnOCR();
          const options = {
            logger: (m) => {
              if (token !== scanToken) return;
              if ($('#ocr-progress')) $('#ocr-progress').value = m.progress || 0;
              if ($('#ocr-status'))
                $('#ocr-status').textContent =
                  t(m.status === 'recognizing text' ? 'recognizing' : 'preparingOCR') +
                  ' ' +
                  Math.round((m.progress || 0) * 100) +
                  '%';
            }
          };
          if (local)
            Object.assign(options, {
              workerPath: new URL('vendor/ocr/worker.min.js', location.href).href,
              corePath: new URL('vendor/ocr/core/', location.href).href,
              langPath: new URL('vendor/ocr/lang', location.href).href
            });
          const created = await T.createWorker(lang, 1, options);
          if (token !== scanToken || finished) {
            await created.terminate();
            return;
          }
          worker = created;
          await worker.setParameters({ preserve_interword_spaces: '1' });
          return worker.recognize(crop);
        })();
        const output = await Promise.race([
          task,
          new Promise((_, reject) => {
            timeout = setTimeout(() => reject(Error('timeout')), 120000);
          })
        ]);
        if (token !== scanToken) return;
        result = window.RationLabel.parse(output?.data?.text || '');
        showReview();
      } catch (error) {
        if (token === scanToken && scanDialog) {
          $('#label-stage').innerHTML =
            `<div class="empty"><p role="alert">${t(error.message === 'load' ? 'ocrUnavailable' : 'ocrError')}</p><button class="btn secondary gap-top" data-label-action="retry">${t('retryLabel')}</button></div>`;
        }
      } finally {
        finished = true;
        clearTimeout(timeout);
        if (token === scanToken) {
          worker?.terminate().catch(() => {});
          worker = null;
        }
      }
    }
    function showReview() {
      const keys = ['kcal', 'p', 'f', 'c', ...N.extras, ...extraKeys],
        ambiguous = !result.has100 || result.multipleColumns;
      $('#label-title').textContent = t('reviewLabel');
      $('#label-stage').innerHTML =
        `<form id="label-review-form"><details class="label-proof"><summary>${t('labelPhoto')}</summary><img src="${cropPreview}" alt="${t('yourLabel')}"></details><p class="review-notice">${t(Object.keys(result.values).length ? 'reviewNote' : 'photoUnreadable')}</p>${ambiguous ? `<p class="label-warning">${t('labelAmbiguous')}</p>` : ''}<label>${t('nutritionBasis')}<select name="basis" required><option value="">—</option><option value="g" ${result.basis === 'g' ? 'selected' : ''}>${t('basisG')}</option><option value="ml" ${result.basis === 'ml' ? 'selected' : ''}>${t('basisMl')}</option></select></label><div class="field-grid gap-top">${keys.map((key) => `<label>${t({ kcal: 'labelEnergy', p: 'protein', f: 'fat', c: 'carbs' }[key] || key)} (${t(key === 'kcal' ? 'kcal' : extraKeys.includes(key) ? 'mg' : 'g')})<input name="${key}" type="number" min="0" max="${key === 'kcal' ? 1000 : extraKeys.includes(key) ? 100000 : 100}" step="any" inputmode="decimal" value="${result.values[key] ?? ''}" ${['kcal', 'p', 'f', 'c'].includes(key) ? 'required' : ''} ${result.evidence[key] ? `title="${esc(result.evidence[key])}"` : ''}></label>`).join('')}</div><details class="label-text"><summary>${t('ocrText')}</summary><pre>${esc(result.text.slice(0, 12000))}</pre></details><label class="check-label gap-top"><input name="confirmed" type="checkbox" required><span>${t('confirmLabel')}</span></label><div class="dialog-actions"><button type="button" class="btn secondary" data-label-action="retry">${t('retryLabel')}</button><button class="btn" type="submit">${t('useLabel')}</button></div></form>`;
    }
    function useResult(form) {
      const data = new FormData(form);
      if (
        !data.has('confirmed') ||
        !['g', 'ml'].includes(data.get('basis')) ||
        !targetForm?.isConnected
      )
        return;
      const values = {};
      for (const key of ['kcal', 'p', 'f', 'c', ...N.extras, ...extraKeys]) {
        const value = data.get(key);
        if (value !== null && value !== '') values[key] = Number(value);
      }
      if (['kcal', 'p', 'f', 'c'].some((key) => !N.known(values[key]))) return;
      targetForm.querySelector('[name=basis]').value = data.get('basis');
      // Updating a basis invalidates old piece/package/density calibration.
      targetForm
        .querySelector('[name=basis]')
        .dispatchEvent(new Event('change', { bubbles: true }));
      for (const [key, value] of Object.entries(values)) {
        const field = targetForm.querySelector(
          `[name="${key}"],[name="food-${key}"],[name="label-${key}"]`
        );
        if (field) field.value = String(value);
      }
      targetForm.querySelector('.label-micronutrients')?.setAttribute('open', '');
      const input = targetForm.querySelector('[name=name]');
      endScan();
      input?.focus();
      notify(t('labelLoaded'));
    }
    document.addEventListener('change', (event) => {
      const input = event.target;
      if (input.matches('#local-profile-form input[name=color]')) {
        const preview = $('#profile-preview .local-avatar');
        if (preview) preview.className = 'local-avatar avatar-' + input.value;
      }
      if (input.matches('#food-editor-form select[name=basis]')) {
        const form = input.closest('form');
        for (const key of ['piece', 'package', 'density']) {
          const field = form.querySelector(`[name="measure-${key}"]`);
          if (field) {
            field.value = '';
            if (key !== 'density')
              field.parentElement.firstChild.textContent =
                t(key === 'piece' ? 'pieceWeight' : 'packageWeight') +
                ' (' +
                base.unitLabel(input.value) +
                ')';
          }
        }
      }
    });
    document.addEventListener('input', (event) => {
      if (event.target.matches('#local-profile-form input[name=displayName]')) {
        const preview = $('#profile-preview .local-avatar');
        if (preview) preview.textContent = [...(event.target.value.trim() || '•')][0].toUpperCase();
      }
    });
    window.addEventListener('pagehide', endScan);
    function enhancedEditor(food) {
      base.editor(food);
      const form = $('#food-editor-form');
      form.insertAdjacentHTML('afterbegin', scanButton());
      addLabelFields(form);
      for (const key of extraKeys) {
        const field = form.querySelector(`[name="label-${key}"]`);
        if (field) field.value = food[key] ?? '';
      }
    }
    return {
      ...base,
      localProfileHTML,
      scanButton,
      addLabelFields,
      beforeRender() {
        const next = C.streak(state());
        milestone =
          next.lit && next.count > previous.count && [7, 30, 100].includes(next.count)
            ? next.count
            : 0;
        previous = next;
        base.beforeRender();
      },
      afterRender() {
        base.afterRender();
        if (milestone) {
          const box = $('#streak-celebration');
          if (box) {
            box.classList.add('milestone-celebration', 'milestone-' + milestone);
            box.querySelector('strong').textContent = t('milestone' + milestone);
            box.insertAdjacentHTML(
              'beforeend',
              '<div class="milestone-particles" aria-hidden="true">' +
                Array.from(
                  { length: milestone === 100 ? 20 : milestone === 30 ? 12 : 7 },
                  (_, i) => `<i style="--i:${i}"></i>`
                ).join('') +
                '</div>'
            );
          }
          milestone = 0;
        }
      },
      click(button) {
        const a = button.dataset.action;
        if (a === 'edit-food') {
          const food = env.find(button.dataset.id || env.context().food?.id) || env.context().food;
          if (food && food.kind !== 'recipe') {
            enhancedEditor(food);
            return true;
          }
        }
        if (a === 'local-profile') {
          editProfile();
          return true;
        }
        if (a === 'streak-info') {
          month = C.dateKey().slice(0, 7);
          showCalendar();
          return true;
        }
        if (a === 'calendar-month') {
          const d = new Date(month + '-01T12:00:00');
          d.setMonth(d.getMonth() + Number(button.dataset.offset));
          month = C.dateKey(d).slice(0, 7);
          showCalendar();
          return true;
        }
        if (a === 'scan-label') {
          scanner();
          return true;
        }
        if (a === 'create-from-label') {
          env.createFood();
          scanner();
          return true;
        }
        return base.click(button);
      },
      submit(form, data) {
        if (form.id === 'local-profile-form') {
          const old = state().localProfile,
            p = {
              id: old?.id || 'local-' + uid(),
              displayName: String(data.get('displayName') || '').trim(),
              color: data.get('color'),
              createdAt: old?.createdAt || C.dateKey()
            };
          if (!C.validLocalProfile(p)) {
            notify(t('required'), true);
            return true;
          }
          state().localProfile = p;
          if (save()) {
            close();
            render();
            notify(t('saved'));
          }
          return true;
        }
        if (['food-editor-form', 'custom-food-form', 'complete-food-form'].includes(form.id)) {
          const additions = { basis: data.get('basis') || 'g' };
          for (const key of [...N.extras, ...extraKeys]) {
            const value = data.get('label-' + key);
            if (value !== null && value !== '') additions[key] = Number(value);
          }
          env.context().labelDraft = additions;
          if (form.id === 'food-editor-form') {
            for (const key of extraKeys)
              if (data.get('label-' + key) === '') delete env.context().food[key];
            Object.assign(env.context().food, additions);
          }
        }
        return base.submit(form, data);
      },
      editor: enhancedEditor
    };
  };
})();
