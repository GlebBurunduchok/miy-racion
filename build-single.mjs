// node build-single.mjs — generates a standalone HTML using only Node built-ins.
import {readFile,writeFile} from 'node:fs/promises';
const base=new URL('./',import.meta.url),read=async p=>readFile(new URL(p,base),'utf8');
const image=async(p,type)=>'data:'+type+';base64,'+(await readFile(new URL(p,base))).toString('base64');
const replacements={
 'assets/icon.svg':await image('assets/icon.svg','image/svg+xml'),
 'assets/icon-192.png':await image('assets/icon-192.png','image/png'),
 'assets/bowl.jpg':await image('assets/bowl.jpg','image/jpeg'),
 'assets/welcome.jpg':await image('assets/welcome.jpg','image/jpeg'),
 'assets/products/milka-7622210834751.jpg':await image('assets/products/milka-7622210834751.jpg','image/jpeg')
};
const replaceAssets=s=>Object.entries(replacements).reduce((text,[p,v])=>text.replaceAll(p,v),s);
let html=await read('index.html');html=html.replace(/\s*<link rel="manifest"[^>]*>/,'').replace(/\s*<link rel="stylesheet"[^>]*>/,'').replace(/\s*<script defer[^>]*><\/script>/g,'');
html=replaceAssets(html).replace('</head>','<style>'+replaceAssets(await read('styles.css'))+'</style></head>');
const scripts=await Promise.all(['vendor/zxing-browser.min.js','data.js','strings.js','catalog.js','product-assets.js','core.js','search.js','nutrition.js','providers.js','api.js','app.js'].map(read));
html=html.replace('</body>',scripts.map(s=>'<script>'+replaceAssets(s).replace(/<\/script/gi,'<\\/script')+'</script>').join('\n')+'\n</body>');
await writeFile(new URL('Mii_Ratsion.html',base),html);
console.log('Created Mii_Ratsion.html ('+Buffer.byteLength(html)+' bytes)');
