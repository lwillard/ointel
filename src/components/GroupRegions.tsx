import { useRef, type PointerEvent } from 'react';
import { ViewportPortal, useReactFlow } from '@xyflow/react';
import type { CardGroup } from '../types';
import { regionGeometry, type RegionRect } from '../lib/groups';

type Member = RegionRect & { id: string; locked: boolean };
type Moved = { id: string; position: { x: number; y: number } }[];
export function GroupRegions({ groups, members, selected, onSelect, onPreview, onMove, onContextMenu }: {
  groups: CardGroup[]; members: Member[]; selected: string | null; onSelect: (id: string) => void;
  onPreview: (nodes: Moved) => void; onMove: (nodes: Moved) => void; onContextMenu: (id: string, x: number, y: number) => void;
}) {
  const flow = useReactFlow();
  const drag = useRef<{ pointer: number; x: number; y: number; zoom: number; members: Member[]; latest: Moved } | null>(null);
  function start(e: PointerEvent<SVGGElement>, group: CardGroup, cards: Member[]) {
    if (e.button !== 0) return;
    e.stopPropagation(); e.preventDefault(); onSelect(group.id);
    if (cards.some(n => n.locked)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { pointer: e.pointerId, x: e.clientX, y: e.clientY, zoom: flow.getZoom(), members: cards, latest: [] };
  }
  function move(e: PointerEvent<SVGGElement>) {
    const d = drag.current; if (!d || d.pointer !== e.pointerId) return;
    const dx = Math.max(-1e6 - Math.min(...d.members.map(n => n.x)), Math.min(1e6 - Math.max(...d.members.map(n => n.x)), (e.clientX - d.x) / d.zoom));
    const dy = Math.max(-1e6 - Math.min(...d.members.map(n => n.y)), Math.min(1e6 - Math.max(...d.members.map(n => n.y)), (e.clientY - d.y) / d.zoom));
    d.latest = d.members.map(n => ({ id: n.id, position: { x: n.x + dx, y: n.y + dy } })); onPreview(d.latest);
  }
  function end(e: PointerEvent<SVGGElement>, cancel = false) {
    const d = drag.current; if (!d || d.pointer !== e.pointerId) return;
    drag.current = null;
    if (cancel) onPreview(d.members.map(n => ({ id: n.id, position: { x: n.x, y: n.y } })));
    else if (d.latest.length) onMove(d.latest);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }
  return <ViewportPortal><svg className="group-region-layer" width="1" height="1" aria-label="Card group boundaries">
    {[...groups.filter(g => g.id !== selected), ...groups.filter(g => g.id === selected)].map(group => {
      const cards = members.filter(n => group.nodeIds.includes(n.id)), s = group.style;
      const geometry = regionGeometry(cards, s.padding, s.roundness); if (!geometry) return null;
      const active = selected === group.id, label = group.name.length > 28 ? `${group.name.slice(0, 27)}…` : group.name;
      return <g key={group.id} data-group-id={group.id} className={`group-region nodrag nopan ${active ? 'selected' : ''}`} style={{ cursor: cards.some(n => n.locked) ? 'pointer' : 'grab' }}
        onPointerDown={e => start(e, group, cards)} onPointerMove={move} onPointerUp={e => end(e)} onPointerCancel={e => end(e, true)} onLostPointerCapture={e => end(e, true)}
        onClick={e => e.stopPropagation()} onContextMenu={e => { e.stopPropagation(); e.preventDefault(); onContextMenu(group.id, e.clientX, e.clientY); }}>
        <title>{group.name}</title>
        {active && <path d={geometry.path} fill="none" stroke={s.textColor} strokeWidth={s.borderWidth + 6} strokeOpacity=".18" pointerEvents="none" />}
        <path className="group-boundary" d={geometry.path} fill={s.background} fillOpacity={s.opacity} stroke={s.borderColor} strokeWidth={s.borderWidth} strokeLinejoin="round"
          strokeDasharray={s.borderStyle === 'dashed' ? '10 7' : s.borderStyle === 'dotted' ? '2 6' : undefined} strokeLinecap="round"
          style={{ filter: s.shadow ? `drop-shadow(0px 5px ${s.shadowBlur}px ${s.shadowColor}55)` : undefined }} />
        <g className="group-region-label" transform={`translate(${geometry.label.x} ${geometry.label.y})`} role="button" tabIndex={0} aria-label={`Select group ${group.name}`}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onSelect(group.id); } }}>
          <rect x="-8" y="-3" width={Math.max(92, label.length * 7.3 + 46)} height="26" rx="13" fill={s.background} stroke={active ? s.textColor : s.borderColor} strokeWidth="1" />
          <text x="5" y="14" fill={s.textColor}>{label}<tspan dx="10" opacity=".65">{cards.length}</tspan></text>
        </g>
      </g>;
    })}
  </svg></ViewportPortal>;
}
