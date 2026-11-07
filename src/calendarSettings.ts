import type { CalendarAssignment, Domain } from './types';

/** New calendars are enabled once; existing user choices always win. */
export function initialCalendarAssignments(calendars: {id:string;name:string}[]):CalendarAssignment[] {
  return calendars.map(calendar=>{
    const name=calendar.name.trim().toLowerCase();
    let domains:Domain[]=[];
    if (/^(personal|privat)(\b|$)/.test(name) || /holiday|feiertag/.test(name)) domains=['personal'];
    else if (/^(study|studium|university|uni)(\b|$)/.test(name)) domains=['study'];
    else if (/^(work|arbeit)(\b|$)/.test(name)) domains=['work'];
    else if (/^(german|deutsch)(\b|$)/.test(name)) domains=['german'];
    return {...calendar,domains,enabled:true};
  });
}
