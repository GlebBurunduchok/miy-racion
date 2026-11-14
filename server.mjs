import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import path from 'node:path';
const require=createRequire(import.meta.url),C=require('./core.js');require('./nutrition.js');const P=require('./providers.js');
const args=typeof process==='undefined'?[]:process.argv;
const root=path.dirname(fileURLToPath(import.meta.url)),port=Number(args.find(x=>/^\d{2,5}$/.test(x))||4173);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.txt':'text/plain; charset=utf-8','.csv':'text/csv; charset=utf-8'};
const cache=new Map(),detailsCache=new Map();let active=0,lastLegacy=0,lastBarcode=0,nextDetail=0;
async function details(source,value){const key=source+':'+value;if(detailsCache.has(key))return detailsCache.get(key);let result;
 if(source==='off'){const wait=Math.max(0,nextDetail-Date.now());nextDetail=Math.max(nextDetail,Date.now())+4200;if(wait)await new Promise(r=>setTimeout(r,wait));const data=await upstream('https://world.openfoodfacts.org/api/v2/product/'+value+'.json?fields=code,product_name,product_name_uk,product_name_ru,product_name_en,brands,nutriments,categories_tags,image_front_url,image_front_small_url,selected_images,nutriscore_grade',true);result=data.status===1?P.fromOFF({...data.product,code:value}):null;if(result)result.detailsLoaded=true;}
 else {const response=await fetch('https://www.tablycjakalorijnosti.com.ua/stravy/'+encodeURIComponent(value),{signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('Source unavailable');result={...P.tableDetails(await response.text()),detailsLoaded:true};}
 if(result){detailsCache.set(key,result);if(detailsCache.size>200)detailsCache.delete(detailsCache.keys().next().value);}return result;
}
async function upstream(url,allowNotFound=false){const response=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'MiiRatsion/2.2 (personal nutrition diary)'}});if(!response.ok&&!(allowNotFound&&response.status===404))throw Error('HTTP '+response.status);return response.json();}
async function search(q,lang){const key=lang+':'+q.toLowerCase(),cached=cache.get(key);if(cached&&Date.now()-cached.at<3600000)return cached.data;
 const offURL='https://search.openfoodfacts.org/search?'+new URLSearchParams({q,page_size:'30',langs:[lang,'en'].join(','),fields:'code,product_name,product_name_uk,product_name_ru,product_name_en,brands,nutriments,categories_tags,image_front_url,image_front_small_url,selected_images,nutriscore_grade'});
 const tableURL='https://www.tablycjakalorijnosti.com.ua/foodstuff/filter-list?'+new URLSearchParams({format:'json',page:'0',limit:'40',query:q,type:'0',brand:'',min:'0',max:'10000',sliderType:'energy'});
 const results=await Promise.allSettled([upstream(tableURL).then(d=>(d.data||[]).map(P.fromTable).filter(Boolean)),upstream(offURL).then(d=>(d.hits||[]).map(P.fromOFF).filter(Boolean))]);
 let foods=results.flatMap(r=>r.status==='fulfilled'?r.value:[]),success=results.filter(r=>r.status==='fulfilled').length;
 if(!success&&Date.now()-lastLegacy>=7000){lastLegacy=Date.now();try{const data=await upstream('https://world.openfoodfacts.org/cgi/search.pl?'+new URLSearchParams({search_terms:q,search_simple:'1',action:'process',json:'1',page_size:'30',lc:lang,fields:'code,product_name,product_name_uk,product_name_ru,product_name_en,brands,nutriments,categories_tags,image_front_url,image_front_small_url,selected_images,nutriscore_grade'}));foods=(data.products||[]).map(P.fromOFF).filter(Boolean);success=1;}catch{}}
 if(!success)throw Error('Sources unavailable');
 const unique=[...new Map(foods.map(f=>[f.id,f])).values()],data={foods:unique,partial:success<2};cache.set(key,{at:Date.now(),data});if(cache.size>200)cache.delete(cache.keys().next().value);return data;
}
const server=createServer(async(req,res)=>{const send=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
 try{if(req.method!=='GET'){send(405,{error:'Method not allowed'});return;}const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/health'){send(200,{service:'mii-ratsion',version:2.2});return;}
  if(url.pathname==='/api/search'){const q=(url.searchParams.get('q')||'').trim(),lang=url.searchParams.get('lang')||'uk';if(q.length<2||q.length>100||!['uk','ru','en'].includes(lang)){send(400,{error:'Invalid query'});return;}if(active>=8){send(429,{error:'Busy'});return;}active++;try{send(200,await search(q,lang));}finally{active--;}return;}
  if(url.pathname==='/api/details'){const source=url.searchParams.get('source'),value=url.searchParams.get(source==='off'?'code':'slug')||'';if(!['off','tablycja'].includes(source)||source==='off'&&!/^\d{8,14}$/.test(value)||source==='tablycja'&&(!value||value.length>200||/[\/\\?#]/.test(value))){send(400,{error:'Invalid product'});return;}if(active>=8){send(429,{error:'Busy'});return;}active++;try{send(200,{details:await details(source,value)});}finally{active--;}return;}
  if(url.pathname==='/api/barcode'){const code=url.searchParams.get('code')||'';if(!/^\d{8,14}$/.test(code)){send(400,{error:'Invalid barcode'});return;}if(Date.now()-lastBarcode<4100){send(429,{error:'Wait'});return;}lastBarcode=Date.now();let food=null;for(const candidate of C.barcodeCandidates(code)){food=await details('off',candidate);if(food)break;}send(200,{food});return;}
  if(url.pathname.startsWith('/api/')){send(404,{error:'Not found'});return;}
  const rel=decodeURIComponent(url.pathname).replace(/^\/+/,''),file=path.resolve(root,rel||'index.html');if(!file.startsWith(root+path.sep)||!['index.html','styles.css','data.js','strings.js','catalog.js','product-assets.js','core.js','search.js','nutrition.js','providers.js','api.js','app.js','sw.js','manifest.webmanifest','Mii_Ratsion.html'].includes(rel||'index.html')&&!rel.startsWith('assets/')&&!rel.startsWith('vendor/')){res.writeHead(403).end();return;}
  if(!(await stat(file)).isFile()){res.writeHead(404).end();return;}const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(bytes);
 }catch{if(!res.headersSent)send(503,{error:'Source temporarily unavailable'});else res.end();}
});
server.on('error',err=>{console.error(err.code==='EADDRINUSE'?'Port '+port+' is already in use. Open http://localhost:'+port+' or choose another port.':err.message);if(typeof process!=='undefined')process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{const url='http://localhost:'+port;console.log('Mii Ratsion 2.2: '+url+'\nKeep this window open. Press Ctrl+C to stop.');if(args.includes('--open')){const p=process.platform==='win32'?spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{detached:true,stdio:'ignore',windowsHide:true}):process.platform==='darwin'?spawn('open',[url],{detached:true,stdio:'ignore'}):spawn('xdg-open',[url],{detached:true,stdio:'ignore'});p.on('error',()=>{});p.unref();}});
export {server,search};
