import { createHash } from 'node:crypto';
import { normalizeTag, MAX_TAG_DISTANCE } from '../shared/tags.mjs';
export const MODEL = 'Xenova/all-MiniLM-L6-v2';
export const MODEL_KEY = `${MODEL}:q8:mean:normalized:chunks-v2`;
export function plainText(markdown) {
  return markdown.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code) => {
      const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
      if (code[0] !== '#') return named[code.toLowerCase()] || entity;
      const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ' ';
    }).replace(/[#*_`~>|]/g, ' ').replace(/\s+/g, ' ').trim();
}
export function contentKey(title, body, tags = []) {
  return createHash('sha256').update(`${MODEL_KEY}\0${title}\0${body}\0${JSON.stringify(tags)}`).digest('hex');
}
export function cosine(a, b) {
  if (a.length !== b.length || !a.length) return 0;
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}
export function documentsFor(workspace) {
  return workspace.nodes.flatMap(node => [
    { nodeId: node.id, title: node.title, body: node.body, tags: node.tags || [], key: contentKey(node.title, node.body, node.tags) },
    ...node.history.map(revision => ({ nodeId: node.id, revisionId: revision.id, savedAt: revision.savedAt,
      title: revision.title, body: revision.body, tags: revision.tags || [], key: contentKey(revision.title, revision.body, revision.tags) })),
  ]);
}
export function rankTagResults(documents, cache, queryVector, query) {
  const tag = normalizeTag(query);
  return documents.filter(doc => !doc.revisionId).map(doc => {
    const exact = (doc.tags || []).some(value => normalizeTag(value) === tag);
    let score = -1, matchedTag = '';
    for (const chunk of cache[doc.key]?.chunks || []) {
      if (chunk.kind !== 'tag') continue;
      const similarity = cosine(queryVector, chunk.vector);
      if (similarity > score) { score = similarity; matchedTag = chunk.tag; }
    }
    if (exact) { score = 1; matchedTag = tag; }
    const distance = Math.max(0, Math.min(2, 1 - score));
    return { nodeId: doc.nodeId, title: doc.title, snippet: `#${matchedTag}`, score, distance, exact, matchedTag };
  }).filter(result => result.exact || result.distance <= MAX_TAG_DISTANCE)
    .sort((a, b) => Number(b.exact) - Number(a.exact) || a.distance - b.distance);
}
export function rankResults(documents, cache, queryVector, includeHistory = false, limit = 20) {
  return documents.filter(doc => includeHistory || !doc.revisionId).map(doc => {
    const chunks = cache[doc.key]?.chunks || [];
    let best = { score: -1, snippet: '' };
    for (const chunk of chunks) { const score = cosine(queryVector, chunk.vector); if (score > best.score) best = { score, snippet: chunk.text }; }
    return { nodeId: doc.nodeId, revisionId: doc.revisionId, savedAt: doc.savedAt, title: doc.title, ...best };
  }).filter(r => r.score >= 0.15).sort((a, b) => b.score - a.score).slice(0, limit);
}
