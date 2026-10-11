import { afterEach,describe,it,expect } from 'vitest';
import { mkdtempSync,rmSync,readFileSync,writeFileSync,mkdirSync,existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { zipSync,strToU8 } from 'fflate';
import { Store } from '../server/store';
import { Importer } from '../server/importer';
import { river,preflop,headsUp,sidePot } from './fixtures';
import { makeChallenge,gradeChallenge } from '../src/training/training';
import { defaultRanges } from '../src/poker/ranges';
import { straightDraw } from '../src/poker/draws';
const temp:{dir:string;store:Store}[]=[];const setup=()=>{const dir=mkdtempSync(path.join(os.tmpdir(),'monarch-test-')),store=new Store(dir);temp.push({dir,store});return {dir,store,importer:new Importer(store)};};afterEach(()=>{for(const t of temp.splice(0)){try{t.store.close();}catch{}rmSync(t.dir,{recursive:true,force:true});}});
describe('SQLite imports and persistence',()=>{
 it('imports new hands and skips duplicates with raw provenance and archive',async()=>{const{store,importer}=setup(),one=await importer.ingest('gg.txt',Buffer.from(river+'\n'+preflop)),two=await importer.ingest('again.txt',Buffer.from(river));expect(one.newHands).toBe(2);expect(two.duplicates).toBe(1);expect(store.summary().total.hands).toBe(2);expect(store.summary().sessions).toHaveLength(1);expect(readFileSync(one.archive,'utf8')).toContain(river.trim());expect(store.getHand('TEST-RIVER-001')?.raw).toContain('*** SUMMARY ***');expect(store.db.prepare('SELECT COUNT(*) n FROM actions').get()!.n).toBeGreaterThan(0);});
 it('imports ZIP safely without extracting paths and preserves issues',async()=>{const{store,importer,dir}=setup(),zip=zipSync({'nested/hands.txt':strToU8(river),'../../escape.txt':strToU8(preflop),'invalid.txt':strToU8('oops')}),r=await importer.ingest('batch.zip',Buffer.from(zip));expect(r.newHands).toBe(2);expect(r.issues).toHaveLength(1);expect(existsSync(path.join(dir,'escape.txt'))).toBe(false);expect(store.db.prepare('SELECT raw FROM import_issues').get()!.raw).toBe('oops');});
 it('retains malformed hand diagnostics and archive bytes',async()=>{const{store,importer}=setup(),r=await importer.ingest('bad.zip',Buffer.from('not zip'));expect(r.issues).toHaveLength(1);expect(store.summary().total.hands).toBe(0);expect(readFileSync(r.archive,'utf8')).toBe('not zip');});
 it('scans directories, retains originals and skips processed hashes',async()=>{const{store,importer,dir}=setup(),inbox=path.join(dir,'Inbox');mkdirSync(inbox);writeFileSync(path.join(inbox,'history.txt'),river);expect(await importer.scan(inbox,true)).toHaveLength(0);expect(await importer.scan(inbox,true)).toHaveLength(1);expect(await importer.scan(inbox,true)).toHaveLength(0);expect(existsSync(path.join(inbox,'history.txt'))).toBe(true);expect(store.summary().total.hands).toBe(1);});
 it('persists notes, settings, ranges and sessions across restarts',async()=>{const{dir,store,importer}=setup();await importer.ingest('gg.txt',Buffer.from(river));store.setSetting('name','James');store.setRanges({'HJ:unopened':{A9o:'open'}});store.db.prepare("INSERT INTO hand_notes VALUES(?, ?, ?)").run('TEST-RIVER-001','Review value range','curiosity call');store.close();const reopened=new Store(dir);temp[temp.length-1].store=reopened;expect(reopened.setting('name','')).toBe('James');expect(reopened.ranges()['HJ:unopened'].A9o).toBe('open');expect(reopened.summary().curiosity).toBe(1);expect(reopened.summary().total.hands).toBe(1);});
 it('preserves review completion on regeneration',async()=>{const{store,importer}=setup();await importer.ingest('gg.txt',Buffer.from(river));const row=store.db.prepare("SELECT id FROM reviews WHERE category='river'").get()!;store.db.prepare('UPDATE reviews SET reviewed_at=?,answer=? WHERE id=?').run('2026-10-03','fold',row.id);store.regenerate();expect(store.summary().reviewed).toBe(1);expect(store.summary().xp).toBe(20);});
 it('recalculates every hand across batch boundaries without losing study records',async()=>{
  const {store,importer}=setup();
  const histories=Array.from({length:103},(_,i)=>preflop.replaceAll('TEST-PREFLOP-002','BATCH-'+String(i).padStart(3,'0'))).join('\n');
  await importer.ingest('batches.txt',Buffer.from(histories+'\n'+river));
  const review=store.db.prepare("SELECT id FROM reviews WHERE category='river'").get()!;
  store.db.prepare('UPDATE reviews SET reviewed_at=?,answer=?,note=? WHERE id=?').run('2026-10-03','fold','Keep this reasoning',review.id);
  store.db.prepare('INSERT INTO hand_notes VALUES(?,?,?)').run('BATCH-102','Keep this note','range question');
  const before=store.summary().total;
  for(let i=0;i<3;i++){store.setRanges({'HJ:unopened':{A9o:i%2?'open':'fold'}});store.regenerate();}
  expect(store.summary().total).toEqual(before);
  expect(store.summary().total.hands).toBe(104);
  expect(store.summary().reviewed).toBe(1);
  expect(store.db.prepare('SELECT note FROM reviews WHERE id=?').get(review.id)!.note).toBe('Keep this reasoning');
  expect(store.db.prepare('SELECT note FROM hand_notes WHERE hand_id=?').get('BATCH-102')!.note).toBe('Keep this note');
 });
 it('preserves opponent notes when older histories arrive',async()=>{const{store,importer}=setup();await importer.ingest('later.txt',Buffer.from(preflop));const old=store.getHand('TEST-PREFLOP-002')!.sessionId!;store.db.prepare('UPDATE players SET note=? WHERE id=?').run('Observed passive line',old+':Player6');await importer.ingest('earlier.txt',Buffer.from(river));expect(store.getHand('TEST-RIVER-001')?.sessionId).toBe(old);expect(store.db.prepare('SELECT note FROM players WHERE id=?').get(old+':Player6')!.note).toBe('Observed passive line');});
 it('paginates and filters hands without returning hidden cards or raw text in listings',async()=>{const{store,importer}=setup();await importer.ingest('gg.txt',Buffer.from(river+'\n'+preflop+'\n'+headsUp+'\n'+sidePot));expect(store.listHands({q:'AQo'}).total).toBe(1);expect(store.listHands({river:'1'}).total).toBe(1);expect(store.listHands({position:'SB'}).total).toBe(1);expect(store.listHands({q:'TEST'}).rows[0]).not.toHaveProperty('raw');});
});
describe('frequency records and hand drill-down',()=>{
 it('counts deduplicated imports and keeps drill-down totals aligned with every cell',async()=>{
  const {store,importer}=setup();
  await importer.ingest('frequency.txt',Buffer.from([river,preflop,headsUp,sidePot].join('\n')));
  await importer.ingest('duplicate.txt',Buffer.from(river));
  const data=store.frequencies();
  expect(data).toMatchObject({total:4,known:4,missing:0});
  expect(data.sources.flop.hands).toBe(3);
  for(const cell of data.starting)expect(Number(store.listHands({class:cell.hand}).total)).toBe(cell.count);
  for(const [source,sample] of Object.entries(data.sources))for(const cell of sample.cards)expect(Number(store.listHands({card:cell.card,source}).total)).toBe(cell.count);
  expect(store.frequencies({position:'SB'}).known).toBe(1);
  expect(store.frequencies({from:'2026-10-02'}).total).toBe(0);
  const session=store.getHand('TEST-RIVER-001')!.sessionId;
  expect(store.frequencies({session}).known).toBe(2);
  expect(store.listHands({session,class:'AQo'}).total).toBe(1);
  expect(store.listHands({card:'As',source:'flop'}).total).toBe(0);
 });
 it('counts beyond the hand-list page without changing study data',async()=>{
  const {store,importer}=setup();
  await importer.ingest('many.txt',Buffer.from(Array.from({length:45},(_,i)=>preflop.replaceAll('TEST-PREFLOP-002','FREQUENCY-'+i)).join('\n')));
  const before=store.summary();
  expect(store.frequencies().starting.find(cell=>cell.hand==='AKo')?.count).toBe(45);
  expect(store.listHands({class:'AKo'}).rows).toHaveLength(40);
  expect(store.listHands({class:'AKo',page:1}).rows).toHaveLength(5);
  expect(store.summary().xp).toBe(before.xp);
  expect(store.summary().total).toEqual(before.total);
 });
});

describe('deterministic training feedback',()=>{
 it('every generated draw answer agrees with the engine and is legally dealt',()=>{const ranges=defaultRanges();for(let i=0;i<200;i++){const c={...makeChallenge('draws',ranges),id:'x'},d=straightDraw(c.hole!,c.board!),grade=gradeChallenge(c,d.kind,ranges);expect(grade.correct).toBe(true);expect(new Set([...c.hole!,...c.board!]).size).toBe(c.hole!.length+c.board!.length);}});
 it('grades pot odds plus exact turn hit probability',()=>{const c={id:'x',type:'odds' as const,pot:12,bet:6,outs:9,unknownCards:46},a=gradeChallenge(c,{call:6,finalPot:24,equity:25,hit:19.6},defaultRanges());expect(a.correct).toBe(true);expect(gradeChallenge(c,{call:6,finalPot:18,equity:33,hit:36},defaultRanges()).correct).toBe(false);});
 it('uses edited ranges and never trains unknown/mixed cells',()=>{const ranges=defaultRanges();ranges['HJ:unopened'].A9o='open';expect(gradeChallenge({id:'x',type:'ranges',position:'HJ',context:'unopened',hand:'A9o'},'open',ranges).correct).toBe(true);expect(()=>makeChallenge('ranges',ranges,'BB','unopened')).toThrow();});
});

