import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const readJson=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const catalog=readJson('lessons/catalog.json');
const days=catalog.lessons.map(item=>({item,data:readJson(item.path)}));
const allowedPos=new Set(['noun','verb','adjective','adverb','function','phrase']);
const normalized=value=>String(value).normalize('NFC').trim().toLocaleLowerCase('de').replace(/^(der|die|das)\s+/,'').replace(/\s+/g,' ');
const allWords=days.flatMap(({item,data})=>data.words.map(word=>({...word,dayId:item.id})));
const byId=id=>allWords.find(word=>word.id===id);

assert.equal(days.length,6,'catalog must contain Day 1 through Day 6');
assert.equal(allWords.length,408,'published vocabulary total must remain 408');
assert.equal(new Set(allWords.map(word=>word.id)).size,408,'word IDs must be globally unique');
assert.equal(new Set(allWords.map(word=>normalized(word.de))).size,408,'article-stripped German headwords must be globally unique');

const verifiedPlurals={
 'a1core-19':'die Zeiten (je nach Bedeutung; „Zeit haben“ meist ohne Plural)',
 'a1core-44':'die Arbeiten (Aufgaben/Werke; „zur Arbeit“ meist ohne Plural)',
 'a1core-50':'die Gelder (bestimmte Geldbeträge/Mittel; Alltag meist ohne Plural)',
 'a1core-54':'die Frühstücke','d2-035':'die Kaffees','d2-036':'die Tees (Sorten)',
 'd2-065':'die Blutdrücke (fachsprachlich; auch: die Blutdrucke)','d2-066':'die Pulse',
 'd4-017':'die Hilfen','d4-052':'die Mittagessen','d4-053':'die Abendessen','d5-020':'die Urlaube'
};
for(const [id,plural] of Object.entries(verifiedPlurals))assert.equal(byId(id)?.plural,plural,`${id}: verified plural must not regress`);
assert.equal(byId('d5-065')?.de,'die Beschwerde','medical entry must teach the singular dictionary lemma');
assert.equal(byId('d5-065')?.plural,'die Beschwerden (medizinisch meist im Plural)','medical plural usage must be explicit');
assert.match(byId('d5-058')?.translation,/ရထားလမ်းနံပါတ် ၃/,'Gleis must be translated as track, not platform');
assert.match(byId('d2-066')?.translation,/သွေးခုန်စည်းချက်/,'regelmäßiger Puls must describe a regular pulse rhythm');

for(const {item,data} of days){
 assert.equal(data.id,item.id,`${item.id}: lesson ID must match catalog`);
 assert.equal(data.revision,item.revision,`${item.id}: revision must match catalog`);
 assert.equal(data.words.length,68,`${item.id}: expected 68 entries`);
 const generalActive=data.words.filter(word=>word.track==='general'&&word.mode==='active');
 const generalPassive=data.words.filter(word=>word.track==='general'&&word.mode==='passive');
 const medicalActive=data.words.filter(word=>word.track==='medical'&&word.mode==='active');
 const medicalPassive=data.words.filter(word=>word.track==='medical'&&word.mode==='passive');
 assert.deepEqual([generalActive.length,generalPassive.length,medicalActive.length,medicalPassive.length],[25,35,3,5],`${item.id}: section distribution`);

 for(const word of data.words){
  const label=`${item.id}/${word.id}`;
  assert.match(word.id,/^[a-z0-9_-]{1,70}$/i,`${label}: safe ID`);
  assert.equal(word.de,word.de.normalize('NFC'),`${label}: German must use NFC Unicode`);
  assert.ok(word.de.trim(),`${label}: German headword required`);
  assert.ok(word.mm.trim(),`${label}: Myanmar meaning required`);
  assert.ok(word.example.trim(),`${label}: German example required`);
  assert.ok(word.translation.trim(),`${label}: Myanmar example translation required`);
  assert.ok(word.pattern.trim(),`${label}: usage pattern required`);
  assert.ok(allowedPos.has(word.pos),`${label}: supported part of speech`);
  assert.ok(word.mode==='active'||word.mode==='passive',`${label}: supported learning mode`);
  assert.ok(word.track==='general'||word.track==='medical',`${label}: supported track`);
  if(word.pos==='noun'){
   assert.match(word.de,/^(der|die|das)\s+\S/u,`${label}: noun needs nominative article`);
   assert.ok(word.plural.trim(),`${label}: noun needs plural or an explicit no-plural marker`);
   assert.ok(word.plural.startsWith('die ')||word.plural.startsWith('—'),`${label}: noun plural must be speakable or explicitly unavailable`);
  }
  if(word.pos==='verb')assert.match(word.forms,/^ich .+ · du .+ · er .+$/u,`${label}: verb needs ich/du/er present forms`);
  if(word.track==='medical'){
   assert.ok(word.patientGerman?.trim(),`${label}: patient-friendly German required`);
   assert.ok(word.clinicalGerman?.trim(),`${label}: clinical German required`);
  }
 }
}

const context={
 console,setTimeout,clearTimeout,Date,Intl,__WORTSCHATZ_TEST_MODE__:true,
 document:{addEventListener(){}},window:{addEventListener(){}}
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8'),context,{filename:'app.js'});
const hooks=context.__WORTSCHATZ_TEST__;
assert.ok(hooks,'app test hooks must load without starting the browser UI');
assert.equal(hooks.wordKey('der Name'),hooks.wordKey('Name'),'runtime duplicate detection must ignore nominative articles');

for(const word of allWords){
 const spoken=hooks.spokenEssentialForms(word);
 assert.ok(spoken.every(part=>!/^(Plural|Nominativ|Akkusativ|Dativ|Frage|Adverb|Konjunktion|Partikel)(:|\b)/i.test(part)),`${word.id}: TTS must not read grammar labels`);
 if(word.pos==='verb')assert.equal(spoken.length,3,`${word.id}: TTS must read all three essential verb forms`);
 if(word.pos==='noun'&&word.plural.startsWith('die '))assert.deepEqual([...spoken],[word.plural.replace(/\s*\([^)]*\)/g,'').trim()],`${word.id}: TTS must read the clean plural`);
 if(word.pos==='noun'&&word.plural.startsWith('—'))assert.equal(spoken.length,0,`${word.id}: no-plural marker must stay silent`);
}

const day2=structuredClone(days.find(({item})=>item.id==='day2').data);
const oldWord=structuredClone(day2.words[0]);
const state={
 words:{[oldWord.id]:{...oldWord,translation:'old cached translation'}},
 lessons:[{id:'day2',day:'Day 2',topic:'old topic',date:'2026-10-25',wordIds:[oldWord.id]}],
 progress:{[oldWord.id]:{status:'known',goalMode:'active'}},notes:{[oldWord.id]:'my private note'},
 positions:{day2:oldWord.id},history:[{id:oldWord.id,status:'known'}],settings:{},catalogRevisions:{day2:1}
};
const replacement={...oldWord,id:'d2-renamed-for-test',translation:'repaired translation'};
hooks.setStateForTest(state);
assert.equal(hooks.migratePublicDay({id:'day2'},day2,[replacement],2),true,'published lesson migration should run');
const migrated=hooks.getStateForTest();
assert.equal(migrated.words[replacement.id].translation,'repaired translation','published content must refresh');
assert.equal(migrated.notes[replacement.id],'my private note','private note must survive an ID migration');
assert.equal(migrated.progress[replacement.id].status,'known','learning progress must survive an ID migration');
assert.equal(migrated.progress[replacement.id].goalMode,'active','manual promotion must survive an ID migration');
assert.equal(migrated.positions.day2,replacement.id,'reading position must follow an ID migration');
assert.equal(migrated.history[0].id,replacement.id,'review history must follow an ID migration');
assert.equal(migrated.catalogRevisions.day2,2,'catalog revision must advance after migration');

console.log('PASS: 408 entries, six lesson schemas, uniqueness, grammar metadata, TTS forms, and progress-preserving migration');
