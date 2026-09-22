import { useMemo } from 'react';
import { ListTodo, X } from 'lucide-react';
import type { Idea, TaskState } from '../types';
import { listTasks, taskStates } from '../lib/tasks';

export function TasksPanel({ nodes, selected, onNavigate, onState, onClose }: { nodes: Idea[]; selected: string | null; onNavigate: (id: string) => void; onState: (id: string, state: TaskState) => void; onClose: () => void }) {
  const tasks = useMemo(() => listTasks(nodes), [nodes]);
  return <section className="tasks-panel" aria-label="Tasks panel">
    <div className="tasks-heading"><strong><ListTodo size={17} />Tasks <span>{tasks.length}</span></strong><p>Set card type to Task. Add <code>due: 2026-09-30</code> in its note.</p><button className="icon-button" aria-label="Close tasks panel" onClick={onClose}><X size={16} /></button></div>
    <div className="tasks-scroll">{tasks.length ? <table><thead><tr><th>Task</th><th>Due date</th><th>Status</th></tr></thead><tbody>{tasks.map(({ card, due }) => <tr key={card.id} data-task-id={card.id} className={selected === card.id ? 'active' : ''} onClick={e => { if (!(e.target as HTMLElement).closest('select')) onNavigate(card.id); }}>
      <td><button className="task-navigate" title="Show this card on the map">{card.title || 'Untitled task'}</button></td>
      <td className={due && !due.date ? 'invalid-due' : ''} title={due && !due.date ? `Use YYYY-MM-DD, M/D/YYYY, or Month D, YYYY. Found: ${due.text || '(empty)'}` : undefined}>{due?.date ? <time dateTime={due.date}>{due.date}</time> : due ? `Check date: ${due.text || 'empty'}` : 'No due date'}</td>
      <td><select aria-label={`State of ${card.title || 'Untitled task'}`} className={`task-state state-${(card.taskState || 'new').replace(' ', '-')}`} value={card.taskState || 'new'} onKeyDown={e => e.stopPropagation()} onChange={e => onState(card.id, e.target.value as TaskState)}>{taskStates.map(state => <option key={state}>{state}</option>)}</select></td>
    </tr>)}</tbody></table> : <div className="tasks-empty">No tasks yet. Choose Task in a card’s type dropdown to list it here.</div>}</div>
  </section>;
}
