/** One source of truth for the browser, offline cache and standalone build. */
export const version = '2.3.0';
export const browserScripts = [
  'data.js',
  'strings.js',
  'catalog.js',
  'product-assets.js',
  'product-photos.js',
  'core.js',
  'search.js',
  'nutrition.js',
  'providers.js',
  'storage.js',
  'api.js',
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
  ...browserScripts,
  'manifest.webmanifest',
  ...Object.keys(embeddedAssets),
  'vendor/zxing-browser.min.js'
];
