export type Domain = 'personal' | 'work' | 'german' | 'study';
export type Status = 'todo' | 'doing' | 'done';
export type Priority = 'low' | 'medium' | 'high';
export interface Project { id: string; domain: Domain; name: string; category: string; notes: string; archived: boolean; }
export interface Task { id: string; domain: Domain; projectId: string; title: string; notes: string; status: Status; priority: Priority; due: string; createdAt: string; completedAt: string | null; }
export interface Goal { id: string; projectId: string; title: string; kind: 'goal' | 'milestone'; done: boolean; }
export type TrackerKind = 'habit' | 'german' | 'study' | 'application';
export interface Tracker { id: string; domain: Domain; projectId: string; name: string; kind: TrackerKind; target: number; unit: string; stage: string; notes: string; }
export interface Activity { id: string; trackerId: string; date: string; value: number; note: string; }
export interface CalendarAssignment { id: string; name: string; domains: Domain[]; enabled: boolean; }
export interface Preferences { theme: 'light' | 'dark'; collapsed: boolean; googleClientId: string; calendars: CalendarAssignment[]; }
export interface AppData { version: 1; projects: Project[]; tasks: Task[]; goals: Goal[]; trackers: Tracker[]; activities: Activity[]; preferences: Preferences; }
export interface CalendarEvent { id: string; calendarId: string; title: string; start: string; end: string; allDay: boolean; url?: string; }
export const DOMAINS: {id: Domain; name: string; color: string; icon: string}[] = [
  {id:'personal', name:'Personal', color:'#e29d55', icon:'sun'},
  {id:'work', name:'Work', color:'#a694ed', icon:'briefcase'},
  {id:'german', name:'German', color:'#6bb9a0', icon:'languages'},
  {id:'study', name:'Study', color:'#6ba9d5', icon:'book'},
];
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export const uid = () => crypto.randomUUID();
