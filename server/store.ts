import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { ENGINE_VERSION, type Hand } from '../src/poker/types';
import { addMetrics, aggregate, archetype, blankMetrics, metrics, potentialLeaks, reviewCandidates } from '../src/analysis/analysis';
import { defaultRanges, type RangeBook } from '../src/poker/ranges';
import { handClass } from '../src/poker/cards';
import { cardFrequencies } from '../src/analysis/frequency';
export class Store {
  db:DatabaseSync;
  constructor(public directory:string) {
    mkdirSync(directory,{recursive:true});this.db=new DatabaseSync(path.join(directory,'monarch.sqlite'));
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');this.migrate();
  }
  migrate(){this.db.exec(`
    CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS imports(id TEXT PRIMARY KEY,source TEXT NOT NULL,hash TEXT,created_at TEXT NOT NULL,new_count INTEGER NOT NULL,duplicate_count INTEGER NOT NULL,issue_count INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS import_issues(id INTEGER PRIMARY KEY,import_id TEXT REFERENCES imports(id),hand_id TEXT,message TEXT NOT NULL,raw TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,table_name TEXT NOT NULL,started_at TEXT NOT NULL,ended_at TEXT NOT NULL,hand_count INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS hands(id TEXT PRIMARY KEY,import_id TEXT REFERENCES imports(id),date TEXT NOT NULL,table_name TEXT NOT NULL,hero TEXT NOT NULL,position TEXT NOT NULL,hand_class TEXT NOT NULL,big_blind INTEGER NOT NULL,net_bb REAL NOT NULL,session_id TEXT REFERENCES sessions(id),engine_version TEXT NOT NULL,raw TEXT NOT NULL,json TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS hands_date ON hands(date);
    CREATE INDEX IF NOT EXISTS hands_session ON hands(session_id,date);
    CREATE INDEX IF NOT EXISTS hands_position ON hands(position,date);
    CREATE TABLE IF NOT EXISTS players(id TEXT PRIMARY KEY,session_id TEXT REFERENCES sessions(id),name TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',alias TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS seats(hand_id TEXT REFERENCES hands(id),seat INTEGER,player_id TEXT REFERENCES players(id),name TEXT NOT NULL,position TEXT NOT NULL,stack INTEGER NOT NULL,cards TEXT NOT NULL,PRIMARY KEY(hand_id,seat));
    CREATE TABLE IF NOT EXISTS actions(hand_id TEXT REFERENCES hands(id),idx INTEGER,street TEXT NOT NULL,player TEXT,kind TEXT NOT NULL,amount INTEGER NOT NULL,cards TEXT,PRIMARY KEY(hand_id,idx));
    CREATE TABLE IF NOT EXISTS hand_stats(hand_id TEXT REFERENCES hands(id),player TEXT,metrics TEXT NOT NULL,PRIMARY KEY(hand_id,player));
    CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY,hand_id TEXT REFERENCES hands(id),action_index INTEGER NOT NULL,priority REAL NOT NULL,category TEXT NOT NULL,json TEXT NOT NULL,reviewed_at TEXT,answer TEXT,note TEXT NOT NULL DEFAULT '',tag TEXT NOT NULL DEFAULT '');
    CREATE INDEX IF NOT EXISTS reviews_queue ON reviews(reviewed_at,priority DESC);
    CREATE TABLE IF NOT EXISTS hand_notes(hand_id TEXT PRIMARY KEY REFERENCES hands(id),note TEXT NOT NULL DEFAULT '',tag TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS ranges(context_key TEXT NOT NULL,cell TEXT NOT NULL,action TEXT NOT NULL,PRIMARY KEY(context_key,cell));
    CREATE TABLE IF NOT EXISTS challenges(id TEXT PRIMARY KEY,json TEXT NOT NULL,range_snapshot TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS training_attempts(id TEXT PRIMARY KEY REFERENCES challenges(id),type TEXT NOT NULL,correct INTEGER NOT NULL,xp INTEGER NOT NULL,created_at TEXT NOT NULL,json TEXT NOT NULL);
    INSERT OR IGNORE INTO migrations VALUES(1,datetime('now'));
  `);if(!this.db.prepare('SELECT 1 FROM ranges LIMIT 1').get())this.setRanges(defaultRanges());}
  setting<T>(key:string,fallback:T):T {const r=this.db.prepare('SELECT value FROM settings WHERE key=?').get(key);return r?JSON.parse(r.value as string):fallback;}
  setSetting(key:string,value:unknown){this.db.prepare('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));}
  ranges():RangeBook {const out:RangeBook={};for(const row of this.db.prepare('SELECT * FROM ranges').all())(out[row.context_key as string]??={})[row.cell as string]=row.action as any;return out;}
  setRanges(ranges:RangeBook){this.db.exec('BEGIN');try{const put=this.db.prepare('INSERT INTO ranges VALUES(?,?,?) ON CONFLICT(context_key,cell) DO UPDATE SET action=excluded.action');for(const [key,cells]of Object.entries(ranges))for(const[cell,action]of Object.entries(cells))put.run(key,cell,action);this.db.exec('COMMIT');}catch(e){this.db.exec('ROLLBACK');throw e;}}
  getHand(id:string):Hand|undefined {const row=this.db.prepare('SELECT json,session_id FROM hands WHERE id=?').get(id);return row?{...JSON.parse(row.json as string),sessionId:row.session_id}:undefined;}
  saveHand(h:Hand,importId:string,ranges:RangeBook) {
    if(this.db.prepare('SELECT id FROM hands WHERE id=?').get(h.id))return false;
    const hero=h.seats.find(s=>s.name===h.hero)!;
    this.db.prepare('INSERT INTO hands VALUES(?,?,?,?,?,?,?,?,?,NULL,?,?,?)').run(h.id,importId,h.date,h.table,h.hero,hero.position,handClass(hero.cards),h.bigBlind,h.heroNet/h.bigBlind,ENGINE_VERSION,h.raw,JSON.stringify(h));
    const seat=this.db.prepare('INSERT INTO seats VALUES(?,?,NULL,?,?,?,?)');for(const s of h.seats)seat.run(h.id,s.seat,s.name,s.position,s.stack,JSON.stringify(s.cards));
    const act=this.db.prepare('INSERT INTO actions VALUES(?,?,?,?,?,?,?)');for(const a of h.actions)act.run(h.id,a.index,a.street,a.player??null,a.kind,a.amount,a.cards?JSON.stringify(a.cards):null);
    const stat=this.db.prepare('INSERT INTO hand_stats VALUES(?,?,?)');for(const s of h.seats)stat.run(h.id,s.name,JSON.stringify(metrics(h,s.name)));
    this.generateReviews(h,ranges);return true;
  }
  generateReviews(h:Hand,ranges:RangeBook) {const put=this.db.prepare('INSERT INTO reviews(id,hand_id,action_index,priority,category,json) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json,priority=excluded.priority');for(const c of reviewCandidates(h,ranges))put.run(c.id,h.id,c.actionIndex,c.priority,c.category,JSON.stringify(c));}
  regenerate() {
    const ranges=this.ranges();this.db.exec('BEGIN');
    try {
      this.db.exec('DELETE FROM reviews WHERE reviewed_at IS NULL');
      const read=this.db.prepare('SELECT id,json FROM hands WHERE id>? ORDER BY id LIMIT 100');
      const update=this.db.prepare('UPDATE hands SET engine_version=? WHERE id=?');
      const stat=this.db.prepare('INSERT OR REPLACE INTO hand_stats VALUES(?,?,?)');
      // Materialize a bounded batch before writing. A live SQLite iterator can
      // lose its temporary statement during the allocations in hand evaluation.
      let cursor='';
      for(;;){
        const rows=read.all(cursor);if(!rows.length)break;
        for(const row of rows){
          const h:Hand=JSON.parse(row.json as string);
          for(const seat of h.seats)stat.run(h.id,seat.name,JSON.stringify(metrics(h,seat.name)));
          this.generateReviews(h,ranges);update.run(ENGINE_VERSION,h.id);
        }
        cursor=String(rows.at(-1)!.id);
      }
      this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  sessions() {
    // Group by table, stakes, hero and a 45-minute gap. Preserve an existing identity on backfill.
    const rows=this.db.prepare('SELECT id,date,table_name,hero,big_blind,session_id FROM hands ORDER BY table_name,hero,big_blind,date,id').all();
    const groups:typeof rows[]=[];let previous:typeof rows[number]|undefined;
    for(const row of rows){if(!previous||row.table_name!==previous.table_name||row.hero!==previous.hero||row.big_blind!==previous.big_blind||Date.parse(row.date+'Z')-Date.parse(previous.date+'Z')>45*60*1000)groups.push([]);groups.at(-1)!.push(row);previous=row;}
    const used=new Set<string>();
    for(const group of groups){const ids=[...new Set(group.map(r=>r.session_id).filter(Boolean))] as string[],id=ids.find(i=>!used.has(i))??randomUUID();used.add(id);this.db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET started_at=excluded.started_at,ended_at=excluded.ended_at,hand_count=excluded.hand_count').run(id,group[0].table_name,group[0].date,group.at(-1)!.date,group.length);
      for(const r of group){if(r.session_id===id)continue;this.db.prepare('UPDATE hands SET session_id=? WHERE id=?').run(id,r.id);const seats=this.db.prepare('SELECT name FROM seats WHERE hand_id=?').all(r.id);for(const s of seats){const pid=id+':'+s.name;this.db.prepare('INSERT OR IGNORE INTO players(id,session_id,name) VALUES(?,?,?)').run(pid,id,s.name);this.db.prepare('UPDATE seats SET player_id=? WHERE hand_id=? AND name=?').run(pid,r.id,s.name);}}
      for(const old of ids.filter(i=>i!==id)){for(const player of this.db.prepare('SELECT * FROM players WHERE session_id=?').all(old)){const target=id+':'+player.name;const existing=this.db.prepare('SELECT note,alias FROM players WHERE id=?').get(target);if(existing)this.db.prepare('UPDATE players SET note=?,alias=? WHERE id=?').run([existing.note,player.note].filter(Boolean).join('\n'),existing.alias||player.alias,target);}this.db.prepare('DELETE FROM players WHERE session_id=? AND id NOT IN (SELECT player_id FROM seats WHERE player_id IS NOT NULL)').run(old);}
    }
    this.db.exec('DELETE FROM sessions WHERE id NOT IN (SELECT DISTINCT session_id FROM hands) AND id NOT IN (SELECT session_id FROM players)');return groups.length;
  }
  filter(query:Record<string,any>){const clauses=['1=1'],params:(string|number)[]=[];if(query.q){clauses.push('(h.id LIKE ? OR h.table_name LIKE ? OR h.hand_class LIKE ? OR EXISTS(SELECT 1 FROM hand_notes n WHERE n.hand_id=h.id AND (n.note LIKE ? OR n.tag LIKE ?)))');params.push(...Array(5).fill('%'+String(query.q).slice(0,200)+'%'));}if(query.position){clauses.push('h.position=?');params.push(query.position);}if(query.session){clauses.push('h.session_id=?');params.push(query.session);}if(query.from){clauses.push('h.date>=?');params.push(query.from);}if(query.to){clauses.push('h.date<=?');params.push(query.to+'T23:59:59');}if(query.river==='1')clauses.push("EXISTS(SELECT 1 FROM actions a WHERE a.hand_id=h.id AND a.player=h.hero AND a.street='river' AND a.kind='call')");if(query.result==='loss')clauses.push('h.net_bb<0');if(query.result==='win')clauses.push('h.net_bb>0');if(query.last==='1000'||query.last==='5000')clauses.push(`h.id IN (SELECT id FROM hands ORDER BY date DESC,id DESC LIMIT ${Number(query.last)})`);return {where:clauses.join(' AND '),params};}
  frequencyFilter(query:Record<string,any>) {
    const base=this.filter(query);
    if(query.class){base.where+=' AND h.hand_class=?';base.params.push(String(query.class));}
    if(query.card){
      const source=String(query.source||'hole'),card=String(query.card);
      if(source==='hole') base.where+=" AND EXISTS(SELECT 1 FROM seats se,json_each(se.cards) c WHERE se.hand_id=h.id AND se.name=h.hero AND json_array_length(se.cards)=2 AND c.value=?)";
      else if(source==='flop') base.where+=" AND json_array_length(h.json,'$.board')>=3 AND EXISTS(SELECT 1 FROM json_each(h.json,'$.board') c WHERE c.key<3 AND c.value=?)";
      else if(source==='turn'||source==='river') base.where+=` AND json_extract(h.json,'$.board[${source==='turn'?3:4}]')=?`;
      else base.where+=' AND 0=?';
      base.params.push(card);
    }
    return base;
  }
  frequencies(query:Record<string,any>={}) {
    const {where,params}=this.filter(query);
    const rows=this.db.prepare(`SELECT se.cards hole,json_extract(h.json,'$.board') board FROM hands h JOIN seats se ON se.hand_id=h.id AND se.name=h.hero WHERE ${where} ORDER BY h.date DESC,h.id DESC`).all(...params);
    return cardFrequencies(rows.map(row=>({hole:JSON.parse(String(row.hole)),board:JSON.parse(String(row.board))})));
  }
  listHands(query:Record<string,any>){const{where,params}=this.frequencyFilter(query),page=Math.max(0,Number(query.page)||0),limit=40;return {total:this.db.prepare(`SELECT COUNT(*) n FROM hands h WHERE ${where}`).get(...params)!.n,rows:this.db.prepare(`SELECT h.id,h.date,h.table_name,h.position,h.hand_class,h.net_bb,h.session_id,h.big_blind,n.note,n.tag FROM hands h LEFT JOIN hand_notes n ON n.hand_id=h.id WHERE ${where} ORDER BY h.date DESC,h.id DESC LIMIT ? OFFSET ?`).all(...params,limit,page*limit),page,limit};}
  summary(query:Record<string,any>={}) {
    const{where,params}=this.filter(query),keys=Object.keys(blankMetrics()),sum=keys.map(k=>`COALESCE(SUM(json_extract(st.metrics,'$.${k}')),0) AS "${k}"`).join(',');
    const total=this.db.prepare(`SELECT ${sum} FROM hands h JOIN hand_stats st ON st.hand_id=h.id AND st.player=h.hero WHERE ${where}`).get(...params) as any;
    const positions=this.db.prepare(`SELECT h.position,${sum} FROM hands h JOIN hand_stats st ON st.hand_id=h.id AND st.player=h.hero WHERE ${where} GROUP BY h.position`).all(...params);
    const sessions=this.db.prepare('SELECT s.*,SUM(h.net_bb) net_bb FROM sessions s JOIN hands h ON h.session_id=s.id GROUP BY s.id ORDER BY s.started_at DESC LIMIT 100').all();
    const attempts=this.db.prepare('SELECT type,COUNT(*) attempts,SUM(correct) correct,SUM(xp) xp FROM training_attempts GROUP BY type').all();
    const reviewed=Number(this.db.prepare('SELECT COUNT(*) n FROM reviews WHERE reviewed_at IS NOT NULL').get()!.n),riverReviewed=Number(this.db.prepare("SELECT COUNT(*) n FROM reviews WHERE reviewed_at IS NOT NULL AND category IN ('river','river-fold')").get()!.n);
    const xp=attempts.reduce((s,r)=>s+Number(r.xp),0)+reviewed*20;
    const lastImport=this.db.prepare('SELECT * FROM imports WHERE new_count>0 ORDER BY created_at DESC LIMIT 1').get()??null;
    const queue=this.db.prepare('SELECT COUNT(*) n FROM reviews WHERE reviewed_at IS NULL').get()!.n;
    const curiosity=this.db.prepare("SELECT COUNT(*) n FROM hand_notes WHERE tag='curiosity call'").get()!.n;
    const reviewReasons=this.db.prepare(`SELECT r.category,COUNT(*) n FROM reviews r JOIN hands h ON h.id=r.hand_id WHERE r.reviewed_at IS NULL AND ${where} GROUP BY r.category`).all(...params);const important=this.db.prepare(`SELECT r.json FROM reviews r JOIN hands h ON h.id=r.hand_id WHERE r.reviewed_at IS NULL AND ${where} ORDER BY r.priority DESC LIMIT 1`).get(...params);return {reviewReasons,mostImportant:important?JSON.parse(important.json as string):null,total,positions,sessions,attempts,reviewed,riverReviewed,xp,level:1+Math.floor(xp/200),lastImport,queue,curiosity,leaks:potentialLeaks(total),engineVersion:ENGINE_VERSION};
  }
  opponents() {
    const rows=this.db.prepare('SELECT p.*,s.started_at,s.table_name FROM players p JOIN sessions s ON s.id=p.session_id WHERE EXISTS(SELECT 1 FROM seats se JOIN hands h ON h.id=se.hand_id WHERE se.player_id=p.id AND se.name<>h.hero) ORDER BY s.started_at DESC LIMIT 250').all();
    return rows.map(p=>{const observed=this.db.prepare('SELECT st.metrics FROM seats se JOIN hand_stats st ON st.hand_id=se.hand_id AND st.player=se.name WHERE se.player_id=?').all(p.id);const stats=addMetrics(observed.map(r=>JSON.parse(r.metrics as string)));const evidence=this.db.prepare("SELECT a.hand_id,a.street,a.kind,a.amount,h.big_blind,se.cards FROM seats se JOIN hands h ON h.id=se.hand_id JOIN actions a ON a.hand_id=h.id AND a.player=se.name WHERE se.player_id=? AND a.kind IN ('show','call','raise') ORDER BY CASE WHEN a.kind='show' THEN 0 ELSE 1 END,h.date DESC LIMIT 4").all(p.id);return {...p,stats,archetype:archetype(stats),evidence};});
  }
  close(){this.db.close();}
}
