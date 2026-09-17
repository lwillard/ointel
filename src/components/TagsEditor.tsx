import { useState } from 'react';
import { X } from 'lucide-react';
import { normalizeTag, validTag } from '../../shared/tags.mjs';

export function TagsEditor({ tags, onChange, label = 'Node tags' }: { tags: string[]; onChange: (tags: string[]) => void; label?: string }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  function add() {
    const values = draft.split(/[\s,#]+/).filter(Boolean).map(normalizeTag);
    if (!values.length) { setDraft(''); return; }
    if (values.some(value => !validTag(value))) return setError('Use letters, numbers, hyphens, or underscores; up to 64 characters per tag.');
    const next = [...new Set([...tags, ...values])];
    if (next.length > 32) return setError('Each node can have up to 32 tags.');
    onChange(next); setDraft(''); setError('');
  }
  return <div className="tags-editor nodrag nopan nowheel">
    <label>{label}<input aria-label={label} value={draft} maxLength={2100} placeholder="#research, #ideas…" onChange={e => { setDraft(e.target.value); setError(''); }} onBlur={add}
      onKeyDown={e => { e.stopPropagation(); if (['Enter', ','].includes(e.key)) { e.preventDefault(); add(); } }} /></label>
    <div className="tag-chips">{tags.map(tag => <span key={tag}>#{tag}<button aria-label={`Remove tag ${tag}`} onClick={() => onChange(tags.filter(t => t !== tag))}><X size={10} /></button></span>)}</div>
    <small>{error || 'Press Enter or comma to add tags.'}</small>
  </div>;
}
