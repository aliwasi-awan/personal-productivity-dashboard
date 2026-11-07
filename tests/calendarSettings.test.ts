import {expect,it} from 'vitest';
import {initialCalendarAssignments} from '../src/calendarSettings';
it('enables discovered calendars and maps known names without misclassifying German holidays',()=>{
  const calendars=['Personal ','Study ','Work','German','Holidays in Germany','Shared team'].map((name,i)=>({id:String(i),name}));
  const result=initialCalendarAssignments(calendars);
  expect(result.map(c=>c.domains)).toEqual([['personal'],['study'],['work'],['german'],['personal'],[]]);
  expect(result.every(c=>c.enabled)).toBe(true);
  expect(calendars[0].name).toBe('Personal ');
});
