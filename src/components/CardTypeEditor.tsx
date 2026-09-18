import { useEffect, useState, useId } from 'react';
import { cardTypes } from './CardTypeIcon';
export function CardTypeEditor({ value, onChange, label = 'Card type' }: { value: string; onChange: (value: string) => void; label?: string }) {
  const listId = useId();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const save = () => { const next = draft.trim(); setDraft(next); if (next !== value) onChange(next); };
  return <label className="card-type-editor">Type<input aria-label={label} value={draft} list={listId} maxLength={40} placeholder="No type" onChange={e => setDraft(e.target.value)} onBlur={save} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); save(); } }} /><datalist id={listId}>{cardTypes.map(type => <option key={type} value={type} />)}</datalist></label>;
}
