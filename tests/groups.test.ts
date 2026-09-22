import { describe, expect, it } from 'vitest';
import { initialWorkspace, parseWorkspace } from '../src/lib/model';
import { cleanGroups, defaultGroupStyle, putInGroup, regionGeometry } from '../src/lib/groups';
import { arrangeGroups } from '../src/lib/groupLayout';
import { cardSize } from '../src/lib/cardSize';

describe('card groups', () => {
  it('loads older maps and validates unique, live group membership', () => {
    const w = initialWorkspace(), group = { id: 'group-a', name: 'Research', nodeIds: [w.nodes[0].id], style: defaultGroupStyle };
    const { groups: _groups, ...legacy } = w;
    expect(parseWorkspace(legacy).groups).toEqual([]);
    expect(parseWorkspace({ ...w, groups: [group] }).groups).toEqual([group]);
    expect(() => parseWorkspace({ ...w, groups: [group, group] })).toThrow();
    expect(parseWorkspace({ ...w, groups: [group, { ...group, id: 'other' }] }).groups).toHaveLength(2);
    expect(() => parseWorkspace({ ...w, groups: [{ ...group, nodeIds: [w.nodes[0].id, w.nodes[0].id] }] })).toThrow();
    expect(() => parseWorkspace({ ...w, groups: [{ ...group, nodeIds: ['missing'] }] })).toThrow();
  });
  it('shares members between groups and removes empty boundaries without changing cards or connections', () => {
    const original = initialWorkspace(), ids = original.nodes.map(n => n.id);
    let w = putInGroup(original, { id: 'a', name: 'A', nodeIds: ids.slice(0, 2), style: defaultGroupStyle });
    w = putInGroup(w, { id: 'b', name: 'B', nodeIds: [ids[1], ids[2], ids[2]], style: defaultGroupStyle });
    expect(w.groups.map(g => g.nodeIds)).toEqual([[ids[0], ids[1]], [ids[1], ids[2]]]);
    expect(cleanGroups(w.groups, new Set([ids[2]]))).toEqual([{ ...w.groups[1], nodeIds: [ids[2]] }]);
    w = putInGroup(w, { ...w.groups[0], nodeIds: [] });
    expect(w.groups.map(g => g.id)).toEqual(['b']);
    expect(w.nodes).toBe(original.nodes); expect(w.edges).toBe(original.edges);
  });
  for (const algorithm of ['hierarchy', 'radial', 'force'] as const) it(`${algorithm} preserves all overlapping groups and pins their shared component`, () => {
    let w = initialWorkspace(); const ids = w.nodes.map(n => n.id);
    w = putInGroup(w, { id: 'a', name: 'A', nodeIds: ids.slice(0, 2), style: defaultGroupStyle });
    w = putInGroup(w, { id: 'b', name: 'B', nodeIds: ids.slice(1, 3), style: { ...defaultGroupStyle, padding: 80 } });
    w = putInGroup(w, { id: 'c', name: 'C', nodeIds: ids.slice(2, 4), style: defaultGroupStyle });
    const placed = arrangeGroups(w, algorithm), delta = { x: placed[0].position.x - w.nodes[0].position.x, y: placed[0].position.y - w.nodes[0].position.y };
    for (let i = 1; i < 4; i++) { expect(placed[i].position.x - w.nodes[i].position.x).toBeCloseTo(delta.x); expect(placed[i].position.y - w.nodes[i].position.y).toBeCloseTo(delta.y); }
    w.nodes[3].locked = true;
    expect(arrangeGroups(w, algorithm).slice(0, 4).map(n => n.position)).toEqual(w.nodes.slice(0, 4).map(n => n.position));
  });
  it('builds smooth closed boundaries and adapts to a collapsed member', () => {
    const node = initialWorkspace().nodes[0];
    const expanded = regionGeometry([{ ...node.position, ...cardSize(node) }], 36, .9)!;
    const collapsed = regionGeometry([{ ...node.position, ...cardSize({ ...node, collapsed: true }) }], 36, .9)!;
    expect(expanded.path).toContain('Q'); expect(expanded.path).toMatch(/ Z$/);
    expect(expanded.width).toBe(cardSize(node).width + 72);
    expect(collapsed.height).toBeLessThan(expanded.height); expect(collapsed.width).toBe(expanded.width);
    expect(regionGeometry([], 36, .9)).toBeNull();
    expect(regionGeometry([{ x: -900, y: -400, width: 240, height: 160 }], 20, 1)!.path).not.toMatch(/NaN|Infinity/);
  });
  for (const algorithm of ['hierarchy', 'radial', 'force'] as const) it(`${algorithm} preserves internal layout, including large and pinned groups`, () => {
    let w = initialWorkspace(); w.nodes[1].position = { x: 2700, y: 1800 };
    const members = w.nodes.slice(0, 2);
    w = putInGroup(w, { id: 'a', name: 'A', nodeIds: members.map(n => n.id), style: defaultGroupStyle });
    const result = arrangeGroups(w, algorithm);
    expect(result[1].position.x - result[0].position.x).toBeCloseTo(members[1].position.x - members[0].position.x);
    expect(result[1].position.y - result[0].position.y).toBeCloseTo(members[1].position.y - members[0].position.y);
    const box = regionGeometry(result.slice(0, 2).map(n => ({ ...n.position, ...cardSize(n) })), 36, .9)!;
    for (const n of result.slice(2)) { const s = cardSize(n); expect(n.position.x >= box.x + box.width || n.position.x + s.width <= box.x || n.position.y >= box.y + box.height || n.position.y + s.height <= box.y).toBe(true); }
    w.nodes[1].locked = true;
    expect(arrangeGroups(w, algorithm).slice(0, 2).map(n => n.position)).toEqual(members.map(n => n.position));
    expect(() => parseWorkspace({ ...w, nodes: result })).not.toThrow();
  });
});
