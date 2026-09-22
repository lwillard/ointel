import type { Idea, TaskState } from '../types';

export const taskStates: TaskState[] = ['new', 'in progress', 'canceled', 'completed'];
export const isTask = (card: Pick<Idea, 'cardType'>) => card.cardType.trim().toLowerCase() === 'task';
export type DueDate = { date: string | null; text: string };

// Calendar-only parsing avoids UTC shifts and platform-dependent Date.parse rules.
function calendarDate(year: number, month: number, day: number): string | null {
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1) return null;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= days ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
}
export function taskDueDate(markdown: string): DueDate | null {
  const text = markdown.replace(/```[^]*?```|~~~[^]*?~~~/g, '').replace(/`[^`\n]*`/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;/gi, ' ').replace(/[*_]/g, '');
  const due = /(?:^|[^\p{L}\p{N}_])due\s*:\s*([^\n\r]*)/iu.exec(text);
  if (!due) return null;
  const value = due[1].trim(), iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?![\d\w/-])/.exec(value);
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?![\d\w/-])/.exec(value);
  const named = /^(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,\s*|\s+)(\d{4})(?!\w)/i.exec(value);
  let date: string | null = null;
  if (iso) date = calendarDate(+iso[1], +iso[2], +iso[3]);
  else if (us) date = calendarDate(+us[3], +us[1], +us[2]);
  else if (named) date = calendarDate(+named[3], ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(named[1].slice(0, 3).toLowerCase()) + 1, +named[2]);
  return { date, text: (iso?.[0] || us?.[0] || named?.[0] || value).slice(0, 80) };
}

export function listTasks(nodes: Idea[]) {
  return nodes.filter(isTask).map(card => ({ card, due: taskDueDate(card.body) }))
    .sort((a, b) => (a.due?.date || '99999').localeCompare(b.due?.date || '99999') || a.card.title.localeCompare(b.card.title) || a.card.id.localeCompare(b.card.id));
}
