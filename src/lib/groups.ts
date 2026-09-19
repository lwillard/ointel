import type { CardGroup, GroupStyle, Workspace } from '../types';

export const defaultGroupStyle: GroupStyle = {
  background: '#e3eddd', opacity: 0.55, borderColor: '#a3b895', borderWidth: 2, borderStyle: 'solid',
  textColor: '#4e6945', padding: 36, roundness: 0.9, shadow: false, shadowColor: '#33482d', shadowBlur: 16,
};
export function cleanGroups(groups: CardGroup[], liveIds: Set<string>): CardGroup[] {
  return groups.map(group => ({ ...group, nodeIds: group.nodeIds.filter(id => liveIds.has(id)) })).filter(group => group.nodeIds.length);
}
export function putInGroup(workspace: Workspace, group: CardGroup): Workspace {
  const live = new Set(workspace.nodes.map(n => n.id)), members = [...new Set(group.nodeIds)].filter(id => live.has(id));
  const memberSet = new Set(members);
  const groups = workspace.groups.filter(g => g.id !== group.id).map(g => ({ ...g, nodeIds: g.nodeIds.filter(id => !memberSet.has(id)) })).filter(g => g.nodeIds.length);
  return { ...workspace, groups: members.length ? [...groups, { ...group, nodeIds: members }] : groups };
}

export type RegionRect = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };
export function regionGeometry(rects: RegionRect[], padding: number, roundness: number) {
  if (!rects.length) return null;
  const points = rects.flatMap(r => [{ x: r.x - padding, y: r.y - padding - 28 }, { x: r.x + r.width + padding, y: r.y - padding - 28 },
    { x: r.x + r.width + padding, y: r.y + r.height + padding }, { x: r.x - padding, y: r.y + r.height + padding }]);
  points.sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const half = (list: Point[]) => { const result: Point[] = []; for (const p of list) { while (result.length > 1 && cross(result.at(-2)!, result.at(-1)!, p) <= 0) result.pop(); result.push(p); } return result.slice(0, -1); };
  const hull = [...half(points), ...half([...points].reverse())];
  const corners = hull.map((p, i) => {
    const before = hull[(i + hull.length - 1) % hull.length], after = hull[(i + 1) % hull.length];
    const incoming = Math.hypot(p.x - before.x, p.y - before.y), outgoing = Math.hypot(after.x - p.x, after.y - p.y);
    const radius = Math.min(incoming * .45, outgoing * .45, padding * (0.4 + roundness * 1.4));
    return { p, from: { x: p.x + (before.x - p.x) * radius / incoming, y: p.y + (before.y - p.y) * radius / incoming },
      to: { x: p.x + (after.x - p.x) * radius / outgoing, y: p.y + (after.y - p.y) * radius / outgoing } };
  });
  const xy = (p: Point) => `${+p.x.toFixed(2)} ${+p.y.toFixed(2)}`;
  const path = `M ${xy(corners[0].from)} ` + corners.map((c, i) => `Q ${xy(c.p)} ${xy(c.to)} L ${xy(corners[(i + 1) % corners.length].from)}`).join(' ') + ' Z';
  const x = points[0].x, y = Math.min(...points.map(p => p.y));
  // Anchor the label above the topmost member, safely inside the boundary.
  const top = [...rects].sort((a, b) => a.y - b.y || a.x - b.x)[0];
  return { path, x, y, width: points.at(-1)!.x - x, height: Math.max(...points.map(p => p.y)) - y,
    label: { x: top.x, y: top.y - 28 - padding / 2 } };
}
