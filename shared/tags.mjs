export const DEFAULT_TAG_DISTANCE = 0.55;
export const MAX_TAG_DISTANCE = 0.8;
export const normalizeTag = value => value.normalize('NFKC').trim().replace(/^#+/, '').toLowerCase();
export const validTag = value => /^[\p{L}\p{N}_-]{1,64}$/u.test(value);
export const normalizeTags = values => [...new Set(values.map(normalizeTag))];
export function tagQuery(text) {
  const value = text.trim();
  if (!value.startsWith('#')) return null;
  const tag = normalizeTag(value);
  return validTag(tag) ? tag : null;
}
export function tagHighlight(match, cutoff) {
  if (match?.exact) return { kind: 'exact', distance: 0 };
  if (!match || !Number.isFinite(match.distance) || match.distance < 0 || match.distance > cutoff) return null;
  const fraction = cutoff > 0 ? match.distance / cutoff : 0;
  return { kind: 'semantic', distance: match.distance, color: `hsl(${100 - 45 * fraction} 86% 82%)` };
}
