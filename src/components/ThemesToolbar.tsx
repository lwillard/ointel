import { Palette, SlidersHorizontal, CheckSquare, X } from 'lucide-react';
import type { CardTheme, Idea } from '../types';
import { sameCardStyle } from '../lib/themes';
export function ThemesToolbar({ themes, selected, total, onApply, onEdit, onSelectAll, onClear }: {
  themes: CardTheme[]; selected: Idea[]; total: number; onApply: (theme: CardTheme) => void;
  onEdit: () => void; onSelectAll: () => void; onClear: () => void;
}) {
  return <div className="themes-toolbar" role="toolbar" aria-label="Card themes">
    <span className="themes-label"><Palette size={15} />CARD THEMES</span>
    <div className="theme-presets">{themes.map(theme => {
      const active = selected.length > 0 && selected.every(node => sameCardStyle(node.style, theme.style));
      return <button key={theme.id} aria-label={`Apply ${theme.name} theme`} aria-pressed={active} disabled={!selected.length} title={`${theme.name} · apply to selected cards`} className={`theme-preset ${active ? 'active' : ''}`} onClick={() => onApply(theme)}>
        <span className={`theme-swatch font-${theme.style.font}`} style={{ color: theme.style.textColor, background: theme.style.background, borderColor: theme.style.borderColor, borderStyle: theme.style.borderStyle, borderWidth: Math.min(theme.style.borderWidth, 3), borderRadius: Math.min(theme.style.radius, 8), boxShadow: theme.style.shadow ? '0 2px 4px #233d3520' : 'none', fontWeight: theme.style.bold ? 700 : 400, fontStyle: theme.style.italic ? 'italic' : 'normal' }}>Aa</span><span>{theme.name}</span>
      </button>;
    })}</div>
    <button className="theme-editor-button" onClick={onEdit}><SlidersHorizontal size={14} />Theme editor</button>
    <span className="selected-card-count" role="status">{selected.length} selected</span>
    <button className="icon-button" aria-label="Select all cards" title="Select all cards (Ctrl+A)" disabled={!total} onClick={onSelectAll}><CheckSquare size={16} /></button>
    <button className="icon-button" aria-label="Clear card selection" title="Clear card selection" disabled={!selected.length} onClick={onClear}><X size={15} /></button>
  </div>;
}
