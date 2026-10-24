'use strict';
// Wortschatz Daily v1. Local-first vocabulary reader. No remote analytics or API keys.
const DB_NAME='wortschatz-daily-v1', DB_STORE='data', DB_KEY='state';
const $=(s,root=document)=>root.querySelector(s);
const $$=(s,root=document)=>[...root.querySelectorAll(s)];
const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lower=s=>String(s||'').normalize('NFC').trim().toLocaleLowerCase('de').replace(/\s+/g,' ');
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const addDays=(d,n)=>{let [y,m,day]=d.split('-').map(Number);return new Date(Date.UTC(y,m-1,day+n)).toISOString().slice(0,10)};
const typeName={verb:'Verb',noun:'Noun',adjective:'Adjective',adverb:'Adverb',function:'Function',phrase:'Phrase'};
let db=null, state=null, saveQueue=Promise.resolve(), noteTimer=null, toastTimer=null, syncBusy=false, lastCheck=0;
const ui={tab:'today',group:'all',view:'full',search:'',selected:null,context:[],dayId:null,importText:'',onlyWeak:false,storageError:false,syncMessage:'',sort:'study'};

function openDB(){return new Promise((resolve,reject)=>{
  if(!('indexedDB' in window)){reject(Error('IndexedDB unavailable'));return}
  const req=indexedDB.open(DB_NAME,1);
  req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains(DB_STORE))d.createObjectStore(DB_STORE)};
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('Cannot open storage'));
})}
function dbGet(){return new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readonly'),req=tx.objectStore(DB_STORE).get(DB_KEY);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function dbPut(data){return new Promise((resolve,reject)=>{if(!db){reject(Error('Storage not available'));return}const tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).put(data,DB_KEY);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Storage transaction aborted'))})}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),2600)}
function storageWarn(){ui.storageError=true;toast('Local storage error — please export a backup');let n=$('#storageNotice');if(n)n.classList.remove('hidden')}
function save(){if(!state)return;const snapshot=JSON.parse(JSON.stringify(state));saveQueue=saveQueue.catch(()=>{}).then(()=>dbPut(snapshot)).catch(storageWarn)}
function saveNoteSoon(){clearTimeout(noteTimer);noteTimer=setTimeout(()=>{noteTimer=null;save()},280)}
function flushNote(){if(noteTimer!==null){clearTimeout(noteTimer);noteTimer=null;save()}}
function emptyState(lesson){const words={},ids=[];for(const [i,raw] of lesson.words.entries()){
    const id=String(raw.id||`day1-${i+1}`);ids.push(id);words[id]={...raw,id};
  }
  return{version:1,words,lessons:[{id:'day1',day:'Day 1',topic:lesson.topic||'Everyday German',date:today(),wordIds:ids}],progress:{},notes:{},positions:{},history:[],settings:{theme:'light',view:'full'},catalogRevisions:{day1:Number(lesson.revision||1)},nextId:1};
}

function publicWord(w,day,i){
 if(!w||typeof w.de!=='string'||!w.de.trim()||typeof w.mm!=='string'||!w.mm.trim())throw Error('Invalid published word');
 let id=String(w.id||day+'-'+(i+1));
 if(!/^[a-z0-9_-]{1,70}$/i.test(id))throw Error('Invalid ID');
 return {...w,id,de:w.de.slice(0,160),mm:w.mm.slice(0,250),mode:w.mode==='passive'?'passive':'active',pos:['noun','verb','adjective','adverb','function','phrase'].includes(w.pos)?w.pos:'phrase'};
}
function migrateFirstDay(lesson,words,rev){
 const day=state.lessons.find(l=>l.id==='day1');if(!day)return false;
 const oldIds=[...day.wordIds],previous=new Map(oldIds.filter(id=>state.words[id]).map(id=>[lower(state.words[id].de),id]));
 const newIds=[],matched=new Set();
 for(const w of words){
  const old=previous.get(lower(w.de));if(old){matched.add(old);
   if(old!==w.id){
    if(state.notes[old]&&!state.notes[w.id])state.notes[w.id]=state.notes[old];
    if(state.progress[old]&&!state.progress[w.id])state.progress[w.id]=state.progress[old];
    for(const h of state.history)if(h.id===old)h.id=w.id;
    if(state.positions.day1===old)state.positions.day1=w.id;
    delete state.notes[old];delete state.progress[old];
   }
  }
  state.words[w.id]=w;newIds.push(w.id);
 }
 const archive=[];
 for(const id of oldIds){
  if(matched.has(id)){if(!newIds.includes(id))delete state.words[id];continue}
  const p=state.progress[id];
  if(state.notes[id]||(p&&p.status!=='new')||state.positions.day1===id||state.history.some(h=>h.id===id))archive.push(id);
  else{delete state.words[id];delete state.notes[id];delete state.progress[id]}
 }
 day.wordIds=newIds;day.topic=lesson.topic||day.topic;
 if(!newIds.includes(state.positions.day1))delete state.positions.day1;
 if(archive.length){
  const old=state.lessons.find(l=>l.id==='day1-legacy');
  if(old)old.wordIds=[...new Set([...old.wordIds,...archive])];
  else state.lessons.push({id:'day1-legacy',day:'Archive',topic:'Previously studied Day 1 words',date:today(),wordIds:archive});
 }
 state.catalogRevisions.day1=rev;return true;
}
function addPublicDay(item,lesson,words,rev){
 if(state.lessons.some(l=>l.id===item.id))return false;
 const seen=new Set(allWordIds().map(id=>lower(state.words[id].de))),ids=[];
 for(const w of words){if(seen.has(lower(w.de))||state.words[w.id])continue;state.words[w.id]=w;ids.push(w.id);seen.add(lower(w.de))}
 if(!ids.length)return false;
 state.lessons.push({id:item.id,day:String(lesson.day||item.id),topic:String(lesson.topic||'Daily vocabulary'),date:String(item.releaseDate||today()),wordIds:ids});
 state.catalogRevisions[item.id]=rev;return true;
}
async function syncCatalog(manual=false){
 if(syncBusy||!state||(!manual&&Date.now()-lastCheck<60000))return;
 syncBusy=true;lastCheck=Date.now();let count=0;
 try{
  const response=await fetch('./lessons/catalog.json',{cache:'no-store'});
  if(!response.ok)throw Error('Catalog offline');
  const catalog=await response.json();if(!Array.isArray(catalog.lessons)||catalog.lessons.length>366)throw Error('Invalid catalog');
  state.catalogRevisions=state.catalogRevisions||{};
  for(const item of catalog.lessons){
   if(!/^day[0-9]+$/.test(item.id)||item.path!=='lessons/'+item.id+'.json')continue;
   const rev=Number(item.revision||1),old=state.lessons.some(l=>l.id===item.id);
   if(old&&(state.catalogRevisions[item.id]||0)>=rev)continue;
   const r=await fetch('./'+item.path,{cache:'no-store'});if(!r.ok)throw Error('Lesson offline: '+item.id);
   const lesson=await r.json();if(!Array.isArray(lesson.words)||!lesson.words.length||lesson.words.length>200)throw Error('Bad lesson');
   const words=lesson.words.map((w,i)=>publicWord(w,item.id,i));
   if(new Set(words.map(w=>lower(w.de))).size!==words.length||new Set(words.map(w=>w.id)).size!==words.length)throw Error('Duplicate published words');
   if(old&&item.id==='day1'){if(migrateFirstDay(lesson,words,rev))count++}
   else if(!old){if(addPublicDay(item,lesson,words,rev))count++}
  }
  if(count){flushNote();save();const days=state.lessons.filter(l=>/^day[0-9]+$/.test(l.id));
   if(days.length>1)ui.dayId=days.at(-1).id;
   ui.syncMessage=count+' lesson update(s) loaded';render();toast(ui.syncMessage);
  }else{ui.syncMessage='Up to date · '+new Date().toLocaleString();if(manual)toast('Already up to date')}
 }catch(e){ui.syncMessage='Cannot check GitHub lessons while offline';console.warn('Lesson sync',e);if(manual)toast(ui.syncMessage)}
 finally{syncBusy=false;if(manual&&ui.tab==='settings')render()}
}

async function initialize(){
  try{db=await openDB()}catch(e){ui.storageError=true}
  try{if(db)state=await dbGet()}catch(e){ui.storageError=true}
  if(!validState(state)){
    try{const lesson=window.__WORTSCHATZ_EMBEDDED_DAY1 || await (async()=>{const response=await fetch('./lessons/day1.json',{cache:'no-cache'});if(!response.ok)throw Error('Failed to load Day 1');return response.json()})();state=emptyState(lesson);if(db)save()}
    catch(e){$('#app').innerHTML='<div class="notice">Day 1 data could not be loaded. Open the full folder through a local web server or hosted HTTPS website (not iPhone Files preview).<\/div>';return}
  }
  ui.dayId=state.lessons[state.lessons.length-1]?.id;
  ui.view=state.settings.view||'full';
  applyTheme();render();
  await syncCatalog();
  if(ui.storageError)toast('⚠ Progress may not persist on this browser');
  if('serviceWorker' in navigator && location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
function validState(s){return s&&s.version===1&&s.words&&typeof s.words==='object'&&!Array.isArray(s.words)&&Array.isArray(s.lessons)&&s.lessons.length>0&&s.progress&&typeof s.progress==='object'&&s.notes&&typeof s.notes==='object'&&s.positions&&typeof s.positions==='object'&&Array.isArray(s.history)&&s.settings}
function applyTheme(){document.documentElement.dataset.theme=state?.settings?.theme==='dark'?'dark':'light';$('#themeButton').setAttribute('aria-pressed',String(state?.settings?.theme==='dark'))}
function allWordIds(){const seen=new Set(),out=[];state.lessons.forEach(l=>l.wordIds.forEach(id=>{if(state.words[id]&&!seen.has(id)){seen.add(id);out.push(id)}}));return out}
function getLesson(){return state.lessons.find(l=>l.id===ui.dayId)||state.lessons.at(-1)}
function progress(id){return state.progress[id]||{status:'new',reps:0,due:null,interval:0}}
function track(id){return state.words[id]?.track==='medical'?'medical':'general'}
function learningMode(id){return progress(id).goalMode||state.words[id]?.mode||'passive'}
function suggestedActiveIds(){return allWordIds().filter(id=>track(id)==='general'&&state.words[id].mode==='passive'&&learningMode(id)==='passive'&&progress(id).status==='known'&&(progress(id).reps||0)>=2)}
function priorityValue(id){const w=state.words[id];return (({core:3,high:2,medium:1})[w.importance]||0)*10+(({very_common:3,common:2,situational:1})[w.frequencyEstimate]||0)}
function studied(id){return progress(id).status!=='new'}
function dueIds(){return allWordIds().filter(id=>{const p=progress(id);return p.status==='weak'||Boolean(p.due&&p.due<=today())})}
function selectedIds(){let ids=ui.tab==='review'?dueIds():ui.tab==='library'?allWordIds():getLesson().wordIds.filter(id=>state.words[id]);
  if(ui.group==='medical')ids=ids.filter(id=>track(id)==='medical');
  else if(ui.group==='active'||ui.group==='passive')ids=ids.filter(id=>track(id)==='general'&&learningMode(id)===ui.group);
  if(ui.sort==='priority')ids=[...ids].sort((a,b)=>priorityValue(b)-priorityValue(a));
  if(ui.onlyWeak&&ui.tab!=='review')ids=ids.filter(id=>progress(id).status==='weak');
  const q=lower(ui.search);if(q)ids=ids.filter(id=>{const w=state.words[id];return lower([w.de,w.mm,w.plural,w.forms,w.example,w.pattern,state.notes[id]||''].join(' ')).includes(q)});
  return ids;
}
function stats(){const ids=allWordIds();return{total:ids.length,read:ids.filter(studied).length,known:ids.filter(id=>progress(id).status==='known').length,weak:ids.filter(id=>progress(id).status==='weak').length,due:dueIds().length}}
function navHTML(){const tabs=[['today','▤','Today'],['library','☷','Library'],['review','↺','Review'],['progress','▥','Progress'],['settings','⚙','Settings']];return `<div class="nav-inner">${tabs.map(([key,icon,name])=>`<button type="button" class="nav-item ${ui.tab===key?'selected':''}" data-nav="${key}"><span class="symbol" aria-hidden="true">${icon}<\/span>${name}${key==='review'&&dueIds().length?` <span style="font-size:9px">(${dueIds().length})<\/span>`:''}<\/button>`).join('')}<\/div>`}
function render(){if(!state)return;$('#bottomNav').innerHTML=navHTML();applyTheme();const old=$('#tableScroll'),x=old?.scrollLeft||0,y=old?.scrollTop||0;
  $('#app').innerHTML=({today:renderStudy,library:renderStudy,review:renderReview,progress:renderProgress,settings:renderSettings})[ui.tab]();
  const el=$('#tableScroll');if(el){el.scrollLeft=x;el.scrollTop=y}
  if(ui.storageError){const n=$('#storageNotice');if(n)n.style.display='block'}
  if(ui.selected)renderDetail();
}
function counterCard(num,label,desc=''){return `<div class="card tight"><div class="stat-label">${label}<\/div><div class="stat-number">${num}<\/div>${desc?`<small>${desc}<\/small>`:''}<\/div>`}
function lessonSelector(){return `<select class="select" id="daySelect" aria-label="Study day">${state.lessons.map(l=>`<option value="${escapeHTML(l.id)}" ${l.id===getLesson().id?'selected':''}>${escapeHTML(l.day)} — ${escapeHTML(l.topic)}<\/option>`).join('')}<\/select>`}
function toolbar(){return `<div class="toolbar section"><div class="toolbar-line"><div class="toolbar-group">${ui.tab==='today'?lessonSelector():''}<div class="segment" aria-label="Vocabulary mode">${[['all','All'],['active','Active'],['passive','Passive'],['medical','🩺 Medical']].map(([v,n])=>`<button type="button" data-group="${v}" class="${ui.group===v?'active':''}">${n}<\/button>`).join('')}<\/div><\/div><div class="toolbar-group"><span class="subtle" style="font-size:12px">Sort:</span><div class="segment">${[['study','Study'],['priority','Priority']].map(([v,n])=>`<button data-sort="${v}" class="${ui.sort===v?'active':''}">${n}</button>`).join('')}</div><span class="subtle" style="font-size:12px">View:<\/span><div class="segment">${[['compact','Compact'],['full','Full']].map(([v,n])=>`<button data-view="${v}" class="${ui.view===v?'active':''}">${n}<\/button>`).join('')}<\/div><\/div><\/div><div class="toolbar-line"><input id="searchBox" class="search" type="search" placeholder="Search German / မြန်မာ / grammar …" value="${escapeHTML(ui.search)}" aria-label="Search words" />${ui.tab!=='review'?`<button class="button slim ${ui.onlyWeak?'primary':''}" data-action="weakFilter">${ui.onlyWeak?'✓ Weak only':'Weak only'}<\/button>`:''}<\/div><\/div>`}
function statusDot(id){const status=progress(id).status;return `<span class="indicator ${status}" title="${status}"><\/span>`}
function deHTML(de){const m=String(de).match(/^(der|die|das)\s+(.+)$/);return m?`<span class="article ${m[1]}">${m[1]}<\/span> ${escapeHTML(m[2])}`:escapeHTML(de)}
function essentials(w){if(w.pos==='noun')return w.plural&&w.plural!=='—'?`Plural: ${w.plural}`:'Usually no plural';if(w.pos==='verb'){
  const pieces=(w.forms||'').split('·').map(s=>s.trim()).filter(Boolean),er=pieces.find(s=>/^er\s/i.test(s));return er?`${er}${w.pattern?` · ${w.pattern}`:''}`:(w.forms||w.pattern||'Verb')}
  if(w.pattern)return w.pattern;return typeName[w.pos]||w.pos||'—';
}
function makeTable(){const ids=selectedIds();const total=ui.tab==='today'?getLesson().wordIds.length:allWordIds().length;
  const body=ids.map((id,i)=>{const w=state.words[id];const mark=progress(id).status;return `<tr data-id="${escapeHTML(id)}" tabindex="0" aria-label="Open ${escapeHTML(w.de)} details"><td class="pinned"><div class="wordname">${deHTML(w.de)}<\/div><div class="word-sub">${statusDot(id)} ${track(id)==='medical'?'🩺 Medical':escapeHTML(typeName[w.pos]||w.pos)+' · '+(learningMode(id)==='active'?'Active':'Passive')}${progress(id).goalMode==='active'?' ↑ promoted':''} · ${escapeHTML(w.importance||'practical')} ${mark!=='new'?'· '+escapeHTML(mark):''}<\/div><\/td><td class="essential"><span class="wordmeta">${escapeHTML(essentials(w))}<\/span><\/td><td class="translation">${escapeHTML(w.mm)}<\/td>${ui.view==='full'?`<td class="example">${escapeHTML(w.example||'—')}<\/td>`:''}<\/tr>`}).join('');
  return `<section class="card table-card section"><div class="table-title between"><div><strong>Vocabulary at a glance<\/strong><div class="subtle" style="font-size:11px;margin-top:2px">${ids.length} visible · ${total} total<\/div><\/div><span class="chip">↔ Swipe sideways<\/span><\/div><div class="table-scroll" id="tableScroll" tabindex="0" aria-label="Horizontally scrollable vocabulary table"><table class="vocab-table"><thead><tr><th class="pinned">German word<\/th><th class="essential">Essential info<\/th><th class="translation">မြန်မာ Translation<\/th>${ui.view==='full'?'<th class="example">Example sentence<\/th>':''}<\/tr><\/thead><tbody>${body||`<tr><td colspan="${ui.view==='full'?4:3}" class="empty">No words match these filters.<\/td><\/tr>`}<\/tbody><\/table><\/div><div class="hint-strip">German word stays pinned on the left. Tap any row to read details, then use Back / Next.<\/div><\/section>`}
function renderStudy(){const l=getLesson(),s=stats(),ids=l.wordIds,read=ids.filter(studied).length,percent=Math.round(read/Math.max(1,ids.length)*100),recentId=state.positions[l.id],resume=recentId&&state.words[recentId];
  return `<div class="hero"><div class="eyebrow">${ui.tab==='library'?'My vocabulary library':'Daily vocabulary · List-first learning'}<\/div><h1>${ui.tab==='library'?'All your words, one place.':'Read first. Recall later.'}<\/h1><p class="subtitle">${ui.tab==='library'?'Search every study day, open details, review notes.':'German + grammar + translation at a glance, followed by detailed reading.'}<\/p><\/div>
  ${ui.storageError?'<div class="notice" id="storageNotice">⚠ Persistent device storage is unavailable. Your changes might not survive a restart. Do not rely on this as your only copy.<\/div>':''}
  <div class="grid grid-3">${counterCard(ui.tab==='today'?ids.length:s.total,'Vocabulary',ui.tab==='today'?l.day:'All lessons')}${counterCard(ui.tab==='today'?read:s.read,'Studied','Marked/read')}${counterCard(s.due,'Review due','Needs recall')}<\/div>
  ${ui.tab==='today'?`<section class="card section"><div class="between"><div><div class="stat-label">${escapeHTML(l.day)} — ${escapeHTML(l.topic)}<\/div><strong>${read} / ${ids.length} studied<\/strong><\/div><span class="chip">${percent}%<\/span><\/div><div class="progressbar" style="margin:12px 0 14px"><div style="width:${percent}%"><\/div><\/div><div class="buttons"><button class="button primary" data-action="resume">${resume?'Continue: '+escapeHTML(resume.de):'Start reading →'}<\/button><button class="button soft" data-nav="review">Review due (${s.due})<\/button><\/div><\/section>`:''}
  ${toolbar()}${makeTable()}`}
function renderReview(){const d=dueIds();const s=stats();return `<div class="hero"><div class="eyebrow">Review · No flashcards required<\/div><h1>Words to revisit.<\/h1><p class="subtitle">Weak words and due items. Read their content again, and mark how confidently you can use each word.<\/p><\/div><div class="grid grid-3">${counterCard(s.due,'Due now')}${counterCard(s.weak,'Weak words')}${counterCard(s.known,'Known words')}<\/div><section class="card section"><h2>List-based revision<\/h2><p class="subtitle">Tap each row for meaning, grammar and examples. Mark Weak / Studied / Known from the detailed reader.<\/p><\/section>${toolbar()}${makeTable()}`}
function recentHistory(){let h=state.history.slice(-10).reverse();if(!h.length)return '<p class="subtle">No study marks yet. Open a word and tap Studied, Known or Weak.<\/p>';return h.map(x=>`<div class="activity"><div><strong>${escapeHTML(state.words[x.id]?.de||'Word')}<\/strong><div class="subtle" style="font-size:11px">${escapeHTML(x.date)}<\/div><\/div><span class="chip ${escapeHTML(x.status)}">${escapeHTML(x.status)}<\/span><\/div>`).join('')}
function renderProgress(){const s=stats(),percent=Math.round(s.read/Math.max(1,s.total)*100);return `<div class="hero"><div class="eyebrow">Learning history<\/div><h1>Your progress.<\/h1><p class="subtitle">Studied means you have read/practiced the word — not necessarily mastered it.<\/p><\/div><div class="grid grid-3">${counterCard(s.total,'Total words')}${counterCard(s.read,'Studied')}${counterCard(s.known,'Known')}<\/div><section class="card section"><div class="between"><h2>Learning coverage<\/h2><strong>${percent}%<\/strong><\/div><div class="progressbar" style="margin:14px 0"><div style="width:${percent}%"><\/div><\/div><div class="subtle">${s.weak} Weak · ${s.due} due · ${state.lessons.length} study day(s)<\/div><\/section><section class="card section"><h2 style="margin-bottom:14px">Lessons<\/h2>${state.lessons.map(l=>{const n=l.wordIds.filter(studied).length;return `<div class="activity"><div><strong>${escapeHTML(l.day)} · ${escapeHTML(l.topic)}<\/strong><div class="subtle">${n}/${l.wordIds.length} studied<\/div><\/div><button class="button slim" data-open-lesson="${escapeHTML(l.id)}">Open →<\/button><\/div>`}).join('')}<\/section><section class="card section"><h2 style="margin-bottom:10px">Recent activity<\/h2>${recentHistory()}<\/section>`}
function renderSettings(){return `<div class="hero"><div class="eyebrow">Private, local-first<\/div><h1>Your data & new lessons.<\/h1><p class="subtitle">Public lessons download from GitHub; notes and progress stay in private local IndexedDB. No OpenAI API.<\/p><\/div>
 <section class="card section stack"><h2>Backup & restore<\/h2><p class="setting-text">Backup includes lessons, notes, review marks, positions and learning history. Save your file to Files or iCloud Drive. Restore replaces current data only after confirmation.<\/p><div class="buttons"><button class="button primary" data-action="export">↓ Export JSON backup<\/button><label class="button" for="backupFile">↑ Restore backup<\/label><input class="file-input" id="backupFile" type="file" accept="application/json,.json" /><\/div><\/section>
 <section class="card section stack"><h2>GitHub daily lessons</h2><p class="setting-text">Day 2, 3… appear after publishing, when you open this app online. ${escapeHTML(ui.syncMessage||'Checking on app launch.')}</p><div class="buttons"><button class="button primary" data-action="syncCatalog">↻ Check new lessons</button></div><p class="setting-text">Public vocabulary is stored on GitHub. Personal notes, learning history and Weak/Known marks still need JSON backup.</p></section>
 <section class="card section stack"><h2>Add a lesson from ChatGPT<\/h2><p class="setting-text">Copy a vocabulary generation prompt, paste it into ChatGPT, then paste returned JSON below. No API charge. Words are de-duplicated before adding.<\/p><div class="buttons"><button class="button soft" data-action="copyPrompt">Copy Day ${state.lessons.length+1} prompt<\/button><label class="button" for="lessonFile">Open lesson JSON<\/label><input class="file-input" id="lessonFile" type="file" accept="application/json,.json" /><\/div><textarea id="lessonText" class="textarea" placeholder='{"day":"Day 2","topic":"...","words":[{"de":"...","mm":"...","mode":"active","pos":"verb"}]}' aria-label="Paste lesson JSON">${escapeHTML(ui.importText)}<\/textarea><button class="button primary" data-action="import">Import new words<\/button><\/section>
 <section class="card section stack"><h2>Storage & safety<\/h2><p class="setting-text">Safari Home Screen installation and Safari browser can maintain separate website data. Clearing website data, uninstalling the web app, or changing phones can erase local progress. Export backups regularly. The original GitHub Wortschatz app is completely separate.<\/p><div class="buttons"><button class="button soft" data-action="theme">Switch theme<\/button><\/div><small>${allWordIds().length} words · ${state.lessons.length} lessons · ${state.history.length} study events<\/small><\/section>`}
function detailInfo(w){return w.pos==='noun'?`<div>${escapeHTML(w.plural?'Plural: '+w.plural:'Plural not provided')}<\/div>`:w.pos==='verb'?`<div>${escapeHTML(w.forms||'No conjugation supplied')}<\/div>`:`<div>${escapeHTML(typeName[w.pos]||w.pos)}<\/div>`}
function renderDetail(){const root=$('#detailRoot');const id=ui.selected,w=state.words[id];if(!w){ui.selected=null;root.innerHTML='';return}
  const i=ui.context.indexOf(id),p=progress(id),note=state.notes[id]||'';
  root.innerHTML=`<div class="overlay" id="modalOverlay"><section class="detail-panel" role="dialog" aria-modal="true" aria-label="${escapeHTML(w.de)} details"><div class="detail-head"><button class="button slim" data-action="close">← Word list<\/button><span class="subtle" style="font-size:12px">${i+1} / ${ui.context.length}<\/span><button class="icon-button" data-action="close" aria-label="Close">×<\/button><\/div>
  <div class="detail-body" id="detailBody"><div class="between"><span class="chip ${escapeHTML(w.mode)}">${w.mode==='active'?'● Active':'● Passive'} · ${escapeHTML(typeName[w.pos]||w.pos)}<\/span><button class="button slim soft" data-action="speak" data-say="word" aria-label="Play German pronunciation">🔊 Listen<\/button><\/div>${w.level?`<div class="subtle" style="font-size:11px;margin:8px 0">${escapeHTML(w.level)} · ${escapeHTML(w.importance||'practical')} priority · ${escapeHTML(w.frequencyEstimate||'unranked')} (estimated, not corpus rank)</div>`:''}<div class="detail-word">${deHTML(w.de)}<\/div><div class="detail-meaning">${escapeHTML(w.mm)}<\/div>
  <div class="detail-item"><div class="detail-label">Essential forms<\/div>${detailInfo(w)}<\/div>
  ${w.pattern?`<div class="detail-item"><div class="detail-label">Grammar / Common usage<\/div><strong>${escapeHTML(w.pattern)}<\/strong><\/div>`:''}
  ${w.example?`<div class="detail-item"><div class="between"><div class="detail-label">Example sentence<\/div><button class="button slim" data-action="speak" data-say="example">▶ DE<\/button><\/div><div class="detail-example">${escapeHTML(w.example)}<\/div>${w.translation?`<div class="detail-trans">${escapeHTML(w.translation)}<\/div>`:''}<\/div>`:''}
  <div class="detail-item"><div class="detail-label">Learning status — manually mark<\/div><div class="status-row">${[['new','New'],['studied','✓ Studied'],['known','★ Known'],['weak','! Weak']].map(([key,label])=>`<button class="status-btn ${p.status===key?'selected':''} ${key==='weak'?'weak':''}" data-mark="${key}">${label}<\/button>`).join('')}<\/div><p class="subtle" style="font-size:11px;margin-top:8px">Known = confident recall; Studied = read/practiced; Weak = revise again.<\/p>${p.due?`<p class="subtle" style="font-size:11px;margin-top:5px">Next review: ${escapeHTML(p.due)}<\/p>`:''}<\/div>
  <div class="detail-item"><div class="detail-label">Personal notes · Auto-save<\/div><textarea class="note-textarea" id="wordNote" placeholder="My examples, grammar reminders, pronunciation notes…">${escapeHTML(note)}<\/textarea><div class="subtle" id="noteSaveText" style="font-size:11px;margin-top:5px">Saved locally as you type<\/div><\/div>
  <\/div><div class="detail-footer"><button class="button block soft" data-step="-1" ${i<=0?'disabled':''}>← Back<\/button><button class="button block primary" data-step="1" ${i>=ui.context.length-1?'disabled':''}>Next →<\/button><\/div><\/section><\/div>`;
  document.body.style.overflow='hidden';const body=$('#detailBody');if(body)body.scrollTop=0;
}
function openWord(id){const ids=selectedIds();if(!ids.includes(id))return;flushNote();ui.context=ids;ui.selected=id;if(ui.tab==='today'){state.positions[getLesson().id]=id;save()}renderDetail()}
function closeDetail(){flushNote();ui.selected=null;ui.context=[];$('#detailRoot').innerHTML='';document.body.style.overflow='';render()}
function stepWord(step){const i=ui.context.indexOf(ui.selected),next=ui.context[i+step];if(!next)return;flushNote();ui.selected=next;if(ui.tab==='today'){state.positions[getLesson().id]=next;save()}renderDetail()}
function markWord(status){const id=ui.selected;if(!id)return;const old=progress(id),reps=status==='new'?0:(old.reps||0)+1;let due=null,interval=0;
  if(status==='weak'){interval=1;due=addDays(today(),1)}
  if(status==='studied'){interval=1;due=addDays(today(),1)}
  if(status==='known'){const days=[3,7,14,30,60];interval=days[Math.min(reps-1,days.length-1)];due=addDays(today(),interval)}
  state.progress[id]={status,reps,due,interval,lastReviewed:today()};state.history.push({id,status,date:today(),at:new Date().toISOString()});if(state.history.length>5000)state.history=state.history.slice(-5000);save();renderDetail();toast('Marked '+status+' · saved locally')
}
function speak(choice){const w=state.words[ui.selected];if(!w)return;const phrase=choice==='example'?w.example:w.de;
  if(!('speechSynthesis' in window))return toast('German TTS not supported by this browser');
  speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(phrase);u.lang='de-DE';u.rate=.82;speechSynthesis.speak(u)
}
function setTab(tab){flushNote();ui.tab=tab;ui.group='all';ui.search='';ui.onlyWeak=false;ui.selected=null;$('#detailRoot').innerHTML='';document.body.style.overflow='';render();window.scrollTo({top:0,behavior:'instant'})}
function toggleTheme(){state.settings.theme=state.settings.theme==='dark'?'light':'dark';save();render()}
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),6000)}
function exportBackup(){download(JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2),`wortschatz-daily-backup-${today()}.json`,'application/json');toast('Backup downloaded — save it safely')}
function promptText(){return `Act as my German intensive A1 tutor. Generate Day ${state.lessons.filter(l=>/^day[0-9]+$/.test(l.id)).length+1} as VALID JSON ONLY (no markdown), with exactly 60 unique NEW German lemmas. Group: Active 25 (10 verbs, 6 adjectives/adverbs, 5 essential nouns, 4 high-utility function words/phrases); Passive 35 mostly nouns. Curriculum sequence: cover Goethe A1 Wortliste and foundational A1.1 everyday communication before harder A1.2/A2 vocabulary. Prioritize common daily communication, function, family, time, travel, home and health; avoid obscure nouns. Use frequency as qualitative judgments only, NOT invented corpus ranks. Every word must include "level":"A1 Foundation" or "A1" (when appropriate), "importance":"core" or "high", and "frequencyEstimate":"very_common", "common" or "situational". Avoid ALL these already taught lemmas, ignoring capitalization and articles: ${allWordIds().map(id=>state.words[id].de).join('; ')}. Output schema: {"day":"Day N","topic":"short topic","words":[{"de":"der Termin","mm":"မြန်မာအဓိပ္ပာယ်","mode":"active","pos":"noun","plural":"die Termine","forms":"","pattern":"einen Termin vereinbaren","example":"Ich habe einen Termin.","translation":"မြန်မာဘာသာပြန်","level":"A1","importance":"core","frequencyEstimate":"situational"}]}. Verbs must have ich/du/er Präsens; nouns use accurate article and plural. German example sentences must be natural and grammatically correct. Every translation must be correct Myanmar Burmese. Avoid any duplicate lemma or duplicate in the provided existing list.`}
async function copyPrompt(){const t=promptText();try{await navigator.clipboard.writeText(t);toast('Prompt copied — paste into ChatGPT')}catch(e){const x=$('#lessonText');x.value=t;x.focus();x.select();toast('Clipboard blocked; select and copy this prompt')}}
function readJsonFile(file,cb){if(!file)return;const reader=new FileReader();reader.onload=()=>{try{cb(JSON.parse(String(reader.result).replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'')))}catch(e){toast('This file is not valid JSON')}};reader.readAsText(file)}
function restoreBackup(obj){if(!validState(obj)){toast('Not a compatible Wortschatz Daily backup');return}
  const ids=new Set(Object.keys(obj.words));if(obj.lessons.some(l=>!Array.isArray(l.wordIds)||l.wordIds.some(id=>!ids.has(id)))){toast('Backup has missing word references');return}
  const n=Object.keys(obj.words).length;if(!confirm(`Restore backup with ${n} words and ${obj.lessons.length} lessons?\n\nThis replaces all current local vocabulary, notes and progress.`))return;
  flushNote();state=JSON.parse(JSON.stringify(obj));ui.dayId=state.lessons.at(-1).id;ui.view=state.settings.view||'full';ui.selected=null;save();setTab('today');toast('Backup restored');syncCatalog(true)
}
function importLesson(obj){if(!obj||!Array.isArray(obj.words)||obj.words.length<1||obj.words.length>200){toast('JSON needs a words array (1–200 items)');return}
  if(obj.words.some(w=>!w||typeof w!=='object'||typeof w.de!=='string'||!w.de.trim()||typeof w.mm!=='string'||!w.mm.trim())){toast('Every item needs German de and Myanmar mm');return}
  const known=new Map(allWordIds().map(id=>[lower(state.words[id].de),id])),ids=[];let duplicates=0;
  const words={};let seq=state.nextId||1;
  for(const raw of obj.words){const key=lower(raw.de);if(known.has(key)){duplicates++;continue}
    const id=`custom-${seq++}`;known.set(key,id);ids.push(id);words[id]={id,de:String(raw.de).slice(0,160),mm:String(raw.mm).slice(0,250),pos:['noun','verb','adjective','adverb','function','phrase'].includes(raw.pos)?raw.pos:'phrase',mode:raw.mode==='passive'?'passive':'active',forms:String(raw.forms||'').slice(0,240),plural:String(raw.plural||'').slice(0,160),example:String(raw.example||'').slice(0,450),translation:String(raw.translation||'').slice(0,500),pattern:String(raw.pattern||'').slice(0,250)};
  }
  if(!ids.length){toast(`No new words: ${duplicates} duplicates`);return}
  const dayNum=state.lessons.length+1,id=`day${dayNum}-${Date.now()}`;
  Object.assign(state.words,words);state.lessons.push({id,day:String(obj.day||`Day ${dayNum}`).slice(0,60),topic:String(obj.topic||'New vocabulary').slice(0,130),date:today(),wordIds:ids});state.nextId=seq;
  ui.dayId=id;ui.importText='';ui.group='all';ui.search='';ui.onlyWeak=false;save();setTab('today');toast(`Imported ${ids.length} words · ${duplicates} duplicate(s) skipped`)
}
function importFromText(){let txt=$('#lessonText')?.value?.trim();if(!txt)return toast('Paste JSON first');let obj;try{obj=JSON.parse(txt.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''))}catch(e){return toast('Invalid JSON — check quotation marks and commas')}importLesson(obj)}
function resume(){const l=getLesson(),last=state.positions[l.id];const id=last&&l.wordIds.includes(last)?last:l.wordIds.find(id=>!studied(id))||l.wordIds[0];
  if(ui.group!=='all'&&!(ui.group==='medical'?track(id)==='medical':track(id)==='general'&&learningMode(id)===ui.group))ui.group='all';ui.search='';ui.onlyWeak=false;render();openWord(id)
}
// Centralized event delegation keeps table scroll position while the word detail opens.
document.addEventListener('click',event=>{
  if(!state)return;
  const nav=event.target.closest('[data-nav]');if(nav){setTab(nav.dataset.nav);return}
  const row=event.target.closest('tr[data-id]');if(row){openWord(row.dataset.id);return}
  const step=event.target.closest('[data-step]');if(step){stepWord(Number(step.dataset.step));return}
  const mark=event.target.closest('[data-mark]');if(mark){markWord(mark.dataset.mark);return}
  const group=event.target.closest('[data-group]');if(group){ui.group=group.dataset.group;render();return}
  const sort=event.target.closest('[data-sort]');if(sort){ui.sort=sort.dataset.sort;render();return}
  const view=event.target.closest('[data-view]');if(view){ui.view=view.dataset.view;state.settings.view=ui.view;save();render();return}
  const lesson=event.target.closest('[data-open-lesson]');if(lesson){ui.dayId=lesson.dataset.openLesson;setTab('today');return}
  const act=event.target.closest('[data-action]');if(!act){if(event.target.id==='modalOverlay')closeDetail();return}
  switch(act.dataset.action){case 'close':closeDetail();break;case 'speak':speak(act.dataset.say);break;case 'resume':resume();break;case 'theme':toggleTheme();break;case 'export':exportBackup();break;case 'copyPrompt':copyPrompt();break;case 'import':importFromText();break;case 'syncCatalog':syncCatalog(true);break;case 'weakFilter':ui.onlyWeak=!ui.onlyWeak;render();break;}
});
document.addEventListener('change',event=>{
  const t=event.target;if(!state)return;
  if(t.id==='daySelect'){ui.dayId=t.value;ui.group='all';ui.search='';ui.onlyWeak=false;render()}
  if(t.id==='backupFile')readJsonFile(t.files?.[0],restoreBackup);
  if(t.id==='lessonFile')readJsonFile(t.files?.[0],obj=>{ui.importText=JSON.stringify(obj,null,2);render();toast('Lesson JSON loaded — tap Import')});
});
document.addEventListener('input',event=>{
  const t=event.target;if(!state)return;
  if(t.id==='wordNote'&&ui.selected){state.notes[ui.selected]=t.value;saveNoteSoon();const txt=$('#noteSaveText');if(txt)txt.textContent='Auto-saving…'}
  if(t.id==='searchBox'){ui.search=t.value;const el=$('#tableScroll'),x=el?.scrollLeft||0;const scroller=$('#tableScroll');if(scroller){const wrap=scroller.closest('.table-card');const next=document.createElement('div');next.innerHTML=makeTable();wrap.replaceWith(next.firstElementChild);$('#tableScroll').scrollLeft=x}const v=$('#searchBox');v?.focus();}
  if(t.id==='lessonText')ui.importText=t.value;
});
document.addEventListener('focusout',event=>{if(event.target.id==='wordNote')flushNote()});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&ui.selected){closeDetail();return}
  if((event.key==='Enter'||event.key===' ')&&event.target.matches('tr[data-id]')){event.preventDefault();openWord(event.target.dataset.id)}
  if(ui.selected&&event.target.tagName!=='TEXTAREA'&&event.target.tagName!=='INPUT'&&event.key==='ArrowRight')stepWord(1);
  else if(ui.selected&&event.target.tagName!=='TEXTAREA'&&event.target.tagName!=='INPUT'&&event.key==='ArrowLeft')stepWord(-1);
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)flushNote();else if(state)syncCatalog()});
window.addEventListener('online',()=>{if(state)syncCatalog(true)});
$('#themeButton').addEventListener('click',()=>{if(state)toggleTheme()});
initialize();
