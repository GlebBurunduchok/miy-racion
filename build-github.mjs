/** Browser-upload friendly static site. The full source remains unchanged. */
import { readFile, writeFile, copyFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { publicFiles, version } from './project.config.mjs';

const source = new URL('./', import.meta.url);
const destination = new URL('../../outputs/GitHub_Upload_v4_0/', import.meta.url);
await mkdir(destination, { recursive: true });
const files = [
  ...publicFiles,
  'vendor/ZXING-LICENSE.txt',
  'vendor/ZXING-LIBRARY-LICENSE.txt',
  'project.config.mjs',
  'build-github.mjs'
];
for (const file of files) {
  const output = new URL(file, destination);
  await mkdir(new URL('./', output), { recursive: true });
  await copyFile(new URL(file, source), output);
}
const index = new URL('index.html', destination);
const html = (await readFile(index, 'utf8')).replace(
  '</head>',
  '<script>window.RATION_CDN_OCR=true;</script>\n</head>'
);
await writeFile(index, html);
const fingerprint = createHash('sha256');
for (const file of publicFiles) fingerprint.update(await readFile(new URL(file, destination)));
const name = `mii-ratsion-${version}-pages-${fingerprint.digest('hex').slice(0, 12)}`;
await writeFile(
  new URL('sw.js', destination),
  `// Lightweight GitHub Pages build. OCR runs on-device using CDN dependencies.\nconst CACHE=${JSON.stringify(name)};\nconst LAZY=[];\nconst FILES=${JSON.stringify(['./', ...publicFiles.map((file) => './' + file)])};\n${await readFile(new URL('scripts/service-worker.js', source), 'utf8')}`
);
await writeFile(new URL('.nojekyll', destination), '');
await writeFile(
  new URL('UPLOAD_README.txt', destination),
  `Мій раціон 4.0 — комплект для GitHub Pages\n\n1. Откройте репозиторий и выберите Add file → Upload files.\n2. Перетащите СОДЕРЖИМОЕ этой папки: файлы index.html, sw.js, остальные JS/CSS, assets и vendor.\n3. Дождитесь завершения загрузки и нажмите Commit changes.\n\nindex.html должен лежать в корне выбранной папки публикации GitHub Pages. Не загружайте ZIP как сайт и не вкладывайте эту папку внутрь старой папки проекта.\n\nФункции дневника, календаря, профиля, базовых продуктов и распознавания сохранены. OCR обрабатывает фото на устройстве, но файлы движка и языка загружаются с CDN, поэтому для распознавания нужен доступ к интернету. Здесь нет больших локальных OCR-моделей. Полная версия для localhost и самостоятельного хранения моделей остаётся в Mii_Ratsion_Source_v4_0.zip.\n\nСуществующий дневник не очищается. При открытии сайта по прежнему адресу записи сохраняются в прежнем браузере. Эта папка содержит только файлы сайта, без личных данных.\n`
);
let size = 0;
for (const file of [...files, 'sw.js', '.nojekyll', 'UPLOAD_README.txt']) {
  const info = await stat(new URL(file, destination));
  if (info.size >= 25 * 1024 * 1024) throw Error('File exceeds GitHub browser limit: ' + file);
  size += info.size;
}
console.log(
  JSON.stringify({
    directory: decodeURIComponent(destination.pathname),
    files: files.length + 3,
    bytes: size
  })
);
