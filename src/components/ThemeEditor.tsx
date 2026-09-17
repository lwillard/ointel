import { useMemo, useState } from 'react';
import type { CardTheme, Idea, NodeStyle } from '../types';
import { defaultNodeStyle, makeIdea, uid } from '../lib/model';
import { NodeStyleControls } from './StyleControls';
export function ThemeEditor({ themes, selected, onSave, onDelete, onClose }: {
  themes: CardTheme[]; selected: Idea[]; onSave: (theme: CardTheme, apply: boolean) => void;
  onDelete: (id: string) => void; onClose: () => void;
}) {
  const [source, setSource] = useState('new');
  const [name, setName] = useState('My theme');
  const [style, setStyle] = useState<NodeStyle>({ ...(selected[0]?.style || defaultNodeStyle) });
  const preview = useMemo(() => ({ ...makeIdea('A thought worth keeping'), style }), [style]);
  const custom = source !== 'new' && !source.startsWith('builtin-');
  function load(id: string) {
    setSource(id); const theme = themes.find(theme => theme.id === id);
    setName(theme ? theme.name + (id.startsWith('builtin-') ? ' copy' : '') : 'My theme');
    setStyle({ ...(theme?.style || selected[0]?.style || defaultNodeStyle) });
  }
  function save(apply: boolean) { if (name.trim()) onSave({ id: custom ? source : uid(), name: name.trim(), style: { ...style } }, apply); }
  return <div className="theme-editor-content">
    <div className="theme-editor-header"><label>Start from<select aria-label="Theme to edit" value={source} onChange={e => load(e.target.value)}><option value="new">New theme / selected card</option>{themes.map(theme => <option key={theme.id} value={theme.id}>{theme.name}{theme.id.startsWith('builtin-') ? ' (built-in)' : ''}</option>)}</select></label>
      <label>Theme name<input aria-label="Theme name" value={name} maxLength={60} onChange={e => setName(e.target.value)} /></label></div>
    <div className="theme-editor-columns"><div className="theme-editor-controls"><NodeStyleControls idea={preview} onChange={patch => setStyle(previous => ({ ...previous, ...patch }))} /></div>
      <div className="theme-preview-column"><span className="section-heading">LIVE PREVIEW</span><div className="theme-preview-card" data-testid="theme-preview" style={{ background: style.background, color: style.textColor, border: `${style.borderWidth}px ${style.borderStyle} ${style.borderColor}`, borderRadius: style.radius, boxShadow: style.shadow ? '0 8px 24px #233d3524' : 'none' }}>
        <span className="idea-eyebrow">IDEA</span><h3 className={`font-${style.font}`} style={{ fontSize: style.fontSize, fontWeight: style.bold ? 650 : 400, fontStyle: style.italic ? 'italic' : 'normal' }}>A thought worth keeping</h3><p>A little space for your next connection.</p><small>12 words · 1 version</small></div>
        <p className="section-description">Background, border, corners, shadow, and title typography are saved together. Note text keeps its own formatting.</p>
        <p className="section-description">{selected.length} selected {selected.length === 1 ? 'card' : 'cards'}. Changes stay in this preview until you save.</p>
        {custom && <><button className="secondary small" onClick={() => { setSource('new'); setName(`${name} copy`.slice(0, 60)); }}>Duplicate theme</button><button className="danger-text delete-theme" onClick={() => onDelete(source)}>Delete theme</button></>}
        {!custom && <p className="section-description">Built-in themes are preserved. Save your changes as a custom theme.</p>}
      </div></div>
    <div className="theme-editor-actions"><button className="secondary" onClick={onClose}>Cancel</button><button className="secondary" disabled={!name.trim()} onClick={() => save(false)}>Save theme</button><button className="primary" disabled={!name.trim() || !selected.length} onClick={() => save(true)}>Save and apply to {selected.length} {selected.length === 1 ? 'card' : 'cards'}</button></div>
  </div>;
}
