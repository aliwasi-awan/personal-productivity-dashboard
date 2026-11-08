import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, ExternalLink } from 'lucide-react';
import type { Task, CalendarEvent } from './types';
import { DOMAINS } from './types';

type View = 'day' | 'week' | 'month';
export interface CalendarProps { tasks: Task[]; events: CalendarEvent[]; onTaskClick: (task: Task) => void; onRangeChange?: (range:{start:string;end:string})=>void; }
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const add = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate()+n);
const midnight = (d: Date) => new Date(d.getFullYear(),d.getMonth(),d.getDate());
const weekStart = (d: Date) => add(midnight(d), -(d.getDay()+6)%7);
const time = (value: string) => new Date(value).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
export function eventOnDay(e: CalendarEvent, d: Date) {
  const next = add(d,1);
  if (e.allDay) return e.start.slice(0,10) <= key(d) && e.end.slice(0,10) > key(d);
  const start = new Date(e.start).getTime(), end = new Date(e.end).getTime();
  return Number.isFinite(start) && start < next.getTime() && (end > d.getTime() || (end === start && start >= d.getTime()));
}
export function safeGoogleLink(value?: string) {
  try { const u = new URL(value || ''); return u.protocol === 'https:' && (u.hostname === 'calendar.google.com' || u.hostname === 'www.google.com') ? u.href : undefined; } catch { return undefined; }
}
export default function Calendar({ tasks, events, onTaskClick, onRangeChange }: CalendarProps) {
  const [view,setView] = useState<View>('month');
  const [date,setDate] = useState(() => midnight(new Date()));
  const [selected,setSelected] = useState(() => key(new Date()));
  const days = useMemo(() => {
    const start = view === 'month' ? weekStart(new Date(date.getFullYear(),date.getMonth(),1)) : view === 'week' ? weekStart(date) : midnight(date);
    const count = view === 'month' ? 42 : view === 'week' ? 7 : 1;
    return Array.from({length:count},(_,i)=>add(start,i));
  },[date,view]);
  const rangeStart=days[0].toISOString(),rangeEnd=add(days[days.length-1],1).toISOString();
  useEffect(()=>{onRangeChange?.({start:rangeStart,end:rangeEnd});},[rangeStart,rangeEnd,onRangeChange]);
  const orderedEvents = useMemo(() => [...events].sort((a,b)=>a.start.localeCompare(b.start)),[events]);
  const move = (direction: number) => {
    if (view === 'month') setDate(new Date(date.getFullYear(), date.getMonth()+direction,1));
    else setDate(add(date,direction*(view === 'week' ? 7 : 1)));
  };
  const title = view === 'day' ? date.toLocaleDateString([], {weekday:'long',month:'long',day:'numeric',year:'numeric'}) : view === 'week' ? `${days[0].toLocaleDateString([], {month:'short',day:'numeric'})} – ${days[6].toLocaleDateString([], {month:'short',day:'numeric',year:'numeric'})}` : date.toLocaleDateString([], {month:'long',year:'numeric'});
  return <section className="calendar-panel panel" aria-label="Calendar">
    <div className="calendar-toolbar" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:20}}>
      <div style={{display:'flex',gap:8,alignItems:'center'}}><CalendarDays size={20}/><h2 style={{margin:0}} aria-live="polite">{title}</h2></div>
      <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
        <button type="button" aria-label={`Previous ${view}`} onClick={()=>move(-1)}><ChevronLeft size={16}/></button>
        <button type="button" onClick={()=>{setDate(midnight(new Date()));setSelected(key(new Date()));}}>Today</button>
        <button type="button" aria-label={`Next ${view}`} onClick={()=>move(1)}><ChevronRight size={16}/></button>
        <div role="group" aria-label="Calendar view" style={{display:'flex',gap:4,marginLeft:8}}>{(['day','week','month'] as View[]).map(v=><button key={v} type="button" aria-pressed={view===v} className={view===v?'active':''} onClick={()=>setView(v)}>{v[0].toUpperCase()+v.slice(1)}</button>)}</div>
      </div>
    </div>
    <p className="muted" style={{fontSize:12}}>Task due dates and Google Calendar events · times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
    <div style={{overflowX:'auto'}}>
      <div className={`calendar-grid calendar-${view}`} style={{display:'grid',gridTemplateColumns:`repeat(${view==='day'?1:7}, minmax(0, 1fr))`,minWidth:view==='day'?undefined:700,gap:1,background:'var(--border, #d9d8d3)',border:'1px solid var(--border, #d9d8d3)',borderRadius:12,overflow:'hidden'}}>
        {view!=='day' && ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=><div key={d} style={{padding:10,textAlign:'center',fontSize:12,background:'var(--surface, #fff)'}}>{d}</div>)}
        {days.map(day=>{
          const dayKey=key(day), dayEvents=orderedEvents.filter(e=>eventOnDay(e,day));
          const dueTasks=tasks.filter(t=>t.due.slice(0,10)===dayKey);
          const isToday=dayKey===key(new Date());
          const isOutsideMonth = view === 'month' && day.getMonth() !== date.getMonth();
          return <div
            key={dayKey}
            className={`calendar-cell${isToday ? ' is-today' : ''}${isOutsideMonth ? ' outside-month' : ''}`}
            style={{
              padding: 10,
              minHeight: view === 'month' ? 128 : 320,
              background: 'var(--surface)',
              boxShadow: selected === dayKey ? 'inset 0 0 0 2px var(--accent)' : undefined,
            }}
          >
            <button
              type="button"
              className="calendar-date"
              aria-current={isToday ? 'date' : undefined}
              aria-label={day.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              onClick={() => { setSelected(dayKey); setDate(day); if (view === 'month') setView('day'); }}
            >
              {view === 'month' ? day.getDate() : day.toLocaleDateString([], { weekday: 'short', day: 'numeric' })}
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {dayEvents.map(event => {
                const href = safeGoogleLink(event.url);
                const className = event.allDay ? 'calendar-event all-day' : 'calendar-event';
                const eventKey = `${event.calendarId}:${event.id}`;
                const timeLabel = event.allDay ? 'ALL DAY' : `${key(new Date(event.start)) !== dayKey ? '↳ ' : ''}${time(event.start)}`;
                const content = <>
                  <span className="calendar-event-meta">{timeLabel}</span>
                  <span className="calendar-event-title">{event.title}</span>
                  {href && <ExternalLink size={10} aria-hidden="true" />}
                </>;
                return href
                  ? <a
                      key={eventKey}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={className}
                      aria-label={`${event.title}, ${event.allDay ? 'all day' : `${time(event.start)} to ${time(event.end)}`}, opens Google Calendar in a new tab`}
                    >{content}</a>
                  : <div key={eventKey} className={className}>{content}</div>;
              })}
              {dueTasks.map(t=><button type="button" key={t.id} onClick={()=>onTaskClick(t)} className={`calendar-task ${t.status==='done'?'completed':''}`} title={t.title} style={{'--task-domain':DOMAINS.find(d=>d.id===t.domain)?.color||'#aaa'} as React.CSSProperties}><span className="calendar-task-meta">{t.status==='done'?'DONE':'DUE'} · {DOMAINS.find(d=>d.id===t.domain)?.name}</span><span className="calendar-task-title">{t.title}</span></button>)}
              {view==='day'&&!dayEvents.length&&!dueTasks.length&&<p className="muted">No events or task due dates for this day.</p>}
            </div>
          </div>;
        })}
      </div>
    </div>
    <p className="muted" style={{fontSize:12,marginBottom:0}}>Choose a day to focus on its schedule. Google events refresh for the visible dates.</p>
  </section>;
}

