import type { Idea, TaskState } from '../types';
import { isTask, taskStates } from '../lib/tasks';

export function TaskStateEditor({ idea, onChange, label = 'Task state' }: { idea: Idea; onChange: (state: TaskState) => void; label?: string }) {
  return <label className="task-state-field"><span>State</span><select aria-label={label} disabled={!isTask(idea)} value={idea.taskState || 'new'} onKeyDown={e => e.stopPropagation()} onChange={e => onChange(e.target.value as TaskState)}>
    {taskStates.map(state => <option key={state} value={state}>{state}</option>)}
  </select></label>;
}
