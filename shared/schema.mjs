import { z } from 'zod';
import { normalizeTags, normalizeTag, validTag } from './tags.mjs';

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const date = z.string().datetime();
const body = z.string().max(5_000_000);
const title = z.string().max(160);
const cardType = z.string().trim().min(1).max(40).default('Idea');
const terminator = z.enum(['none', 'solid-arrow', 'white-arrow', 'open-arrow', 'dot', 'hollow-dot', 'diamond', 'one', 'many']);
const handle = z.enum(['left', 'right', 'top', 'bottom']).nullable().optional();
const tags = z.array(z.string().max(128).transform(normalizeTag).refine(validTag, 'Tags use letters, numbers, hyphens, or underscores (up to 64 characters).')).max(32).default([]).transform(normalizeTags);
export const nodeStyleSchema = z.object({
  background: color, borderColor: color, borderWidth: z.number().min(0).max(8),
  borderStyle: z.enum(['solid', 'dashed', 'dotted']), radius: z.number().min(0).max(36),
  shadow: z.boolean(), textColor: color, font: z.enum(['sans', 'serif', 'mono']),
  fontSize: z.number().min(12).max(28), bold: z.boolean(), italic: z.boolean(),
});
export const edgeStyleSchema = z.object({
  color, width: z.number().min(1).max(8), path: z.enum(['automatic', 'bezier', 'angular', 'straight']).default('automatic'),
  line: z.enum(['solid', 'dashed', 'dotted']), arrow: z.boolean().default(false),
  startTerminator: terminator.default('none'), endTerminator: terminator.optional(),
}).transform(style => ({ ...style, endTerminator: style.endTerminator ?? (style.arrow ? 'solid-arrow' : 'none') }));
export const workspaceSchema = z.object({
  schemaVersion: z.literal(1), id, title: z.string().min(1).max(160), updatedAt: date,
  customThemes: z.array(z.object({ id: id.refine(value => !value.startsWith('builtin-'), 'Reserved theme ID'), name: z.string().trim().min(1).max(60), style: nodeStyleSchema })).max(100).default([]),
  searchHistory: z.array(z.object({ query: z.string().min(1).max(2000), mode: z.enum(['semantic', 'text']), includeHistory: z.boolean(), cutoff: z.number().min(0).max(0.8), searchedAt: date })).max(50).default([]),
  nodes: z.array(z.object({
    meetingSourceKey: z.string().min(1).max(512).optional(),
    id, title, body, tags, cardType, createdAt: date, updatedAt: date, locked: z.boolean(),
    position: z.object({ x: z.number().finite().min(-1e6).max(1e6), y: z.number().finite().min(-1e6).max(1e6) }),
    size: z.object({ width: z.number().finite().min(240).max(2000), height: z.number().finite().min(160).max(2000) }).optional(),
    style: nodeStyleSchema,
    history: z.array(z.object({ id, title, body, tags, cardType, savedAt: date })).max(10000),
  })).max(5000),
  edges: z.array(z.object({ id, source: id, target: id, sourceHandle: handle, targetHandle: handle, style: edgeStyleSchema })).max(20000),
  assets: z.record(z.string().regex(/^assets\/[a-zA-Z0-9_-]+\.(png|jpg|webp|gif)$/),
    z.string().max(14_000_000).regex(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/)),
}).superRefine((value, ctx) => {
  const ids = new Set(value.nodes.map(n => n.id));
  if (new Set(value.customThemes.map(theme => theme.id)).size !== value.customThemes.length) ctx.addIssue({ code: 'custom', message: 'Duplicate theme IDs' });
  if (ids.size !== value.nodes.length) ctx.addIssue({ code: 'custom', message: 'Duplicate node IDs' });
  if (new Set(value.edges.map(e => e.id)).size !== value.edges.length) ctx.addIssue({ code: 'custom', message: 'Duplicate connector IDs' });
  for (const edge of value.edges) if (!ids.has(edge.source) || !ids.has(edge.target))
    ctx.addIssue({ code: 'custom', message: 'Connector points to a missing node' });
  for (const node of value.nodes) if (new Set(node.history.map(v => v.id)).size !== node.history.length)
    ctx.addIssue({ code: 'custom', message: 'Duplicate revision IDs' });
});
