import { Group, Ungroup, X } from 'lucide-react';
import type { CardGroup, GroupStyle, Idea } from '../types';

export function GroupInspector({ group, nodes, onName, onStyle, onMembers, onUngroup, onClose }: {
  group: CardGroup; nodes: Idea[]; onName: (name: string) => void; onStyle: (patch: Partial<GroupStyle>) => void;
  onMembers: (ids: string[]) => void; onUngroup: () => void; onClose: () => void;
}) {
  const s = group.style, members = nodes.filter(n => group.nodeIds.includes(n.id));
  const color = (label: string, key: 'background' | 'borderColor' | 'textColor' | 'shadowColor') => <label className="style-field"><span>{label}</span><div className="color-input"><input aria-label={label} type="color" value={s[key]} onChange={e => onStyle({ [key]: e.target.value })} /><span>{s[key].toUpperCase()}</span></div></label>;
  const range = (label: string, key: 'opacity' | 'borderWidth' | 'padding' | 'roundness' | 'shadowBlur', min: number, max: number, step = 1) => <label className="style-field"><span>{label}</span><div className="range-input"><input aria-label={label} type="range" min={min} max={max} step={step} value={s[key]} onChange={e => onStyle({ [key]: +e.target.value })} /><span>{max === 1 ? `${Math.round(s[key] * 100)}%` : `${s[key]}px`}</span></div></label>;
  return <aside className="inspector group-inspector" aria-label="Group details">
    <div className="inspector-heading"><span><Group size={15} />CARD GROUP</span><button className="icon-button" aria-label="Close group details" onClick={onClose}><X size={17} /></button></div>
    <div className="inspector-scroll"><div className="style-controls">
      <label className="group-name-field">Group name<input aria-label="Group name" maxLength={80} key={`${group.id}:${group.name}`} defaultValue={group.name} onBlur={e => { onName(e.target.value); e.target.value = e.target.value.trim() || group.name; }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></label>
      <p className="section-description">Drag the boundary or its label to move these cards together. The boundary follows their shape.</p>
      {members.some(n => n.locked) && <p className="group-pin-notice">This group stays in place because it contains a pinned card. Unpin its cards to move the whole group.</p>}
      <h4>Boundary appearance</h4>
      {color('Region background', 'background')}{range('Fill opacity', 'opacity', 0, 1, .05)}
      {color('Region border color', 'borderColor')}{range('Region border width', 'borderWidth', 0, 8)}
      <label className="style-field"><span>Border style</span><select aria-label="Region border style" value={s.borderStyle} onChange={e => onStyle({ borderStyle: e.target.value as GroupStyle['borderStyle'] })}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></label>
      {range('Boundary padding', 'padding', 20, 120)}{range('Boundary softness', 'roundness', 0, 1, .05)}{color('Group label color', 'textColor')}
      <div className="style-field"><span>Drop shadow</span><button className={`toggle ${s.shadow ? 'on' : ''}`} role="switch" aria-label="Region drop shadow" aria-checked={s.shadow} onClick={() => onStyle({ shadow: !s.shadow })}><span /></button></div>
      {s.shadow && <>{color('Region shadow color', 'shadowColor')}{range('Shadow blur', 'shadowBlur', 0, 40)}</>}
      <h4>{members.length} cards in this group</h4>
      <div className="group-members">{members.map(n => <div key={n.id}><span title={n.title}>{n.title || 'Untitled idea'}{n.locked ? ' (pinned)' : ''}</span><button className="icon-button" aria-label={`Remove ${n.title || 'Untitled idea'} from group`} title="Remove from group" onClick={() => onMembers(group.nodeIds.filter(id => id !== n.id))}><X size={14} /></button></div>)}</div>
      <select className="group-add-card" aria-label="Add card to group" value="" onChange={e => { if (e.target.value) onMembers([...group.nodeIds, e.target.value]); }}><option value="">Add a card to this group...</option>{nodes.filter(n => !group.nodeIds.includes(n.id)).map(n => <option key={n.id} value={n.id}>{n.title || 'Untitled idea'}</option>)}</select>
      <p className="section-description">Cards can belong to several groups. Removing a card here keeps its other memberships.</p>
    </div></div>
    <div className="inspector-bottom"><button className="secondary" onClick={onUngroup}><Ungroup size={15} />Ungroup cards</button><p className="section-description">Keeps all cards, notes, and connections.</p></div>
  </aside>;
}
