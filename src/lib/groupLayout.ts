import { arrange, type Layout } from './layout';
import { cardSize } from './cardSize';
import { regionGeometry } from './groups';
import type { Workspace, Idea } from '../types';

export function arrangeGroups(workspace: Workspace, algorithm: Layout): Idea[] {
  if (!workspace.groups.length) return arrange(workspace.nodes, workspace.edges, algorithm);
  const owner = new Map<string, string>(), proxies: Idea[] = [], origins = new Map<string, { x: number; y: number }>();
  for (const group of workspace.groups) {
    const members = workspace.nodes.filter(n => group.nodeIds.includes(n.id)); if (!members.length) continue;
    const box = regionGeometry(members.map(n => ({ ...n.position, ...cardSize(n) })), group.style.padding, group.style.roundness)!;
    const id = `@group:${group.id}`;
    members.forEach(n => owner.set(n.id, id)); origins.set(id, { x: box.x, y: box.y });
    proxies.push({ ...members[0], id, collapsed: false, position: { x: box.x, y: box.y }, size: { width: box.width, height: box.height }, locked: members.some(n => n.locked) });
  }
  const placed = arrange([...proxies, ...workspace.nodes.filter(n => !owner.has(n.id))], workspace.edges.map(e => ({ ...e, source: owner.get(e.source) || e.source, target: owner.get(e.target) || e.target })).filter(e => e.source !== e.target), algorithm);
  const positions = new Map(placed.map(n => [n.id, n.position]));
  return workspace.nodes.map(n => {
    const groupId = owner.get(n.id); if (!groupId) return { ...n, position: positions.get(n.id)! };
    const before = origins.get(groupId)!, after = positions.get(groupId)!;
    return { ...n, position: { x: n.position.x + after.x - before.x, y: n.position.y + after.y - before.y } };
  });
}
