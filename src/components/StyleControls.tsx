import type { ReactNode } from 'react';
import { Check, Pin, Palette, Bold, Italic } from 'lucide-react';
import type { NodeStyle, EdgeStyle, Idea, Connector } from '../types';
import { palettes } from '../lib/model';
import { terminators, MarkerShape, markerId } from './ConnectionMarkers';
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="style-field"><span>{label}</span>{children}</label>;
}
function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <Field label={label}><div className="color-input"><input aria-label={label} type="color" value={value} onChange={e => onChange(e.target.value)} /><span>{value.toUpperCase()}</span></div></Field>;
}
function Range({ label, value, max, min = 0, onChange }: { label: string; value: number; max: number; min?: number; onChange: (v: number) => void }) {
  return <Field label={label}><div className="range-input"><input aria-label={label} type="range" min={min} max={max} value={value} onChange={e => onChange(+e.target.value)} /><span>{value}px</span></div></Field>;
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return <div className="style-field"><span>{label}</span><button role="switch" aria-checked={checked} aria-label={label} className={`toggle ${checked ? 'on' : ''}`} onClick={onChange}><span /></button></div>;
}
export function NodeStyleControls({ idea, onChange, onLock }: { idea: Idea; onChange: (patch: Partial<NodeStyle>) => void; onLock?: () => void }) {
  const s = idea.style;
  return <div className="style-controls"><div className="section-heading"><Palette size={14} />A little personality</div><p className="section-description">Make this idea feel like yours.</p>
    <div className="swatches">{palettes.map(p => <button title={p.name} aria-label={`${p.name} palette`} key={p.name} style={{ background: p.background, borderColor: p.borderColor }} onClick={() => onChange({ background: p.background, borderColor: p.borderColor, textColor: p.textColor })}>{s.background === p.background && <Check size={17} style={{ color: p.textColor }} />}</button>)}</div>
    <Color label="Background" value={s.background} onChange={background => onChange({ background })} />
    <h4>Border & shape</h4>
    <Color label="Border color" value={s.borderColor} onChange={borderColor => onChange({ borderColor })} />
    <Range label="Border width" value={s.borderWidth} max={8} onChange={borderWidth => onChange({ borderWidth })} />
    <Field label="Border style"><select aria-label="Border style" value={s.borderStyle} onChange={e => onChange({ borderStyle: e.target.value as NodeStyle['borderStyle'] })}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></Field>
    <Range label="Corner radius" value={s.radius} max={36} onChange={radius => onChange({ radius })} />
    <Toggle label="Soft shadow" checked={s.shadow} onChange={() => onChange({ shadow: !s.shadow })} />
    <h4>Card title typography</h4>
    <p className="section-description">These settings style the card title. Format note text with the top toolbar while editing inside the card.</p>
    <Field label="Font family"><select aria-label="Font family" value={s.font} onChange={e => onChange({ font: e.target.value as NodeStyle['font'] })}><option value="sans">Sans serif</option><option value="serif">Serif</option><option value="mono">Monospace</option></select></Field>
    <Range label="Font size" value={s.fontSize} min={12} max={28} onChange={fontSize => onChange({ fontSize })} />
    <Color label="Text color" value={s.textColor} onChange={textColor => onChange({ textColor })} />
    <Field label="Text style"><div className="segmented compact"><button className={s.bold ? 'active' : ''} aria-label="Bold title" aria-pressed={s.bold} onClick={() => onChange({ bold: !s.bold })}><Bold size={15} /></button><button className={s.italic ? 'active' : ''} aria-label="Italic title" aria-pressed={s.italic} onClick={() => onChange({ italic: !s.italic })}><Italic size={15} /></button></div></Field>
    {onLock && <div className="pin-card"><Pin size={16} /><div><strong>{idea.locked ? 'This idea is pinned' : 'Keep this idea in place'}</strong><p>Pinned ideas stay put during auto-arrange.</p></div><button className={`toggle ${idea.locked ? 'on' : ''}`} role="switch" aria-label="Pin position" aria-checked={idea.locked} onClick={onLock}><span /></button></div>}
  </div>;
}
export function EdgeStyleControls({ edge, onChange }: { edge: Connector; onChange: (patch: Partial<EdgeStyle>) => void }) {
  return <div className="style-controls"><div className="section-heading"><Palette size={14} />The shape of a connection</div><p className="section-description">All paths avoid cards. Automatic chooses a smooth route as cards move.</p>
    <Color label="Connector color" value={edge.style.color} onChange={color => onChange({ color })} />
    <Range label="Connector width" value={edge.style.width} min={1} max={8} onChange={width => onChange({ width })} />
    <Field label="Path"><select aria-label="Path" value={edge.style.path} onChange={e => onChange({ path: e.target.value as EdgeStyle['path'] })}><option value="automatic">Automatic</option><option value="bezier">Bézier curve</option><option value="angular">Angular</option><option value="straight">Straight</option></select></Field>
    <Field label="Line style"><select aria-label="Line style" value={edge.style.line} onChange={e => onChange({ line: e.target.value as EdgeStyle['line'] })}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></Field>
    <h4>Connection ends</h4>
    <Field label="Source terminator"><select aria-label="Source terminator" value={edge.style.startTerminator} onChange={e => onChange({ startTerminator: e.target.value as EdgeStyle['startTerminator'] })}>{terminators.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></Field>
    <Field label="Target terminator"><select aria-label="Target terminator" value={edge.style.endTerminator} onChange={e => onChange({ endTerminator: e.target.value as EdgeStyle['endTerminator'], arrow: e.target.value.includes('arrow') })}>{terminators.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></Field>
    <div className="relationship-presets"><button className="secondary small" onClick={() => onChange({ startTerminator: 'one', endTerminator: 'many', arrow: false })}>One to many</button><button className="secondary small" onClick={() => onChange({ startTerminator: 'many', endTerminator: 'many', arrow: false })}>Many to many</button></div>
    <div className="terminator-preview" aria-label="Connection ends preview"><svg viewBox="0 0 230 32"><path d="M 20 16 H 210" stroke={edge.style.color} strokeWidth={edge.style.width} /><g transform="translate(20 16) rotate(180)"><MarkerShape type={edge.style.startTerminator} color={edge.style.color} /></g><g transform="translate(210 16)"><MarkerShape type={edge.style.endTerminator} color={edge.style.color} /></g></svg></div>
    <div className="connection-preview"><svg viewBox="0 0 280 110"><path d={edge.style.path === 'automatic' ? 'M 20 80 C 130 80 140 30 260 30' : edge.style.path === 'bezier' ? 'M 20 80 C 130 80 140 30 260 30' : edge.style.path === 'angular' ? 'M 20 80 H 140 V 30 H 260' : 'M 20 80 L 260 30'} stroke={edge.style.color} strokeWidth={edge.style.width} fill="none" markerStart={edge.style.startTerminator === 'none' ? undefined : `url(#${markerId(edge.id, 'start')})`} markerEnd={edge.style.endTerminator === 'none' ? undefined : `url(#${markerId(edge.id, 'end')})`} strokeDasharray={edge.style.line === 'dashed' ? '8 6' : edge.style.line === 'dotted' ? '2 5' : undefined} /></svg><span>A connection with character.</span></div>
  </div>;
}
