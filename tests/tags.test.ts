import { describe, it, expect } from 'vitest';
import { tagQuery, tagHighlight } from '../shared/tags.mjs';
import { rankTagResults, contentKey } from '../electron/vector-core.mjs';
import { initialWorkspace, parseWorkspace, makeIdea, saveRevision, restoreRevision } from '../src/lib/model';
import { branchNodeIds } from '../src/lib/graph';

describe('tags and semantic map highlighting', () => {
  it('migrates old workspaces and normalizes exact tags', () => {
    const original = initialWorkspace();
    const old = JSON.parse(JSON.stringify(original));
    delete old.searchHistory;
    for (const node of old.nodes) { delete node.tags; delete node.cardType; for (const revision of node.history) { delete revision.tags; delete revision.cardType; } }
    for (const edge of old.edges) { delete edge.style.startTerminator; delete edge.style.endTerminator; edge.style.arrow = true; }
    const migrated = parseWorkspace(old);
    expect(migrated.nodes[0].tags).toEqual([]);
    expect(migrated.nodes[0].cardType).toBe('Idea');
    expect(migrated.searchHistory).toEqual([]);
    expect(migrated.edges[0].style.endTerminator).toBe('solid-arrow');
    old.nodes[0].tags = ['#Garden', 'GARDEN', 'food'];
    expect(parseWorkspace(old).nodes[0].tags).toEqual(['garden', 'food']);
    expect(tagQuery(' #GARDEN ')).toBe('garden');
    expect(tagQuery('#two tags')).toBeNull();
  });
  it('saves and restores tags and card types without losing newer edits', () => {
    let node = makeIdea('Planting');
    const original = node.history[0].id;
    node = saveRevision({ ...node, tags: ['garden'], cardType: 'Project' });
    expect(node.history).toHaveLength(2);
    const restored = restoreRevision({ ...node, tags: ['soil'], cardType: 'Task' }, original);
    expect(restored.tags).toEqual([]);
    expect(restored.cardType).toBe('Idea');
    expect(restored.history.some(revision => revision.tags.includes('soil') && revision.cardType === 'Task')).toBe(true);
    expect(contentKey('t', 'b', ['a'])).not.toBe(contentKey('t', 'b', ['b']));
  });
  it('ranks all tag matches, gives exact matches priority, ignores bodies/history, and clamps distance', () => {
    const docs = Array.from({ length: 25 }, (_, i) => ({ nodeId: String(i), title: 'Node', tags: ['Garden'], key: String(i) }));
    docs.push({ nodeId: 'related', title: 'Related', tags: ['plants'], key: 'related' });
    const cache = { related: { chunks: [{ kind: 'tag', tag: 'plants', text: '#plants', vector: [0.8, 0.6] }] }, far: { chunks: [{ kind: 'tag', tag: 'cars', vector: [0, 1] }] }, body: { chunks: [{ text: 'garden', vector: [1, 0] }] } };
    const results = rankTagResults([...docs, { nodeId: 'far', tags: ['cars'], key: 'far' }, { nodeId: 'body', tags: [], key: 'body' }, { nodeId: 'old', revisionId: 'v1', tags: ['garden'], key: 'old' }], cache, [1, 0], '#garden');
    expect(results).toHaveLength(26);
    expect(results.slice(0, 25).every(r => r.exact)).toBe(true);
    expect(results.at(-1)?.distance).toBeCloseTo(0.2);
    expect(tagHighlight(results.at(-1), 0.19)).toBeNull();
    expect(tagHighlight({ distance: 0.55 }, 0.55)?.color).toBe('hsl(55 86% 82%)');
    expect(tagHighlight({ distance: 0.550001 }, 0.55)).toBeNull();
    expect(tagHighlight({ distance: NaN }, 0.55)).toBeNull();
    expect(tagHighlight({ exact: true }, 0)?.kind).toBe('exact');
  });
});
describe('branch deletion', () => {
  it('preserves shared descendants, handles cycles, and deletes only downstream nodes', () => {
    const workspace = initialWorkspace();
    const base = workspace.edges[0];
    workspace.edges = [
      { ...base, id: 'a', source: 'start', target: 'research' },
      { ...base, id: 'b', source: 'research', target: 'ideas' },
      { ...base, id: 'c', source: 'ideas', target: 'research' },
      { ...base, id: 'd', source: 'research', target: 'notes' },
      { ...base, id: 'e', source: 'reflect', target: 'notes' },
      { ...base, id: 'f', source: 'notes', target: 'next' },
    ];
    expect([...branchNodeIds(workspace, 'research')].sort()).toEqual(['ideas', 'research']);
    expect([...branchNodeIds(workspace, 'start')].sort()).toEqual(['ideas', 'research', 'start']);
  });
});
