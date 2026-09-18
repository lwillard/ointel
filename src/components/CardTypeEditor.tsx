import { useEffect, useState, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cardTypes } from './CardTypeIcon';
export function CardTypeEditor({ value, onChange, label = 'Card type' }: { value: string; onChange: (value: string) => void; label?: string }) {
  const inputId = useId();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const save = () => { const next = draft.trim(); setDraft(next); if (next !== value) onChange(next); };
  const predefined = cardTypes.find(type => type.toLowerCase() === value.toLowerCase());
  return <div className="card-type-editor"><label htmlFor={inputId}>Type</label><div className="card-type-picker">
    <input id={inputId} aria-label={label} value={draft} maxLength={40} placeholder="No type" onChange={e => setDraft(e.target.value)} onBlur={save}
      onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); save(); } }} />
    <span className="card-type-arrow" aria-hidden="true"><ChevronDown size={13} /></span>
    <select aria-label={`${label} options`} title="Choose a card type" value={predefined || value} onKeyDown={e => e.stopPropagation()}
      onChange={e => { const next = e.target.value; setDraft(next); if (next !== value) onChange(next); }}>
      <option value="">No type</option>
      {cardTypes.map(type => <option key={type} value={type}>{type}</option>)}
      {!!value && !predefined && <option value={value}>{value}</option>}
    </select>
  </div></div>;
}
