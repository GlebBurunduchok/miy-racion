/* Display calculations. Missing nutrients stay unknown, never become zero. */
(function(root){
const C=root.RationCore;
const extras=['sugars','salt','saturatedFat','fiber'];
const defaults={sugars:90,salt:6,saturatedFat:20,fiber:25};
function known(v){return typeof v==='number'&&Number.isFinite(v)&&v>=0;}
function percent(value,target){return known(value)&&known(target)&&target>0?value/target*100:null;}
function tone(value,target,mode='goal',complete=true){const pct=percent(value,target);if(pct===null)return 'neutral';if(!complete&&pct<=100)return 'neutral';if(mode==='minimum')return pct>=100?'green':'yellow';if(mode==='reference'){return pct<=50?'green':pct<=80?'yellow':pct<=100?'orange':'red';}return pct<25?'yellow':pct<=100?'green':pct<=120?'orange':'red';}
function distribution(f){const values={p:f.p*4,f:f.f*9,c:f.c*4},sum=values.p+values.f+values.c;return {total:sum,p:sum>0?values.p/sum*100:0,f:sum>0?values.f/sum*100:0,c:sum>0?values.c/sum*100:0};}
function total(entries,key){let value=0,knownCount=0;for(const e of entries){if(known(e.food[key])){value+=e.food[key]*e.grams/100;knownCount++;}}return {value,known:knownCount,count:entries.length,complete:knownCount===entries.length};}
function safeImage(url){return typeof url==='string'&&url.length<1200&&/^https:\/\/(?:images\.openfoodfacts\.org|static\.openfoodfacts\.org|www\.tablycjakalorijnosti\.com\.ua)\//.test(url);}
const oldValid=C.validFood;
C.validFood=f=>oldValid(f)&&extras.every(k=>f[k]==null||known(f[k])&&f[k]<=100)&&['calcium','iron','potassium','vitaminC'].every(k=>f[k]==null||known(f[k])&&f[k]<=100000)&&(!f.imageUrl||safeImage(f.imageUrl))&&(!f.thumbnailUrl||safeImage(f.thumbnailUrl))&&(!f.nutriScore||/^[abcde]$/.test(f.nutriScore));
C.validCatalogFood=f=>!!f&&['kcal','p','f','c'].every(k=>f[k]===null||known(f[k]))&&C.validFood({...f,kcal:f.kcal??0,p:f.p??0,f:f.f??0,c:f.c??0});
C.barcodeKey=code=>/^\d{8,14}$/.test(String(code))?String(code).padStart(14,'0'):null;
C.barcodeCandidates=code=>{code=String(code);if(!C.barcodeKey(code))return [];const result=[code];if(code.length===14&&code[0]==='0')result.push(code.slice(1));else if(code.length===12)result.push('0'+code);else if(code.length===13&&code[0]==='0')result.push(code.slice(1));return [...new Set(result)];};
const oldState=C.validState;
C.validState=s=>oldState(s)&&(s.extraTargets==null||extras.every(k=>s.extraTargets[k]==null||known(s.extraTargets[k])&&s.extraTargets[k]<=1000))&&s.customFoods.every(C.validFood)&&Object.values(s.days).every(d=>d.entries.every(e=>C.validFood(e.food)));
const oldMigrate=C.migrate;
C.migrate=input=>{const s=oldMigrate(input);s.extraTargets={...defaults,...s.extraTargets};if(!C.validState(s))throw Error('Invalid nutrients');return s;};
const oldDefaults=C.defaults;
C.defaults=()=>({...oldDefaults(),extraTargets:{...defaults}});
root.RationNutrition={extras,defaults,known,percent,tone,distribution,total,safeImage};
if(typeof module!=='undefined')module.exports=root.RationNutrition;
})(typeof window==='undefined'?globalThis:window);
