import { describe, expect, it } from 'vitest';
import { eventOnDay, safeGoogleLink } from '../src/Calendar';
import { deduplicateEvents } from '../src/google';
import type { CalendarEvent } from '../src/types';
const event=(overrides:Partial<CalendarEvent>={}):CalendarEvent=>({id:'one',calendarId:'primary',title:'Event',start:'2026-11-07',end:'2026-11-09',allDay:true,...overrides});
describe('calendar event boundaries',()=>{
  it('keeps all-day dates local and treats their end date as exclusive',()=>{
    const item=event();
    expect(eventOnDay(item,new Date(2026,10,6))).toBe(false);
    expect(eventOnDay(item,new Date(2026,10,7))).toBe(true);
    expect(eventOnDay(item,new Date(2026,10,8))).toBe(true);
    expect(eventOnDay(item,new Date(2026,10,9))).toBe(false);
  });
  it('shows a timed event crossing local midnight on both dates',()=>{
    const item=event({allDay:false,start:new Date(2026,10,7,23,30).toISOString(),end:new Date(2026,10,8,0,30).toISOString()});
    expect(eventOnDay(item,new Date(2026,10,7))).toBe(true);
    expect(eventOnDay(item,new Date(2026,10,8))).toBe(true);
    expect(eventOnDay(item,new Date(2026,10,9))).toBe(false);
  });
  it('does not include a timed event on its exclusive midnight end date',()=>{
    const item=event({allDay:false,start:new Date(2026,10,7,22).toISOString(),end:new Date(2026,10,8).toISOString()});
    expect(eventOnDay(item,new Date(2026,10,7))).toBe(true);
    expect(eventOnDay(item,new Date(2026,10,8))).toBe(false);
  });
  it('ignores malformed timed events',()=>expect(eventOnDay(event({allDay:false,start:'invalid',end:'invalid'}),new Date(2026,10,7))).toBe(false));
});
describe('Google Calendar event safety',()=>{
  it('deduplicates within each calendar while retaining distinct shared IDs',()=>{
    const original=event(),updated=event({title:'Updated'}),otherCalendar=event({calendarId:'secondary'});
    expect(deduplicateEvents([original,updated,otherCalendar])).toEqual([updated,otherCalendar]);
  });
  it('does not confuse calendar IDs and event IDs containing separators',()=>{
    expect(deduplicateEvents([event({calendarId:'a:b',id:'c'}),event({calendarId:'a',id:'b:c'})])).toHaveLength(2);
  });
  it('opens only HTTPS Google Calendar links',()=>{
    expect(safeGoogleLink('https://calendar.google.com/calendar/event?eid=test')).toBeTruthy();
    expect(safeGoogleLink('javascript:alert(1)')).toBeUndefined();
    expect(safeGoogleLink('https://calendar.google.com.attacker.example/')).toBeUndefined();
    expect(safeGoogleLink('http://calendar.google.com/')).toBeUndefined();
    expect(safeGoogleLink('https://example.com/')).toBeUndefined();
  });
});
