import { openDB } from 'idb';
import { type AppData, type Domain, DOMAINS } from './types';

export const SCHEMA_VERSION = 1;
const DB_NAME = 'daymark-dashboard';
const domainIds = DOMAINS.map(x=>x.id);
export function initialData(): AppData {
  const names: Record<Domain,string[]> = { personal:['Habits','Health','Finances','Appointments'], work:['Job Applications','Employment','Waymarkers','GRE Coaching'], german:['Nicos Weg','Anki','Grammar','Vocabulary'], study:['OLS','Fundamentals of Fluid Power'] };
  return {version:1,projects:domainIds.flatMap(domain=>names[domain].map((name,i)=>({id:`${domain}-${i}`,domain,name,category:domain === 'work' ? 'Professional' : domain === 'study' ? 'University' : domain === 'german' ? 'Learning' : 'Everyday',notes:'',archived:false}))),tasks:[],goals:[],trackers:[],activities:[],preferences:{theme:'dark',collapsed:false,googleClientId:'',calendars:[]}};
}
function fail(message:string):never {throw new Error(`Invalid backup: ${message}`);}
const object = (v:unknown):Record<string,unknown> => v !== null && typeof v==='object' && !Array.isArray(v) ? v as Record<string,unknown> : fail('expected an object');
function str(v:unknown, label:string, max=20000):string {return typeof v==='string' && v.length<=max ? v : fail(`${label} must be text (maximum ${max} characters)`);}
function bool(v:unknown):boolean {return typeof v==='boolean' ? v : fail('expected true or false');}
function num(v:unknown):number {return typeof v==='number' && Number.isFinite(v) && v>=0 && v<=1e9 ? v : fail('activity and target values must be finite, non-negative numbers');}
function target(v:unknown):number {const n=num(v);return n>0?n:fail('tracker targets must be greater than zero');}
function choice<T extends string>(v:unknown, values:readonly T[]):T {return values.includes(v as T) ? v as T : fail(`expected one of ${values.join(', ')}`);}
function date(v:unknown,allowEmpty=false):string {const s=str(v,'date',10);if(allowEmpty && !s)return s; if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s) fail('invalid date');return s;}
function instant(v:unknown):string {const s=str(v,'timestamp',40);return Number.isFinite(Date.parse(s))?s:fail('invalid timestamp');}
function records(v:unknown):Record<string,unknown>[] {if(!Array.isArray(v)||v.length>100000)fail('expected a list of at most 100,000 records');return v.map(object);}
const id=(v:unknown)=>{const s=str(v,'ID',300);return s.trim()?s:fail('empty ID');};
const title=(v:unknown)=>{const s=str(v,'name',1000);return s.trim()?s:fail('empty name');};
export function validateData(input:unknown):AppData {
  const x=object(input);
  if(x.version!==SCHEMA_VERSION)fail('unsupported schema version; this app supports version 1');
  const p=object(x.preferences);
  const data:AppData={version:1,
    projects:records(x.projects).map(v=>({id:id(v.id),domain:choice(v.domain,domainIds),name:title(v.name),category:str(v.category,'category',300),notes:str(v.notes,'notes'),archived:bool(v.archived)})),
    tasks:records(x.tasks).map(v=>({id:id(v.id),domain:choice(v.domain,domainIds),projectId:str(v.projectId,'project ID',300),title:title(v.title),notes:str(v.notes,'notes'),status:choice(v.status,['todo','doing','done']),priority:choice(v.priority,['low','medium','high']),due:date(v.due,true),createdAt:instant(v.createdAt),completedAt:v.completedAt===null?null:instant(v.completedAt)})),
    goals:records(x.goals).map(v=>({id:id(v.id),projectId:id(v.projectId),title:title(v.title),kind:choice(v.kind,['goal','milestone']),done:bool(v.done)})),
    trackers:records(x.trackers).map(v=>({id:id(v.id),domain:choice(v.domain,domainIds),projectId:str(v.projectId,'project ID',300),name:title(v.name),kind:choice(v.kind,['habit','german','study','application']),target:target(v.target),unit:str(v.unit,'unit',100),stage:str(v.stage,'stage',100),notes:str(v.notes,'notes')})),
    activities:records(x.activities).map(v=>({id:id(v.id),trackerId:id(v.trackerId),date:date(v.date),value:num(v.value),note:str(v.note,'note')})),
    preferences:{theme:choice(p.theme,['light','dark']),collapsed:bool(p.collapsed),googleClientId:str(p.googleClientId,'client ID',300),calendars:records(p.calendars).map(v=>({id:id(v.id),name:title(v.name),enabled:bool(v.enabled),domains:Array.isArray(v.domains)?[...new Set(v.domains.map(d=>choice(d,domainIds)))]:fail('invalid calendar domains')}))}
  };
  for(const list of [data.projects,data.tasks,data.goals,data.trackers,data.activities,data.preferences.calendars])if(new Set(list.map(v=>v.id)).size!==list.length)fail('duplicate IDs');
  const projects=new Map(data.projects.map(v=>[v.id,v]));
  for(const item of [...data.tasks,...data.trackers]){if(!item.projectId || !projects.has(item.projectId)||projects.get(item.projectId)?.domain!==item.domain)fail('task or tracker references a missing project or different domain');}
  for(const g of data.goals)if(!projects.has(g.projectId))fail('goal references a missing project');
  const trackers=new Set(data.trackers.map(v=>v.id));for(const a of data.activities)if(!trackers.has(a.trackerId))fail('activity references a missing tracker');
  for(const t of data.tasks)if((t.status==='done')!==(t.completedAt!==null))fail('task completion and timestamp disagree');
  return data;
}
export function parseBackup(text:string):AppData {
  if(text.length>20*1024*1024)fail('file exceeds 20 MB');
  let parsed:unknown;try{parsed=JSON.parse(text);}catch{fail('file is not valid JSON');}
  const root=object(parsed);return validateData(root.format==='daymark-backup'?root.data:root);
}
export function mergeData(current:AppData, incoming:AppData):AppData {
  const merge=<T extends {id:string}>(a:T[],b:T[])=>{const ids=new Set(a.map(x=>x.id));return [...a,...b.filter(x=>!ids.has(x.id))];};
  return validateData({...current,projects:merge(current.projects,incoming.projects),tasks:merge(current.tasks,incoming.tasks),goals:merge(current.goals,incoming.goals),trackers:merge(current.trackers,incoming.trackers),activities:merge(current.activities,incoming.activities)});
}
export function backupJSON(data:AppData):string {return JSON.stringify({format:'daymark-backup',exportedAt:new Date().toISOString(),data:validateData(data)},null,2);}
// IndexedDB schema migrations are transactional. Version 1 introduces a single atomic snapshot.
// Future migrations must transform and validate existing snapshots in the upgrade transaction.
async function database(){return openDB(DB_NAME,1,{upgrade(db){if(!db.objectStoreNames.contains('state'))db.createObjectStore('state');},blocked(){throw new Error('Close other Daymark tabs to update storage.');}});}
export interface Snapshot { data:AppData; revision:number; }
export async function loadSnapshot():Promise<Snapshot>{
  const db=await database();try{const saved=await db.get('state','current') as Snapshot|undefined;return saved?{data:validateData(saved.data),revision:saved.revision}:{data:initialData(),revision:0};}finally{db.close();}
}
export async function saveSnapshot(data:AppData,expectedRevision:number):Promise<Snapshot>{
  const clean=validateData(data);const db=await database();try{
    const tx=db.transaction('state','readwrite');const old=await tx.store.get('current') as Snapshot|undefined;
    if((old?.revision??0)!==expectedRevision){tx.abort();await tx.done.catch(()=>{});throw new Error('Another tab changed your data. Reload before making more changes. Your latest action was not saved.');}
    const next={data:clean,revision:expectedRevision+1};await tx.store.put(next,'current');await tx.done;return next;
  }finally{db.close();}
}
