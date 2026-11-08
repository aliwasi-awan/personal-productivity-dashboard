import type { AppData, Task } from './types';
import { today } from './types';

export const ANKI_TASK_ID = 'anki-due-review-german-decks';

export function isAnkiProject(project: AppData['projects'][number]) {
  return project.domain === 'german' && project.name === 'Anki';
}

export function applyAnkiDueCount(data: AppData, count: number, now = new Date()): AppData {
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('Anki returned an invalid due-card count.');
  const project = data.projects.find(p => isAnkiProject(p) && !p.archived);
  if (!project) throw new Error('Create or restore the German Anki project before refreshing.');
  const next = structuredClone(data);
  const targetProject = next.projects.find(p => p.id === project.id)!;
  const existing = next.tasks.find(t => t.id === ANKI_TASK_ID);
  if (!existing && count === 0) return next;
  if (!existing) {
    const task: Task = {
      id: ANKI_TASK_ID,
      domain: 'german',
      projectId: targetProject.id,
      title: `Review ${count} ${count === 1 ? 'card' : 'cards'}`,
      notes: 'Generated from the local Anki due-card count.',
      status: count ? 'todo' : 'done',
      priority: 'medium',
      due: today(),
      createdAt: now.toISOString(),
      completedAt: count ? null : now.toISOString(),
    };
    next.tasks.push(task);
    return next;
  }
  if (existing.projectId !== targetProject.id || existing.domain !== 'german') throw new Error('The generated Anki task ID is already used by another task.');
  if (count === 0) {
    existing.status = 'done';
    existing.completedAt = existing.completedAt || now.toISOString();
  } else {
    existing.title = `Review ${count} ${count === 1 ? 'card' : 'cards'}`;
    existing.due = today();
    existing.status = 'todo';
    existing.completedAt = null;
  }
  return next;
}
