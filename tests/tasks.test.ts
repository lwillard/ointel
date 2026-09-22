import { describe, it, expect } from 'vitest';
import { isTask, taskDueDate, listTasks } from '../src/lib/tasks';
import { initialWorkspace, makeIdea, parseWorkspace, saveRevision, restoreRevision } from '../src/lib/model';

describe('task dates and states', () => {
  it('reads dates from formatted notes, inline prose, and tables consistently', () => {
    for (const text of ['due: 2026-09-30', '**Due:** September 30, 2026', 'Ship this, due: 9/30/2026. Thanks!', '| Due: |\n| --- |\n| Other |', '<p><strong>due:</strong> <span>Sep 30, 2026</span></p>', '**due:** [2026-09-30](https://example.org)']) {
      if (text.startsWith('|')) expect(taskDueDate(text)?.date).toBeNull();
      else expect(taskDueDate(text)?.date).toBe('2026-09-30');
    }
    expect(taskDueDate('due: February 29, 2028')?.date).toBe('2028-02-29');
    for (const text of ['2026-02-29', '2026-13-12', '9/31/2026', 'April 31, 2026', 'Friday', '2026-01-010', '']) expect(taskDueDate(`due: ${text}`)?.date).toBeNull();
    expect(taskDueDate('overdue: 2026-01-01')).toBeNull();
    expect(taskDueDate('```\ndue: 2026-01-01\n```\n`due: 2026-01-02`\nActual due: 2026-01-03')?.date).toBe('2026-01-03');
  });
  it('lists all Task cards once, including undated and completed tasks', () => {
    const a = { ...makeIdea('Later', undefined, 'due: 2026-10-01'), cardType: 'Task' };
    const b = { ...makeIdea('Earlier', undefined, 'due: 9/30/2026'), cardType: 'task', taskState: 'completed' as const };
    const c = { ...makeIdea('Undated'), cardType: ' TASK ' };
    expect(isTask(c)).toBe(true); expect(isTask(makeIdea('Task in title'))).toBe(false);
    expect(listTasks([a, c, makeIdea('Idea'), b]).map(t => t.card.id)).toEqual([b.id, a.id, c.id]);
  });
  it('migrates old maps, validates states, and restores state with saved history', () => {
    const w = initialWorkspace(); delete w.nodes[0].taskState; w.nodes[0].history.forEach(r => delete r.taskState);
    const parsed = parseWorkspace(w); expect(parsed.nodes[0].taskState).toBe('new'); expect(parsed.nodes[0].history[0].taskState).toBe('new');
    expect(() => parseWorkspace({ ...w, nodes: [{ ...w.nodes[0], taskState: 'unknown' }], edges: [] })).toThrow();
    let task = saveRevision({ ...makeIdea('Task'), cardType: 'Task' });
    const original = task.history.at(-1)!.id;
    task = saveRevision({ ...task, taskState: 'in progress' }); expect(task.history.at(-1)?.taskState).toBe('in progress');
    const restored = restoreRevision({ ...task, taskState: 'completed' }, original);
    expect(restored.taskState).toBe('new'); expect(restored.history.some(r => r.taskState === 'completed')).toBe(true);
    expect(saveRevision(restored)).toBe(restored);
  });
});
