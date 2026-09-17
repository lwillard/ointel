import dagre from '@dagrejs/dagre';
import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY, type SimulationNodeDatum } from 'd3-force';
import type { Idea, Connector } from '../types';
import { cardSize } from './cardSize';
export type Layout = 'hierarchy' | 'radial' | 'force';
export function arrange(nodes: Idea[], edges: Connector[], algorithm: Layout): Idea[] {
  if (!nodes.length) return nodes;
  const positions = new Map<string, { x: number; y: number }>();
  if (algorithm === 'hierarchy') {
    const graph = new dagre.graphlib.Graph().setGraph({ rankdir: 'LR', nodesep: 65, ranksep: 120 }).setDefaultEdgeLabel(() => ({}));
    nodes.forEach(n => graph.setNode(n.id, { ...cardSize(n) }));
    edges.forEach(e => graph.setEdge(e.source, e.target));
    dagre.layout(graph);
    nodes.forEach(n => { const p = graph.node(n.id), size = cardSize(n); positions.set(n.id, { x: p.x - size.width / 2, y: p.y - size.height / 2 }); });
  } else if (algorithm === 'radial') {
    const root = nodes.find(n => !edges.some(e => e.target === n.id)) || nodes[0];
    const levels = new Map([[root.id, 0]]);
    const queue = [root.id];
    for (let i = 0; i < queue.length; i++) {
      for (const e of edges) {
        const next = e.source === queue[i] ? e.target : e.target === queue[i] ? e.source : null;
        if (next && !levels.has(next)) { levels.set(next, levels.get(queue[i])! + 1); queue.push(next); }
      }
    }
    nodes.forEach(n => { if (!levels.has(n.id)) levels.set(n.id, 1); });
    const rootSize = cardSize(root);
    const center = { x: root.position.x + rootSize.width / 2, y: root.position.y + rootSize.height / 2 };
    positions.set(root.id, root.position);
    let previousRadius = 0;
    let previousHalfDiagonal = Math.hypot(rootSize.width, rootSize.height) / 2;
    for (let level = 1; level <= Math.max(...levels.values()); level++) {
      const ring = nodes.filter(n => levels.get(n.id) === level);
      const halfDiagonal = Math.max(...ring.map(n => { const s = cardSize(n); return Math.hypot(s.width, s.height) / 2; }));
      const radius = Math.max(previousRadius + previousHalfDiagonal + halfDiagonal + 40, ring.length * (halfDiagonal * 2 + 40) / (2 * Math.PI));
      ring.forEach((n, i) => { const angle = i / ring.length * 2 * Math.PI - Math.PI / 2;
        const size = cardSize(n);
        positions.set(n.id, { x: center.x + Math.cos(angle) * radius - size.width / 2, y: center.y + Math.sin(angle) * radius - size.height / 2 }); });
      previousRadius = radius;
      previousHalfDiagonal = halfDiagonal;
    }
  } else {
    type Point = SimulationNodeDatum & { id: string; width: number; height: number; radius: number };
    const points: Point[] = nodes.map(n => {
      const size = cardSize(n), x = n.position.x + size.width / 2, y = n.position.y + size.height / 2;
      return { id: n.id, ...size, radius: Math.hypot(size.width, size.height) / 2 + 12, x, y, ...(n.locked ? { fx: x, fy: y } : {}) };
    });
    const simulation = forceSimulation(points)
      .force('link', forceLink<Point, { source: string | Point; target: string | Point }>(edges.map(e => ({ source: e.source, target: e.target }))).id(n => n.id).distance(link => (link.source as Point).radius + (link.target as Point).radius + 30))
      .force('charge', forceManyBody().strength(-1200)).force('collision', forceCollide<Point>(n => n.radius))
      .force('x', forceX(400).strength(0.025)).force('y', forceY(260).strength(0.025)).stop();
    simulation.tick(240);
    points.forEach(n => positions.set(n.id, { x: n.x! - n.width / 2, y: n.y! - n.height / 2 }));
  }
  // Reserve pinned rectangles first, then resolve collisions without moving them.
  const placed = nodes.filter(n => n.locked).map(n => ({ ...n.position, ...cardSize(n) }));
  return nodes.map(n => {
    if (n.locked) return n;
    const position = { ...(positions.get(n.id) || n.position) };
    const size = cardSize(n);
    let collision;
    while ((collision = placed.find(p => position.x < p.x + p.width + 24 && position.x + size.width + 24 > p.x && position.y < p.y + p.height + 24 && position.y + size.height + 24 > p.y))) position.y = collision.y + collision.height + 32;
    placed.push({ ...position, ...size });
    return { ...n, position };
  });
}
