import { describe, expect, it } from 'vitest';
import { applyAnkiDueCount, ANKI_TASK_ID } from '../src/ankiTask';
import { initialData } from '../src/storage';

describe('Anki review task upsert', () => {
  it('leaves data untouched for an initial zero and creates a stable task for due cards', () => {
    const data = initialData();
    const zero = applyAnkiDueCount(data, 0, new Date('2026-11-08T10:00:00Z'));
    expect(zero.tasks).toHaveLength(0);
    expect(data.tasks).toHaveLength(0);
    const added = applyAnkiDueCount(data, 4, new Date('2026-11-08T10:00:00Z'));
    expect(added.tasks).toHaveLength(1);
    expect(added.tasks[0]).toMatchObject({ id: ANKI_TASK_ID, projectId: 'german-1', title: 'Review 4 cards', status: 'todo' });
    const updated = applyAnkiDueCount(added, 1, new Date('2026-11-08T11:00:00Z'));
    expect(updated.tasks).toHaveLength(1);
    expect(updated.tasks[0]).toMatchObject({ id: ANKI_TASK_ID, title: 'Review 1 card', status: 'todo', completedAt: null });
    const completed = applyAnkiDueCount(updated, 0, new Date('2026-11-08T12:00:00Z'));
    expect(completed.tasks[0]).toMatchObject({ id: ANKI_TASK_ID, status: 'done', completedAt: '2026-11-08T12:00:00.000Z' });
  });

  it('preserves unrelated task content and refuses an archived Anki project', () => {
    const data = initialData();
    data.tasks.push({ id: 'keep', domain: 'german', projectId: 'german-1', title: 'Existing task', notes: 'Keep my note', status: 'todo', priority: 'high', due: '', createdAt: '2026-11-01T00:00:00Z', completedAt: null });
    const updated = applyAnkiDueCount(data, 2, new Date('2026-11-08T10:00:00Z'));
    expect(updated.tasks.find(t => t.id === 'keep')).toEqual(data.tasks[0]);
    expect(updated.projects.find(p => p.id === 'german-1')?.notes).toBe('');
    data.projects.find(p => p.id === 'german-1')!.archived = true;
    expect(() => applyAnkiDueCount(data, 2)).toThrow('Create or restore');
  });
});
