import { describe, expect, it } from 'vitest';
import { initialWorkspace, makeIdea, parseWorkspace, restoreRevision, saveRevision } from '../src/lib/model';
import { arrange } from '../src/lib/layout';

describe('saved note history', () => {
  it('preserves unsaved work before restoring an older version', () => {
    let node = makeIdea('First title', { x: 0, y: 0 }, 'First body');
    const original = node.history[0].id;
    node = saveRevision({ ...node, title: 'Second title', body: 'Second body' });
    node = { ...node, title: 'Latest title', body: 'Unsaved changes' };
    const restored = restoreRevision(node, original);
    expect(restored.body).toBe('First body');
    expect(restored.title).toBe('First title');
    expect(restored.history.map(v => v.body)).toEqual(['First body', 'Second body', 'Unsaved changes', 'First body']);
  });
  it('does not create duplicate snapshots without a change', () => {
    const node = makeIdea('Title', { x: 0, y: 0 }, 'Body');
    expect(saveRevision(node)).toBe(node);
  });
});
describe('layouts', () => {
  for (const algorithm of ['hierarchy', 'radial', 'force'] as const) {
    it(`${algorithm} spaces mixed card sizes around a large pinned card`, () => {
      const workspace = initialWorkspace();
      workspace.nodes.forEach((node, i) => { node.size = { width: 240 + i * 120, height: 160 + i * 95 }; });
      workspace.nodes[1].locked = true;
      workspace.nodes[1].size = { width: 1500, height: 1000 };
      const result = arrange(workspace.nodes, workspace.edges, algorithm);
      expect(result[1].position).toEqual(workspace.nodes[1].position);
      expect(result.map(n => n.size)).toEqual(workspace.nodes.map(n => n.size));
      for (let a = 0; a < result.length; a++) for (let b = a + 1; b < result.length; b++) {
        const left = result[a], right = result[b];
        expect(left.position.x + left.size!.width <= right.position.x || right.position.x + right.size!.width <= left.position.x ||
          left.position.y + left.size!.height <= right.position.y || right.position.y + right.size!.height <= left.position.y).toBe(true);
      }
    });
    it(`${algorithm} preserves locked positions and prevents collisions with unlocked nodes`, () => {
      const workspace = initialWorkspace();
      workspace.nodes[1].locked = true;
      workspace.nodes[1].position = { x: 10, y: 20 };
      const result = arrange(workspace.nodes, workspace.edges, algorithm);
      expect(result[1].position).toEqual({ x: 10, y: 20 });
      expect(workspace.nodes[0].position).toEqual({ x: 400, y: 230 });
      for (let a = 0; a < result.length; a++) for (let b = a + 1; b < result.length; b++) {
        const dx = Math.abs(result[a].position.x - result[b].position.x);
        const dy = Math.abs(result[a].position.y - result[b].position.y);
        expect(dx >= 240 || dy >= 160).toBe(true);
      }
    });
    it(`${algorithm} supports cycles and disconnected ideas`, () => {
      const workspace = initialWorkspace();
      workspace.edges.push({ ...workspace.edges[0], id: 'cycle', source: 'research', target: 'start' });
      workspace.nodes.push(makeIdea('Disconnected'));
      expect(arrange(workspace.nodes, workspace.edges, algorithm).every(n => Number.isFinite(n.position.x) && Number.isFinite(n.position.y))).toBe(true);
    });
  }
});
describe('workspace validation', () => {
  it('persists custom card sizes and accepts older cards without them', () => {
    const w = initialWorkspace(); w.nodes[0].size = { width: 530, height: 380 };
    expect(parseWorkspace(JSON.parse(JSON.stringify(w)))).toEqual(w);
    for (const size of [{ width: 0, height: 160 }, { width: 240, height: Infinity }, { width: 2001, height: 200 }]) {
      w.nodes[0].size = size; expect(() => parseWorkspace(w)).toThrow();
    }
  });
  it('round-trips a complete portable workspace', () => { const w = initialWorkspace(); expect(parseWorkspace(JSON.parse(JSON.stringify(w)))).toEqual(w); });
  it('rejects dangerous filenames, non-finite coordinates, invalid styles, and dangling links', () => {
    for (const edit of [
      (w: ReturnType<typeof initialWorkspace>) => { w.nodes[0].id = '../escape'; },
      (w: ReturnType<typeof initialWorkspace>) => { w.nodes[0].position.x = Infinity; },
      (w: ReturnType<typeof initialWorkspace>) => { w.nodes[0].style.background = 'url(evil)'; },
      (w: ReturnType<typeof initialWorkspace>) => { w.edges[0].target = 'missing'; },
      (w: ReturnType<typeof initialWorkspace>) => { w.assets['../../escape.png'] = 'data:image/png;base64,AA=='; },
    ]) { const w = initialWorkspace(); edit(w); expect(() => parseWorkspace(w)).toThrow(); }
  });
});
