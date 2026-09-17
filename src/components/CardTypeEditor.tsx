import { useEffect, useState } from 'react';
export function CardTypeEditor({ value, onChange, label = 'Card type' }: { value: string; onChange: (value: string) => void; label?: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const save = () => { const next = draft.trim() || 'Idea'; setDraft(next); if (next !== value) onChange(next); };
  return <label className="card-type-editor">Type<input aria-label={label} value={draft} maxLength={40} placeholder="Idea, task, question…" onChange={e => setDraft(e.target.value)} onBlur={save} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); save(); } }} /></label>;
}
