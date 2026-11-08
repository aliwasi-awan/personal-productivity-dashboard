import 'fake-indexeddb/auto';
import { describe,expect,it } from 'vitest';
import { initialData,validateData,parseBackup,backupJSON,mergeData,saveSnapshot,loadSnapshot } from '../src/storage';

describe('backup safety',()=>{
  it('round-trips every record and preferences without credentials',()=>{const data=initialData();expect(parseBackup(backupJSON(data))).toEqual(data);expect(backupJSON(data)).not.toContain('access_token');});
  it('rejects malformed, future, duplicate, dangling and unsafe data',()=>{
    expect(()=>parseBackup('broken')).toThrow('valid JSON');
    expect(()=>validateData({...initialData(),version:2})).toThrow('unsupported');
    const duplicate=initialData();duplicate.projects.push(duplicate.projects[0]);expect(()=>validateData(duplicate)).toThrow('duplicate');
    const invalid=initialData();invalid.activities.push({id:'a',trackerId:'missing',date:'2026-11-07',value:2,note:''});expect(()=>validateData(invalid)).toThrow('missing tracker');
    invalid.activities[0].value=Infinity;expect(()=>validateData(invalid)).toThrow('finite');
    invalid.activities[0].value=1;invalid.activities[0].date='2026-02-31';expect(()=>validateData(invalid)).toThrow('date');
  });
  it('merging the same backup twice does not duplicate records or overwrite local edits',()=>{const a=initialData(),b=initialData();b.projects[0].name='Old name';b.projects.push({...b.projects[0],id:'new',name:'New'});const merged=mergeData(a,b);expect(mergeData(merged,b)).toEqual(merged);expect(merged.projects[0].name).toBe('Habits');});
  it('refuses cross-domain project references and inconsistent task completion',()=>{const data=initialData();data.tasks.push({id:'t',domain:'work',projectId:'personal-0',title:'Task',notes:'',status:'todo',priority:'medium',due:'',createdAt:new Date().toISOString(),completedAt:null});expect(()=>validateData(data)).toThrow('different domain');data.tasks[0].domain='personal';data.tasks[0].status='done';expect(()=>validateData(data)).toThrow('timestamp');});
  it('round-trips domain-only tasks and rejects dangling project links',()=>{const data=initialData();data.tasks.push({id:'t',domain:'personal',projectId:'',title:'Task',notes:'',status:'todo',priority:'medium',due:'',createdAt:new Date().toISOString(),completedAt:null});expect(parseBackup(backupJSON(data))).toEqual(data);data.tasks[0].projectId='missing';expect(()=>validateData(data)).toThrow('missing project');});
});
describe('atomic persistence',()=>{
  it('persists reloads, rejects stale tabs, and leaves existing data intact after failed validation',async()=>{
    const start=await loadSnapshot();const next=structuredClone(start.data);next.projects[0].name='Saved project';
    const saved=await saveSnapshot(next,start.revision);expect(await loadSnapshot()).toEqual(saved);
    await expect(saveSnapshot(initialData(),start.revision)).rejects.toThrow('Another tab');
    const invalid=structuredClone(next);invalid.projects.push(invalid.projects[0]);await expect(saveSnapshot(invalid,saved.revision)).rejects.toThrow('duplicate');
    expect(await loadSnapshot()).toEqual(saved);
  });
});
