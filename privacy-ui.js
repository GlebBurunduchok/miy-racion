/* Privacy notice is available before setup and from Settings, in UA and English. */
window.RationPrivacyUI = function (env) {
  const { t, esc, icon, action, open, state } = env;
  function card() {
    return `<section class="panel settings-panel privacy-card"><div class="between"><h2>${t('privacyTitle')}</h2>${icon('shield')}</div><p class="help gap-top">${t('privacySummary')}</p><div class="privacy-buttons">${action('show-privacy', 'Українська', null, 'btn secondary', 'data-lang="uk"')}${action('show-privacy', 'English', null, 'btn secondary', 'data-lang="en"')}</div><p class="field-note">Крупнік Глєб / Krupnik Hlieb</p></section>`;
  }
  function show(language) {
    const lang = language === 'en' ? 'en' : 'uk',
      policy = window.RATION_PRIVACY[lang];
    open(
      policy.title,
      `<article class="privacy-document" lang="${lang}"><div class="privacy-language">${['uk', 'en'].map((code) => action('show-privacy', code === 'uk' ? 'Українська' : 'English', null, 'tab' + (code === lang ? ' active' : ''), `data-lang="${code}" aria-pressed="${code === lang}"`)).join('')}</div><p class="privacy-updated">${lang === 'uk' ? 'Оновлено' : 'Updated'}: 16 ${lang === 'uk' ? 'листопада 2026 року' : 'November 2026'}</p>${policy.sections.map((section) => `<section><h3>${esc(section.title)}</h3>${section.paragraphs.map((text) => `<p>${esc(text)}</p>`).join('')}</section>`).join('')}</article>`,
      true
    );
  }
  function photoCredits() {
    const en = state().lang === 'en',
      title = en ? 'Photo credits' : 'Автори фотографій';
    open(
      title,
      `<article class="privacy-document"><p>${en ? 'Ingredient photographs from Wikimedia Commons. Resized thumbnails are displayed in cropped frames.' : 'Фотографії базових продуктів із Wikimedia Commons. Зменшені зображення показано в обрізаних рамках.'}</p>${(window.RATION_INGREDIENT_CREDITS || []).map((c) => `<section><h3>${esc(c.name)}</h3><p>${esc(c.author)}</p><p><a href="${esc(c.source)}" target="_blank" rel="noopener noreferrer">Wikimedia Commons ↗</a> · <a href="${esc(c.licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(c.license)}</a></p></section>`).join('')}</article>`,
      true
    );
  }
  const originalCard = card;
  return {
    card: () =>
      originalCard() +
      `<section class="panel settings-panel">${action('photo-credits', state().lang === 'en' ? 'Photo credits' : 'Автори фотографій', null, 'btn secondary')}</section>`,
    show,
    click(button) {
      if (button.dataset.action === 'photo-credits') {
        photoCredits();
        return true;
      }
      if (button.dataset.action !== 'show-privacy') return false;
      show(button.dataset.lang || (state().lang === 'en' ? 'en' : 'uk'));
      return true;
    }
  };
};
