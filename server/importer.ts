import { createHash,randomUUID } from 'node:crypto';
import { mkdir,readFile,readdir,stat,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { unzipSync } from 'fflate';
import { ggParser } from '../src/import/gg';
import { Store } from './store';
export const MAX_BYTES=30*1024*1024;
export interface ImportReport { id:string;source:string;newHands:number;duplicates:number;issues:{id:string;message:string}[];sessions:number;archive:string;createdAt:string }
export class Importer {
  status={running:false,lastScan:null as string|null,error:null as string|null};private timer?:ReturnType<typeof setInterval>;private stable=new Map<string,string>();
  constructor(public store:Store){}
  get inbox(){return this.store.setting('inbox',path.join(this.store.directory,'Inbox'));}
  get archive(){return path.join(this.store.directory,'Imported');}
  async ingest(name:string,buffer:Buffer):Promise<ImportReport> {
    if(buffer.length>MAX_BYTES)throw new Error('File exceeds 30 MB. Import smaller export batches.');
    const hash=createHash('sha256').update(buffer).digest('hex'),id=randomUUID(),source=path.basename(name),createdAt=new Date().toISOString();
    const files:{name:string;text:string}[]=[],issues:{id:string;message:string;raw:string}[]=[];
    if(/\.zip$/i.test(name)) {
      let total=0,entries=0;
      try{const extracted=unzipSync(buffer,{filter:f=>{entries++;total+=f.originalSize;if(entries>2000||total>MAX_BYTES)throw new Error('ZIP expands beyond the 30 MB / 2,000-entry limit.');return /\.txt$/i.test(f.name)&&!f.name.startsWith('__MACOSX/');}});for(const [n,b]of Object.entries(extracted))files.push({name:n,text:decode(b)});if(!files.length)issues.push({id:'archive',message:'ZIP contains no TXT histories.',raw:''});}
      catch(e){issues.push({id:'archive',message:`Cannot read ZIP: ${(e as Error).message}`,raw:''});}
    }else if(/\.txt$/i.test(name)){try{files.push({name:source,text:decode(buffer)});}catch{issues.push({id:'encoding',message:'Cannot decode text. Use UTF-8 or UTF-16 PokerCraft exports; original bytes are archived.',raw:''});}}
    else throw new Error('Choose PokerCraft .txt files or .zip archives.');
    const parsed=files.map(f=>({name:f.name,...ggParser.parse(f.text)}));for(const p of parsed)for(const i of p.issues)issues.push({...i,message:`${p.name}: ${i.message}`});
    // Preserve a byte-for-byte copy before database changes. Never move or delete the source.
    await mkdir(this.archive,{recursive:true});const archive=path.join(this.archive,hash.slice(0,16)+'-'+source.replace(/[^a-zA-Z0-9._-]/g,'_'));
    try{await writeFile(archive,buffer,{flag:'wx'});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
    let newHands=0,duplicates=0,sessions=0;const ranges=this.store.ranges(),db=this.store.db;
    db.exec('BEGIN');try{
      db.prepare('INSERT INTO imports VALUES(?,?,?,?,?,?,?)').run(id,source,hash,createdAt,0,0,issues.length);
      for(const p of parsed)for(const h of p.hands)if(this.store.saveHand(h,id,ranges))newHands++;else duplicates++;
      for(const i of issues)db.prepare('INSERT INTO import_issues(import_id,hand_id,message,raw) VALUES(?,?,?,?)').run(id,i.id,i.message,i.raw);
      sessions=newHands?this.store.sessions():Number(db.prepare('SELECT COUNT(*) n FROM sessions').get()!.n);
      db.prepare('UPDATE imports SET new_count=?,duplicate_count=? WHERE id=?').run(newHands,duplicates,id);db.exec('COMMIT');
    }catch(e){db.exec('ROLLBACK');throw e;}
    return {id,source,newHands,duplicates,issues:issues.map(({id,message})=>({id,message})),sessions,archive,createdAt};
  }
  async scan(directory=this.inbox,watch=false) {
    if(this.status.running)throw new Error('An Inbox scan is already running.');this.status.running=true;this.status.error=null;
    const reports:ImportReport[]=[];
    try{const files=await findFiles(directory);for(const f of files){const s=await stat(f),sig=`${s.size}:${s.mtimeMs}`;if(s.size>MAX_BYTES) {this.status.error=`${path.basename(f)} exceeds 30 MB; split the export.`;continue;}if(watch&&this.stable.get(f)!==sig){this.stable.set(f,sig);continue;}const b=await readFile(f),hash=createHash('sha256').update(b).digest('hex');if(this.store.db.prepare('SELECT 1 FROM imports WHERE hash=?').get(hash))continue;reports.push(await this.ingest(path.basename(f),b));}this.status.lastScan=new Date().toISOString();return reports;}
    catch(e){this.status.error=(e as Error).message;throw e;}finally{this.status.running=false;}
  }
  async start(){await mkdir(this.inbox,{recursive:true});this.timer=setInterval(()=>{if(this.store.setting('watchEnabled',true)&&!this.status.running)this.scan(this.inbox,true).catch(()=>{});},8000);this.timer.unref();}
  stop(){if(this.timer)clearInterval(this.timer);}
}
function decode(bytes:Uint8Array){if(bytes[0]===255&&bytes[1]===254)return new TextDecoder('utf-16le').decode(bytes);if(bytes[0]===254&&bytes[1]===255)return new TextDecoder('utf-16be').decode(bytes);return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
export async function findFiles(directory:string,depth=0):Promise<string[]> {if(depth>5)return [];const items=await readdir(directory,{withFileTypes:true}),files:string[]=[];for(const item of items){if(item.isSymbolicLink())continue;const full=path.join(directory,item.name);if(item.isDirectory()&&item.name!=='Imported'&&item.name!=='node_modules')files.push(...await findFiles(full,depth+1));else if(item.isFile()&&/\.(txt|zip)$/i.test(item.name))files.push(full);if(files.length>2000)throw new Error('Directory has more than 2,000 files. Choose a smaller folder.');}return files;}
