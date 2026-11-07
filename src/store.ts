import { useEffect, useRef, useState } from 'react';
import type { AppData } from './types';
import { backupJSON, loadSnapshot, mergeData, parseBackup, saveSnapshot, validateData, type Snapshot } from './storage';
export function useAppData(){
  const [data,setData]=useState<AppData|null>(null);
  const [error,setError]=useState('');const [saving,setSaving]=useState(false);
  const current=useRef<Snapshot|null>(null);const queue=useRef(Promise.resolve());const pending=useRef(0);const failed=useRef(false);
  useEffect(()=>{let alive=true;loadSnapshot().then(snapshot=>{if(alive){current.current=snapshot;setData(snapshot.data);}}).catch(e=>{if(alive)setError(`Cannot open local storage: ${e.message}. Try allowing site storage, then reload.`);});return()=>{alive=false;};},[]);
  useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(pending.current){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[]);
  function enqueue(transform:(data:AppData)=>AppData):Promise<void>{
    pending.current++;setSaving(true);
    const operation=queue.current.then(async()=>{
      if(!current.current)throw new Error('Local data has not loaded yet.');
      if(failed.current)throw new Error('Saving is paused after an error. Reload before making more changes.');
      const next=validateData(transform(structuredClone(current.current.data)));
      let saved:Snapshot;
      try {saved=await saveSnapshot(next,current.current.revision);} catch(e){failed.current=true;throw e;}
      current.current=saved;setData(saved.data);setError('');
    });
    queue.current=operation.catch(e=>{setError(`Not saved: ${e.message}`);}).finally(()=>{pending.current--;setSaving(pending.current>0);});
    return operation;
  }
  function update(fn:(draft:AppData)=>void){void enqueue(draft=>{fn(draft);return draft;}).catch(()=>{});}
  async function importData(text:string,mode:'merge'|'replace'){
    const incoming=parseBackup(text);
    await enqueue(draft=>mode==='merge'?mergeData(draft,incoming):incoming);
  }
  function exportData(){if(!current.current)return;const blob=new Blob([backupJSON(current.current.data)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`daymark-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return {data,update,error,saving,importData,exportData};
}
