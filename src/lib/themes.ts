import type { CardTheme, NodeStyle, Workspace } from '../types';
import { defaultNodeStyle } from './model';
export const builtInThemes: CardTheme[] = [
  { id: 'builtin-sage', name: 'Sage', style: { ...defaultNodeStyle, background: '#eaf1e9', borderColor: '#9eb9a3', textColor: '#345344', borderWidth: 2, radius: 14 } },
  { id: 'builtin-editorial', name: 'Editorial', style: { ...defaultNodeStyle, background: '#fff9eb', borderColor: '#b5a27b', textColor: '#443c2c', font: 'serif', fontSize: 20, bold: false, borderWidth: 1, radius: 3, shadow: false } },
  { id: 'builtin-blueprint', name: 'Blueprint', style: { ...defaultNodeStyle, background: '#e9f2ff', borderColor: '#4380bf', textColor: '#224c7a', font: 'mono', fontSize: 15, borderStyle: 'dashed', borderWidth: 2, radius: 4, shadow: false } },
  { id: 'builtin-orchid', name: 'Orchid', style: { ...defaultNodeStyle, background: '#f4eafd', borderColor: '#b69bdb', textColor: '#653b87', font: 'serif', italic: true, fontSize: 18, radius: 24, borderWidth: 2 } },
  { id: 'builtin-sunset', name: 'Sunset', style: { ...defaultNodeStyle, background: '#fff0de', borderColor: '#df9856', textColor: '#82441f', fontSize: 18, radius: 20, borderWidth: 2 } },
  { id: 'builtin-graphite', name: 'Graphite', style: { ...defaultNodeStyle, background: '#edf0f2', borderColor: '#505c68', textColor: '#26333e', font: 'mono', fontSize: 15, radius: 0, borderWidth: 3, shadow: false } },
  { id: 'builtin-confetti', name: 'Confetti', style: { ...defaultNodeStyle, background: '#fff1f5', borderColor: '#ca819c', textColor: '#883e59', fontSize: 17, borderStyle: 'dotted', borderWidth: 3, radius: 28 } },
  { id: 'builtin-minimal', name: 'Minimal', style: { ...defaultNodeStyle, background: '#ffffff', borderColor: '#dce3df', textColor: '#344139', fontSize: 16, bold: false, radius: 8, borderWidth: 1, shadow: false } },
];
export function sameCardStyle(a: NodeStyle, b: NodeStyle) {
  return (Object.keys(defaultNodeStyle) as (keyof NodeStyle)[]).every(key => a[key] === b[key]);
}
export function applyCardTheme(workspace: Workspace, ids: readonly string[], style: NodeStyle): Workspace {
  const selected = new Set(ids);
  if (!workspace.nodes.some(node => selected.has(node.id) && !sameCardStyle(node.style, style))) return workspace;
  return { ...workspace, nodes: workspace.nodes.map(node => selected.has(node.id) ? { ...node, style: { ...style } } : node) };
}
