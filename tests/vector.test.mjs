import { describe, expect, it } from 'vitest';
import { contentKey, plainText, documentsFor, cosine, rankResults } from '../electron/vector-core.mjs';
describe('vector index', () => {
  it('includes titles, current bodies, and every saved revision', () => {
    const docs = documentsFor({ nodes: [{ id: 'one', title: 'Current', body: 'Body', history: [{ id: 'v1', title: 'Old', body: 'Archived' }] }] });
    expect(docs).toHaveLength(2); expect(docs[1].revisionId).toBe('v1');
    expect(contentKey('a', 'same')).not.toBe(contentKey('b', 'same'));
    expect(contentKey('same', 'a')).not.toBe(contentKey('same', 'b'));
  });
  it('preserves visible Markdown text without embedding image encodings or link URLs', () => {
    expect(plainText('# Hello **world**\n![A chart](assets/image.png) [Related](node://abc)')).toBe('Hello world A chart Related');
    expect(plainText('<span style="color:#aa2233"><strong>Research</strong></span> &amp; O&#39;Brien &#x26; notes')).toBe("Research & O'Brien & notes");
  });
  it('ranks by the most relevant chunk and excludes history unless requested', () => {
    const docs = [{ nodeId: 'a', key: 'a', title: 'A' }, { nodeId: 'b', key: 'b', title: 'B' }, { nodeId: 'a', revisionId: 'r', key: 'c', title: 'Old A' }];
    const cache = { a: { chunks: [{ text: 'irrelevant', vector: [0, 1] }, { text: 'relevant late in a long note', vector: [1, .1] }] }, b: { chunks: [{ text: 'other', vector: [.3, .7] }] }, c: { chunks: [{ text: 'old', vector: [1, 0] }] } };
    const results = rankResults(docs, cache, [1, 0]);
    expect(results[0].nodeId).toBe('a'); expect(results[0].snippet).toContain('late'); expect(results).toHaveLength(2);
    expect(rankResults(docs, cache, [1, 0], true)[0].revisionId).toBe('r');
    expect(cosine([0, 0], [0, 1])).toBe(0);
  });
});
