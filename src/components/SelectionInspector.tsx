import { Layers, X, Palette, Trash2 } from 'lucide-react';
import type { Idea, NodeStyle } from '../types';
import { NodeStyleControls } from './StyleControls';
export function SelectionInspector({ cards, onChange, onEditTheme, onDelete, onClose }: { cards: Idea[]; onChange: (style: Partial<NodeStyle>) => void; onEditTheme: () => void; onDelete: () => void; onClose: () => void }) {
  return <aside className="inspector selection-inspector"><div className="inspector-heading"><span><Layers size={15} />{cards.length} CARDS SELECTED</span><button className="icon-button" aria-label="Close selection details" onClick={onClose}><X size={17} /></button></div>
    <div className="selection-intro"><h2>Style them together.</h2><p>Choose a theme above, or adjust the controls below. Values show the first selected card; each change applies to the whole selection.</p><button className="secondary small" onClick={onEditTheme}><Palette size={14} />Create a theme</button></div>
    <div className="inspector-scroll"><NodeStyleControls idea={cards[0]} onChange={onChange} /><div className="selection-card-list">{cards.map(card => <span key={card.id}>{card.title || 'Untitled idea'}{card.locked ? ' · pinned' : ''}</span>)}</div></div>
    <div className="inspector-bottom"><button className="danger-text" onClick={onDelete}><Trash2 size={14} />Delete selected cards</button></div>
  </aside>;
}
