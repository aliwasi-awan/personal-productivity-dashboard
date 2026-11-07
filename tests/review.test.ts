import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { backupJSON, initialData, loadSnapshot, parseBackup, saveSnapshot } from '../src/storage';

describe('independent data integrity checks', () => {
  it('allows exactly one of two concurrent tab saves and preserves the winner', async () => {
    const initial = await loadSnapshot();
    const first = structuredClone(initial.data);
    const second = structuredClone(initial.data);
    first.projects[0].name = 'First tab';
    second.projects[0].name = 'Second tab';
    const results = await Promise.allSettled([
      saveSnapshot(first, initial.revision),
      saveSnapshot(second, initial.revision),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const winner = results.find(result => result.status === 'fulfilled');
    expect(winner?.status).toBe('fulfilled');
    if (winner?.status !== 'fulfilled') throw new Error('No save succeeded');
    const failure = results.find(result => result.status === 'rejected');
    expect(failure?.status === 'rejected' && failure.reason.message).toContain('Another tab');
    expect(await loadSnapshot()).toEqual(winner.value);
    expect(winner.value.revision).toBe(initial.revision + 1);
  });

  it('strips unrecognized imported properties before exporting or persisting', () => {
    const imported = {
      ...initialData(),
      access_token: 'discard-this-credential',
      preferences: { ...initialData().preferences, access_token: 'also-discard' },
    };
    const parsed = parseBackup(JSON.stringify(imported));
    expect(parsed).toEqual(initialData());
    expect(backupJSON(parsed)).not.toContain('discard');
  });

  it('restores completed tasks, goals, recorded tracker progress, and calendar preferences', () => {
    const populated = initialData();
    populated.tasks.push({ id: 'task', domain: 'study', projectId: 'study-0', title: 'Exercise sheet', notes: 'Chapter 2', status: 'done', priority: 'high', due: '2026-11-10', createdAt: '2026-11-01T12:00:00Z', completedAt: '2026-11-07T13:30:00Z' });
    populated.goals.push({ id: 'milestone', projectId: 'study-0', title: 'Finish preparation', kind: 'milestone', done: true });
    populated.trackers.push({ id: 'tracker', domain: 'german', projectId: 'german-0', name: 'Nicos Weg', kind: 'german', target: 20, unit: 'lessons', stage: 'A2', notes: 'Practice' });
    populated.activities.push({ id: 'entry', trackerId: 'tracker', date: '2026-11-07', value: 2.5, note: 'Listening and exercises' });
    populated.preferences.calendars.push({ id: 'calendar@example.com', name: 'Shared learning', domains: ['study', 'german'], enabled: true });
    populated.preferences.theme = 'light';
    populated.preferences.collapsed = true;
    expect(parseBackup(backupJSON(populated))).toEqual(populated);
  });
});
