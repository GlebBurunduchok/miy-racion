window.RationAPI=(()=>{
const cache=new Map(),detailCache=new Map();let proxy=false,lastDirect=0,lastDetail=0;
async function json(url,signal){const r=await fetch(url,{signal});if(!r.ok)throw Error('service:'+r.status);const content=await r.text();try{return JSON.parse(content);}catch{throw Error('service:non-json');}}
const ready=/^https?:$/.test(location.protocol)?json('./api/health',AbortSignal.timeout(3000)).then(d=>proxy=d.service==='mii-ratsion').catch(()=>false):Promise.resolve(false);
return {
 ready,hasProxy:()=>proxy,delay:()=>proxy?650:Math.max(650,7000-(Date.now()-lastDirect)),
 async search(q,lang,signal){await ready;const key=lang+':'+q.toLowerCase();if(cache.has(key))return cache.get(key);let result;
  if(proxy){const data=await json('./api/search?'+new URLSearchParams({q,lang}),signal);result={foods:(data.foods||[]).filter(RationCore.validFood),partial:!!data.partial};}
  else {lastDirect=Date.now();const data=await json('https://world.openfoodfacts.org/cgi/search.pl?'+new URLSearchParams({search_terms:q,search_simple:'1',action:'process',json:'1',page_size:'30',lc:lang,fields:'code,product_name,product_name_uk,product_name_ru,product_name_en,brands,nutriments,image_front_url,image_front_small_url,selected_images,nutriscore_grade',app_name:'MiiRatsionWeb'}),signal);result={foods:(data.products||[]).map(RationProviders.fromOFF).filter(Boolean),partial:false};}
  if(cache.size>100)cache.delete(cache.keys().next().value);cache.set(key,result);return result;
 },
 async barcode(code,signal){await ready;if(proxy){const data=await json('./api/barcode?code='+encodeURIComponent(code),signal);return data.food&&RationCore.validFood(data.food)?{...data.food,detailsLoaded:true}:null;}const data=await json('https://world.openfoodfacts.org/api/v2/product/'+code+'.json?fields=code,product_name,product_name_uk,product_name_ru,product_name_en,brands,nutriments,image_front_url,image_front_small_url,selected_images,nutriscore_grade',signal);const food=data.status===1?RationProviders.fromOFF({...data.product,code}):null;return food?{...food,detailsLoaded:true}:null;},
 async details(food,signal){await ready;if(detailCache.has(food.id))return detailCache.get(food.id);let details=null;if(proxy){const params=food.source==='off'?{source:'off',code:food.barcode||food.id.slice(4)}:food.source==='tablycja'?{source:'tablycja',slug:decodeURIComponent(new URL(food.sourceUrl).pathname.split('/').pop())}:null;if(params){const d=await json('./api/details?'+new URLSearchParams(params),signal);details=d.details;}}
 else if(food.source==='off'){const wait=Math.max(0,4200-(Date.now()-lastDetail));if(wait)await new Promise(r=>setTimeout(r,wait));if(signal?.aborted)throw Error('aborted');lastDetail=Date.now();details=await this.barcode(food.barcode||food.id.slice(4),signal);}
 if(details){detailCache.set(food.id,details);if(detailCache.size>200)detailCache.delete(detailCache.keys().next().value);}return details;}
};
})();
