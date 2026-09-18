import type { Workspace, Idea, NodeStyle, EdgeStyle } from '../types';
import { workspaceSchema } from '../../shared/schema.mjs';
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const defaultNodeStyle: NodeStyle = {
  background: '#ffffff', borderColor: '#dce3df', borderWidth: 1, borderStyle: 'solid',
  radius: 14, shadow: true, textColor: '#273b35', font: 'sans', fontSize: 16, bold: true, italic: false,
};
export const defaultEdgeStyle: EdgeStyle = { color: '#a4b6ac', width: 2, path: 'automatic', line: 'solid', arrow: false, startTerminator: 'none', endTerminator: 'none' };
export const palettes = [
  { name: 'Sage', background: '#eaf1e9', borderColor: '#b5cbb8', textColor: '#345344' },
  { name: 'Lavender', background: '#f0ecf8', borderColor: '#cec0e7', textColor: '#655182' },
  { name: 'Peach', background: '#fcf0e5', borderColor: '#e8cbb0', textColor: '#926747' },
  { name: 'Sky', background: '#eaf2fa', borderColor: '#b9d1e7', textColor: '#466c8d' },
  { name: 'Rose', background: '#f9eaec', borderColor: '#e5bbc3', textColor: '#925d6c' },
  { name: 'Paper', background: '#ffffff', borderColor: '#dce3df', textColor: '#273b35' },
];
export function makeIdea(title = 'Untitled idea', position = { x: 0, y: 0 }, body = ''): Idea {
  const date = now();
  return { id: uid(), title, body, tags: [], cardType: 'Idea', createdAt: date, updatedAt: date, position, locked: false,
    style: { ...defaultNodeStyle }, history: [{ id: uid(), title, body, tags: [], cardType: 'Idea', savedAt: date }] };
}
export function saveRevision(node: Idea): Idea {
  const latest = node.history.at(-1);
  if (latest?.title === node.title && latest.body === node.body && latest.cardType === node.cardType && JSON.stringify(latest.tags) === JSON.stringify(node.tags)) return node;
  return { ...node, updatedAt: now(), history: [...node.history, { id: uid(), title: node.title, body: node.body, tags: [...node.tags], cardType: node.cardType, savedAt: now() }] };
}
export function restoreRevision(node: Idea, revisionId: string): Idea {
  const revision = node.history.find(r => r.id === revisionId);
  if (!revision) return node;
  const preserved = saveRevision(node);
  return saveRevision({ ...preserved, title: revision.title, body: revision.body, tags: [...revision.tags], cardType: revision.cardType });
}
export function parseWorkspace(input: unknown): Workspace { return workspaceSchema.parse(input) as Workspace; }
export function freshWorkspace(): Workspace {
  return { schemaVersion: 1, id: uid(), title: 'Untitled mind map', updatedAt: now(), nodes: [], edges: [], assets: {}, searchHistory: [], customThemes: [] };
}
export function initialWorkspace(): Workspace {
  const root = makeIdea('A more connected mind', { x: 400, y: 230 },
    '# A more connected mind\n\nA little room for big ideas. Collect what sparks your curiosity, find the connections, and make something meaningful.\n\n## Start with a spark\n\n- Capture an idea before it disappears\n- Give it a little context\n- Connect it to something you already know\n\n> Good ideas rarely arrive fully formed. Give them somewhere to grow.');
  root.id = 'start'; root.style = { ...root.style, ...palettes[0], borderWidth: 2 };
  const research = makeIdea('Follow your curiosity', { x: 55, y: 50 },
    '## Follow your curiosity\n\nKeep the interesting things close: a quote, a screenshot, an unexpected question.\n\n### A small research ritual\n\n- [x] Make space for exploration\n- [ ] Collect three interesting references\n- [ ] Ask a better question\n\nConnect your discoveries to [the bigger picture](node://start).');
  research.id = 'research'; research.style = { ...research.style, ...palettes[1] };
  const ideas = makeIdea('Make room for ideas', { x: 755, y: 55 },
    '## Make room for ideas\n\nStart messy. A mind map is a place to think out loud.\n\n**Try this:** add a child node, write one sentence, then let the next connection happen.\n\nVisit [Shape what comes next](node://next) when you are ready to turn an idea into action.');
  ideas.id = 'ideas'; ideas.style = { ...ideas.style, ...palettes[2] };
  const notes = makeIdea('Keep the good bits', { x: 45, y: 355 },
    '## Keep the good bits\n\nEvery node has a Markdown note, so a quick thought can become something more.\n\n### Your notes can hold\n\n1. **Formatted text** and lists\n2. Screenshots pasted right into the editor\n3. Links to [other ideas](node://ideas)\n4. Tables, code, and saved versions\n\n```text\nA thought → a connection → a possibility\n```');
  notes.id = 'notes'; notes.style = { ...notes.style, ...palettes[3] };
  const next = makeIdea('Shape what comes next', { x: 755, y: 370 },
    '## Shape what comes next\n\nGive the ideas you love a next step.\n\n| Idea | Next small step |\n| --- | --- |\n| Explore | Follow one interesting lead |\n| Connect | Link two related thoughts |\n| Create | Make a tiny first version |\n\nPin a node when it feels right. Auto-arrange will work around it.');
  next.id = 'next'; next.style = { ...next.style, ...palettes[0] };
  const reflect = makeIdea('Leave space to reflect', { x: 405, y: 495 },
    '## Leave space to reflect\n\nThinking is an iterative process. Save a version at a meaningful moment and return to it whenever you need.\n\n> Sometimes the next step is a little distance.\n\nRevisit [the bigger picture](node://start) with fresh eyes.');
  reflect.id = 'reflect'; reflect.style = { ...reflect.style, ...palettes[4] };
  const nodes = [root, research, ideas, notes, next, reflect];
  nodes.forEach(n => { n.history = [{ id: uid(), title: n.title, body: n.body, tags: [...n.tags], cardType: n.cardType, savedAt: n.createdAt }]; });
  return parseWorkspace({ schemaVersion: 1, id: uid(), title: 'A space for connected thinking', updatedAt: now(), nodes,
    edges: nodes.slice(1).map(n => ({ id: uid(), source: root.id, target: n.id,
      style: { ...defaultEdgeStyle, color: n.style.borderColor } })), assets: {} });
}
