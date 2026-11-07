import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CalendarAssignment, CalendarEvent } from './types';

const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const RESUME_MAX_AGE_MS = 60 * 1000;
interface TokenResponse { access_token?: string; expires_in?: number; error?: string; scope?: string; }
interface TokenClient { requestAccessToken: (options?: {prompt?: string}) => void; }
interface OAuth { initTokenClient: (options: {client_id:string;scope:string;callback:(response:TokenResponse)=>void;error_callback:(error:{type:string})=>void;include_granted_scopes:boolean}) => TokenClient; revoke: (token:string,callback:()=>void)=>void; hasGrantedAllScopes: (response:TokenResponse,...scopes:string[])=>boolean; }
const oauth = () => (window as unknown as {google?:{accounts?:{oauth2?:OAuth}}}).google?.accounts?.oauth2;
let gisPromise: Promise<OAuth> | undefined;
function loadGIS(): Promise<OAuth> {
  const existing=oauth(); if(existing) return Promise.resolve(existing);
  if(gisPromise) return gisPromise;
  gisPromise=new Promise<OAuth>((resolve,reject)=>{
    let script=document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    const isNew=!script;
    if(!script) {script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.defer=true;}
    const cleanup=()=>{clearTimeout(timer);script!.removeEventListener('load',loaded);script!.removeEventListener('error',failed);};
    const failed=()=>{cleanup();gisPromise=undefined;if(isNew)script!.remove();reject(new Error('Google sign-in could not load. Check your connection and try again.'));};
    const loaded=()=>{const api=oauth();if(api){cleanup();resolve(api);}else failed();};
    const timer=window.setTimeout(failed,15000);
    script.addEventListener('load',loaded,{once:true});script.addEventListener('error',failed,{once:true});
    if(isNew)document.head.appendChild(script);
  });
  return gisPromise;
}
interface ListedCalendar { id:string; summary?:string; summaryOverride?:string; }
interface GoogleEvent { id?:string; summary?:string; status?:string; htmlLink?:string; start?:{date?:string;dateTime?:string};end?:{date?:string;dateTime?:string}; }
interface Page<T> { items?:T[];nextPageToken?:string; }
class CalendarAPIError extends Error { status:number; constructor(status:number) {super(status===401?'Your Google connection expired. Connect again to refresh.':status===403?'Google Calendar access was denied. Check API setup and calendar permissions.':status===429?'Google Calendar is temporarily rate limited. Try refreshing later.':'Google Calendar could not refresh. Please try again.');this.status=status;} }
export function deduplicateEvents(events:CalendarEvent[]) { return [...new Map(events.map(event=>[JSON.stringify([event.calendarId,event.id]),event])).values()].sort((a,b)=>a.start.localeCompare(b.start)); }

export function isCalendarDataFresh(refreshed: string | null, maxAge = SYNC_INTERVAL_MS, now = Date.now()) {
  if (!refreshed) return false;
  const age = now - Date.parse(refreshed);
  return age >= 0 && age < maxAge;
}

export function enabledCalendarIds(assignments: CalendarAssignment[]) {
  return new Set(assignments.filter(assignment => assignment.enabled).map(assignment => assignment.id));
}

/** Read-only browser integration. OAuth tokens are held only in this hook's memory. */
export function useGoogleCalendar(clientId:string, assignments:CalendarAssignment[], range?:{start:string;end:string}) {
  const [events,setEvents]=useState<CalendarEvent[]>([]);
  const [calendars,setCalendars]=useState<{id:string;name:string}[]>([]);
  const [connected,setConnected]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [lastRefresh,setLastRefresh]=useState<string|null>(null);
  const [loadAttempt,setLoadAttempt]=useState(0);
  const authPending=useRef(false);
  const authSequence=useRef(0);
  const token=useRef<{value:string;expires:number}|null>(null);
  const client=useRef<(()=>TokenClient)|null>(null);
  const assignmentRef=useRef(assignments); assignmentRef.current=assignments;
  const rangeRef=useRef(range);rangeRef.current=range;
  const eventCache=useRef(new Map<string,{events:CalendarEvent[];refreshed:string}>());
  const cachedCalendars=useRef<{items:{id:string;name:string}[];refreshed:string}|null>(null);
  const lastLoaded=useRef<string|null>(null);
  const abort=useRef<AbortController|null>(null);
  const generation=useRef(0);
  const alive=useRef(true);
  const expiryTimer=useRef<number|undefined>(undefined);
  const requestRef=useRef<()=>void>(()=>{});
  const clearConnection=useCallback(()=>{
    authPending.current=false;
    authSequence.current++;
    generation.current++;abort.current?.abort();abort.current=null;
    window.clearTimeout(expiryTimer.current);token.current=null;cachedCalendars.current=null;eventCache.current.clear();
    lastLoaded.current=null;
    if(alive.current){setConnected(false);setLoading(false);setEvents([]);setCalendars([]);setLastRefresh(null);}
  },[]);
  const load=useCallback(async(force=true)=>{
    const credentials=token.current;
    if(!credentials||credentials.expires<=Date.now()) {if(credentials)clearConnection();setError('Connect Google Calendar to refresh your events.');return;}
    if(!navigator.onLine){setError('You are offline. Your last loaded events are still shown.');return;}
    abort.current?.abort();const controller=new AbortController();abort.current=controller;
    const run=++generation.current;
    setLoading(true);setError('');
    const getAll=async<T,>(path:string,params:Record<string,string>):Promise<T[]>=>{
      const items:T[]=[];let pageToken:string|undefined;
      do {
        const search=new URLSearchParams(params);if(pageToken)search.set('pageToken',pageToken);
        const response=await fetch(`https://www.googleapis.com/calendar/v3/${path}?${search}`,{headers:{Authorization:`Bearer ${credentials.value}`},signal:controller.signal,cache:'no-store'});
        if(!response.ok)throw new CalendarAPIError(response.status);
        const page=await response.json() as Page<T>;items.push(...(page.items||[]));pageToken=page.nextPageToken;
      }while(pageToken);
      return items;
    };
    try {
      if(force)eventCache.current.clear();
      const calendarCache=cachedCalendars.current;
      let available=calendarCache&&!force&&isCalendarDataFresh(calendarCache.refreshed)?calendarCache.items:null;
      if(!available){
        const list=await getAll<ListedCalendar>('users/me/calendarList',{maxResults:'250',minAccessRole:'reader',fields:'items(id,summary,summaryOverride),nextPageToken'});
        if(run!==generation.current||!alive.current)return;
        available=[...new Map(list.map(c=>[c.id,{id:c.id,name:c.summaryOverride||c.summary||c.id}])).values()];
        cachedCalendars.current={items:available,refreshed:new Date().toISOString()};
      }
      if(run!==generation.current||!alive.current)return;
      setCalendars(available);
      const enabledIds=enabledCalendarIds(assignmentRef.current);
      const selected=available.filter(calendar=>enabledIds.has(calendar.id));
      const now=new Date();
      let start=rangeRef.current?new Date(rangeRef.current.start):new Date(now.getFullYear(),now.getMonth()-3,1);
      let end=rangeRef.current?new Date(rangeRef.current.end):new Date(now.getFullYear(),now.getMonth()+4,1);
      if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start){start=new Date(now.getFullYear(),now.getMonth()-3,1);end=new Date(now.getFullYear(),now.getMonth()+4,1);}
      const cacheKey=JSON.stringify([selected.map(c=>c.id).sort(),start.toISOString(),end.toISOString()]);
      const cached=eventCache.current.get(cacheKey);
      if(cached&&isCalendarDataFresh(cached.refreshed)){
        lastLoaded.current=cached.refreshed;
        setEvents(cached.events);setLastRefresh(cached.refreshed);return;
      }
      const combined:CalendarEvent[]=[];
      // Fetch only enabled calendars; sequential requests avoid a burst against the API.
      for(const calendar of selected){
        const list=await getAll<GoogleEvent>(`calendars/${encodeURIComponent(calendar.id)}/events`,{timeMin:start.toISOString(),timeMax:end.toISOString(),singleEvents:'true',orderBy:'startTime',maxResults:'2500',showDeleted:'false',fields:'items(id,summary,status,htmlLink,start,end),nextPageToken'});
        for(const item of list){const eventStart=item.start?.dateTime||item.start?.date,eventEnd=item.end?.dateTime||item.end?.date;if(item.id&&eventStart&&eventEnd&&item.status!=='cancelled')combined.push({id:item.id,calendarId:calendar.id,title:item.summary||'(Untitled event)',start:eventStart,end:eventEnd,allDay:!!item.start?.date,url:item.htmlLink});}
      }
      if(run!==generation.current||!alive.current)return;
      const nextEvents=deduplicateEvents(combined);
      const refreshed=new Date().toISOString();
      if(eventCache.current.size>=12)eventCache.current.delete(eventCache.current.keys().next().value!);
      eventCache.current.set(cacheKey,{events:nextEvents,refreshed});
      setEvents(nextEvents);setLastRefresh(refreshed);
      lastLoaded.current=refreshed;
    }catch(cause){
      if(controller.signal.aborted||run!==generation.current||!alive.current)return;
      if(cause instanceof CalendarAPIError&&cause.status===401)clearConnection();
      setError(cause instanceof CalendarAPIError?cause.message:'Could not reach Google Calendar. Check your connection and try again.');
    }finally{
      if(run===generation.current&&alive.current){abort.current=null;setLoading(false);}
    }
  },[clearConnection]);
  const refresh=useCallback(()=>load(true),[load]);
  requestRef.current=()=>{void refresh();};
  useEffect(()=>{
    alive.current=true;let disposed=false;
    clearConnection();setError('');client.current=null;
    if(clientId.trim()){
      void loadGIS().then(api=>{
        if(disposed)return;
        client.current=()=>{const attempt=++authSequence.current;return api.initTokenClient({client_id:clientId.trim(),scope:SCOPE,include_granted_scopes:false,
          callback:response=>{
            if(disposed||!alive.current||!authPending.current||attempt!==authSequence.current)return;
            authPending.current=false;
            if(response.error||!response.access_token||!api.hasGrantedAllScopes(response,SCOPE)){setLoading(false);setError('Calendar permission was not granted. You can connect again when ready.');return;}
            const seconds=Number(response.expires_in)||3600;
            token.current={value:response.access_token,expires:Date.now()+seconds*1000};
            cachedCalendars.current=null;setConnected(true);setError('');
            window.clearTimeout(expiryTimer.current);
            expiryTimer.current=window.setTimeout(()=>{clearConnection();setError('Your Google connection expired. Connect again to refresh.');},Math.max(0,seconds*1000-15000));
            requestRef.current();
          },error_callback:()=>{if(!disposed&&authPending.current&&attempt===authSequence.current){authPending.current=false;setLoading(false);setError('Google sign-in was closed or blocked. Allow the popup and connect again.');}}
        });};
      }).catch(cause=>{if(!disposed)setError(cause instanceof Error?cause.message:'Could not load Google sign-in.');});
    }
    return()=>{disposed=true;alive.current=false;generation.current++;abort.current?.abort();window.clearTimeout(expiryTimer.current);token.current=null;client.current=null;};
  },[clientId,clearConnection,loadAttempt]);
  const enabledIds = useMemo(() => enabledCalendarIds(assignments), [assignments]);
  const visibleEvents = useMemo(() => events.filter(event => enabledIds.has(event.calendarId)), [events, enabledIds]);
  const selectionKey = JSON.stringify([...enabledIds].sort());
  const rangeKey = range ? `${range.start}/${range.end}` : '';
  useEffect(() => {
    if (!token.current) return;
    // A successful load for the previous selection does not make this one fresh.
    lastLoaded.current = null;
    void load(false);
  }, [selectionKey, rangeKey, load]);
  useEffect(() => {
    if (!connected) return;
    const refreshWhileActive = (maxAge?: number) => {
      if (!token.current || abort.current || authPending.current) return;
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      if (maxAge !== undefined && isCalendarDataFresh(lastLoaded.current, maxAge)) return;
      void refresh();
    };
    const resume = () => refreshWhileActive(RESUME_MAX_AGE_MS);
    const timer = window.setInterval(() => refreshWhileActive(), SYNC_INTERVAL_MS);
    window.addEventListener('focus', resume);
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', resume);
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [connected, refresh]);
  const connect=useCallback(()=>{
    if(!clientId.trim()){setError('Add your Google OAuth web client ID in Settings first.');return;}
    if(!navigator.onLine){setError('Connect to the internet before signing in with Google.');return;}
    if(!client.current){setLoadAttempt(value=>value+1);setError('Google sign-in is loading. Try Connect again in a moment.');return;}
    if(authPending.current)return;
    authPending.current=true;
    setError('');setLoading(true);
    try {client.current().requestAccessToken({prompt:'select_account'});}catch{authPending.current=false;setLoading(false);setError('Google sign-in could not open. Allow popups and try again.');}
  },[clientId]);
  const disconnect=useCallback(()=>{
    const value=token.current?.value;clearConnection();setError('');
    // Revoke only when the user explicitly disconnects, never on unmount.
    if(value)try{oauth()?.revoke(value,()=>{});}catch{/* Local disconnect is already complete. */}
  },[clearConnection]);
  return {events:visibleEvents,calendars,connected,loading,error,lastRefresh,connect,disconnect,refresh};
}
