import { describe, it, expect } from 'vitest';
import { cardSize } from '../src/lib/cardSize';
import { makeIdea, freshWorkspace, parseWorkspace } from '../src/lib/model';
import { arrange } from '../src/lib/layout';

describe('collapsed card geometry and persistence', () => {
  it('preserves expanded dimensions while using compact bounds for display and layout', () => {
    const node = { ...makeIdea(), size: { width: 360, height: 280 }, collapsed: true };
    expect(cardSize(node)).toEqual({ width: 360, height: 64 });
    expect(cardSize(node, true)).toEqual({ width: 470, height: 460 });
    expect(cardSize({ ...node, collapsed: false })).toEqual(node.size);
    const workspace = { ...freshWorkspace(), nodes: [node] };
    const loaded = parseWorkspace(JSON.parse(JSON.stringify(workspace))).nodes[0];
    expect(loaded.collapsed).toBe(true); expect(loaded.size).toEqual(node.size);
  });
  it('allows untyped cards and saved revisions without silently assigning Idea', () => {
    const node = makeIdea(); node.cardType = ''; node.history[0].cardType = '';
    const workspace = { ...freshWorkspace(), nodes: [node] };
    const loaded = parseWorkspace(workspace).nodes[0];
    expect(loaded.cardType).toBe(''); expect(loaded.history[0].cardType).toBe('');
    expect(loaded.collapsed).toBe(false);
  });
  it('reserves space for large title typography and thick borders', () => {
    const node = makeIdea(); node.collapsed = true; node.style.fontSize = 28; node.style.borderWidth = 8;
    expect(cardSize(node).height).toBeGreaterThanOrEqual(35 + 16 + 24);
  });
  it('arranges mixed collapsed and expanded cards without overlap', () => {
    const nodes = Array.from({ length: 8 }, (_, i) => ({ ...makeIdea(), collapsed: i % 2 === 0, size: { width: 300, height: 240 } }));
    const result = arrange(nodes, [], 'hierarchy');
    for (let i = 0; i < result.length; i++) for (let j = i + 1; j < result.length; j++) {
      const a = result[i], b = result[j], sa = cardSize(a), sb = cardSize(b);
      expect(a.position.x + sa.width <= b.position.x || b.position.x + sb.width <= a.position.x || a.position.y + sa.height <= b.position.y || b.position.y + sb.height <= a.position.y).toBe(true);
    }
  });
});
