import type { Connector, Terminator } from '../types';
export const terminators: { value: Terminator; label: string }[] = [
  { value: 'none', label: 'None' }, { value: 'solid-arrow', label: 'Solid arrow' },
  { value: 'white-arrow', label: 'White arrow' }, { value: 'open-arrow', label: 'Open arrow' },
  { value: 'dot', label: 'Solid dot' }, { value: 'hollow-dot', label: 'Hollow dot' },
  { value: 'diamond', label: 'Diamond' }, { value: 'one', label: 'One (bar)' }, { value: 'many', label: 'Many (crow’s foot)' },
];
export function MarkerShape({ type, color }: { type: Terminator; color: string }) {
  if (type === 'solid-arrow' || type === 'white-arrow') return <path d="M -11 -6 L 0 0 L -11 6 Z" fill={type === 'white-arrow' ? 'white' : color} stroke={color} strokeWidth="1.5" />;
  if (type === 'open-arrow') return <path d="M -10 -6 L 0 0 L -10 6" fill="none" stroke={color} strokeWidth="1.8" />;
  if (type === 'dot' || type === 'hollow-dot') return <circle cx="-5" cy="0" r="4.5" fill={type === 'dot' ? color : 'white'} stroke={color} strokeWidth="1.6" />;
  if (type === 'diamond') return <path d="M 0 0 L -6 -5 L -12 0 L -6 5 Z" fill="white" stroke={color} strokeWidth="1.6" />;
  if (type === 'one') return <path d="M -4 -7 V 7" stroke={color} strokeWidth="2" />;
  if (type === 'many') return <path d="M 0 -7 L -12 0 L 0 7 M -12 0 H 0" fill="none" stroke={color} strokeWidth="1.8" />;
  return null;
}
export const markerId = (edgeId: string, end: string) => `ointel-${edgeId}-${end}`;
export function ConnectionMarkers({ edges }: { edges: Connector[] }) {
  return <svg className="connection-marker-definitions" aria-hidden="true"><defs>{edges.flatMap(edge => (['start', 'end'] as const).map(end => {
    const type = end === 'start' ? edge.style.startTerminator : edge.style.endTerminator;
    return type === 'none' ? null : <marker key={`${edge.id}-${end}`} id={markerId(edge.id, end)} data-terminator={type} viewBox="-14 -9 17 18" refX="0" refY="0" markerWidth="20" markerHeight="20" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><MarkerShape type={type} color={edge.style.color} /></marker>;
  }))}</defs></svg>;
}
