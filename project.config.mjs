/** One source of truth for the browser, offline cache and standalone build. */
export const version = '4.0.0';
export const browserScripts = [
  'data.js',
  'strings.js',
  'feature-strings.js',
  'community-strings.js',
  'catalog.js',
  'product-assets.js',
  'product-photos.js',
  'core.js',
  'search.js',
  'nutrition.js',
  'features.js',
  'community.js',
  'label.js',
  'providers.js',
  'storage.js',
  'api.js',
  'media.js',
  'feature-ui.js',
  'community-ui.js',
  'app.js'
];
export const embeddedAssets = {
  'assets/icon-v2-3.svg': 'image/svg+xml',
  'assets/icon-v2-3-180.png': 'image/png',
  'assets/icon-v2-3-192.png': 'image/png',
  'assets/icon-v2-3-512.png': 'image/png',
  'assets/bowl.jpg': 'image/jpeg',
  'assets/welcome.jpg': 'image/jpeg',
  'assets/products/milka-7622210834751.jpg': 'image/jpeg',
  'assets/products/water-4820051240233.jpg': 'image/jpeg'
};
export const publicFiles = [
  'index.html',
  'styles.css',
  'community.css',
  ...browserScripts,
  'manifest.webmanifest',
  ...Object.keys(embeddedAssets),
  'vendor/zxing-browser.min.js'
];

// OCR is downloaded only when scanning a label, then cached for offline use.
export const ocrFiles = [
  'vendor/ocr/tesseract.min.js',
  'vendor/ocr/worker.min.js',
  ...[
    'tesseract-core',
    'tesseract-core-simd',
    'tesseract-core-lstm',
    'tesseract-core-simd-lstm'
  ].flatMap((name) => [
    'vendor/ocr/core/' + name + '.wasm.js',
    'vendor/ocr/core/' + name + '.wasm'
  ]),
  ...['ukr', 'eng', 'rus'].map((lang) => 'vendor/ocr/lang/' + lang + '.traineddata.gz')
];
