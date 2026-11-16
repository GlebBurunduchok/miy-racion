// Compact GitHub Pages build. OCR models are hosted with the app.
const CACHE="mii-ratsion-4.2.0-pages-0ff7f7c55ef1";
const LAZY=["./vendor/ocr/tesseract.min.js","./vendor/ocr/worker.min.js","./vendor/ocr/core/tesseract-core-lstm.wasm.js","./vendor/ocr/core/tesseract-core-simd-lstm.wasm.js","./vendor/ocr/lang/ukr.traineddata.gz","./vendor/ocr/lang/eng.traineddata.gz","./vendor/ocr/lang/rus.traineddata.gz"];
const FILES=["./","./index.html","./styles.css","./community.css","./data.js","./strings.js","./feature-strings.js","./community-strings.js","./catalog.js","./product-assets.js","./product-photos.js","./ingredient-photos.js","./core.js","./search.js","./nutrition.js","./features.js","./community.js","./label.js","./ocr.js","./providers.js","./storage.js","./api.js","./media.js","./feature-ui.js","./privacy-content.js","./privacy-ui.js","./community-ui.js","./app.js","./manifest.webmanifest","./assets/icon-v2-3.svg","./assets/icon-v2-3-180.png","./assets/icon-v2-3-192.png","./assets/icon-v2-3-512.png","./assets/bowl.jpg","./assets/welcome.jpg","./assets/products/milka-7622210834751.jpg","./assets/products/water-4820051240233.jpg","./vendor/zxing-browser.min.js"];
/* The build supplies CACHE, FILES and LAZY from project.config.mjs. */
const OCR_CACHE = 'mii-ratsion-ocr-tesseract6.0.1-core6.0.0-models4-int';
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('mii-ratsion-') && key !== CACHE && key !== OCR_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.includes('/api/')
  )
    return;
  const isOCR = LAZY.some(
    (file) => new URL(file, self.registration.scope).pathname === url.pathname
  );
  event.respondWith(
    (isOCR
      ? caches
          .open(OCR_CACHE)
          .then(async (cache) => (await cache.match(event.request)) || fetch(event.request))
      : fetch(event.request)
    )
      .then((response) => {
        if (
          response.ok &&
          [...FILES, ...LAZY].some(
            (file) => new URL(file, self.registration.scope).pathname === url.pathname
          )
        ) {
          const copy = response.clone();
          event.waitUntil(
            caches.open(isOCR ? OCR_CACHE : CACHE).then((cache) => cache.put(event.request, copy))
          );
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        return (
          cached ||
          (event.request.mode === 'navigate' ? await caches.match('./index.html') : null) ||
          Response.error()
        );
      })
  );
});
