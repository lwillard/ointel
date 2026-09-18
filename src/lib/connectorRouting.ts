import type { Connector } from '../types';

export type Point = { x: number; y: number };
export type Side = 'left' | 'right' | 'top' | 'bottom';
export type CardBounds = Point & { id: string; width: number; height: number; radius?: number };
export type Port = { id: string; nodeId: string; side: Side; offset: number; point: Point };
export type Bridge = { path: string; cutPath: string; from: Point; to: Point; points: Point[] };
export type Route = { source: Port; target: Port; points: Point[]; path: string; bridges: Bridge[]; gaps: (Point & { radius: number })[]; width: number; blocked: boolean };
const sides: Side[] = ['left', 'right', 'top', 'bottom'];
const normal: Record<Side, Point> = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 } };
const EPS = 0.001;
const CLEARANCE = 26;
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const center = (r: CardBounds): Point => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
const horizontal = (s: Side) => s === 'top' || s === 'bottom';
const inflate = (r: CardBounds, amount: number): CardBounds => ({ ...r, x: r.x - amount, y: r.y - amount, width: r.width + amount * 2, height: r.height + amount * 2 });
const add = (p: Point, v: Point, amount: number): Point => ({ x: p.x + v.x * amount, y: p.y + v.y * amount });
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export const attachmentSide = (id?: string | null): Side | null => sides.includes(id as Side) ? id as Side : null;

/** Open-rectangle intersection: travelling along an obstacle boundary is safe. */
export function segmentHitsCard(a: Point, b: Point, r: CardBounds): boolean {
  let low = 0, high = 1;
  for (const [start, delta, min, max] of [[a.x, b.x - a.x, r.x + EPS, r.x + r.width - EPS], [a.y, b.y - a.y, r.y + EPS, r.y + r.height - EPS]]) {
    if (Math.abs(delta) < EPS) { if (start <= min || start >= max) return false; }
    else { const u = (min - start) / delta, v = (max - start) / delta; low = Math.max(low, Math.min(u, v)); high = Math.min(high, Math.max(u, v)); }
    if (low >= high) return false;
  }
  return low < high;
}
const clear = (a: Point, b: Point, obstacles: CardBounds[]) => !obstacles.some(r => segmentHitsCard(a, b, r));
const pathClear = (points: Point[], obstacles: CardBounds[]) => points.slice(1).every((p, i) => clear(points[i], p, obstacles));

function portPoint(r: CardBounds, side: Side, offset: number): Point {
  return { x: side === 'left' ? r.x : side === 'right' ? r.x + r.width : r.x + offset,
    y: side === 'top' ? r.y : side === 'bottom' ? r.y + r.height : r.y + offset };
}

/** Project toward the other card; reserve rounded corners, then repel neighbours. */
export function allocatePorts(cards: CardBounds[], edges: Connector[]): Map<string, { source: Port; target: Port }> {
  const byId = new Map(cards.map(r => [r.id, r]));
  const groups = new Map<string, { port: Port; desired: number; card: CardBounds }[]>();
  const result = new Map<string, { source: Port; target: Port }>();
  for (const edge of edges) {
    const source = byId.get(edge.source), target = byId.get(edge.target);
    if (!source || !target) continue;
    const ports = (['source', 'target'] as const).map(end => {
      const card = end === 'source' ? source : target, other = end === 'source' ? target : source;
      const c = center(card), aim = center(other);
      const preferred = attachmentSide(edge[`${end}Handle`]);
      const side = preferred || [...sides].sort((a, b) => {
        const score = (s: Side) => {
          const offset = clamp(horizontal(s) ? aim.x - card.x : aim.y - card.y, 24, (horizontal(s) ? card.width : card.height) - 24);
          const p = portPoint(card, s, offset), stub = add(p, normal[s], CLEARANCE);
          const blocked = cards.some(r => r.id !== card.id && segmentHitsCard(p, stub, inflate(r, 5)));
          const facing = (aim.x - c.x) * normal[s].x + (aim.y - c.y) * normal[s].y;
          return distance(stub, aim) + (facing < 0 ? 100 : 0) + (blocked ? 1e7 : 0);
        };
        return score(a) - score(b);
      })[0];
      const port: Port = { id: `port:${edge.id}:${end}:${side}`, nodeId: card.id, side, offset: 0, point: c };
      const key = `${card.id}:${side}`, group = groups.get(key) || [];
      group.push({ port, desired: horizontal(side) ? aim.x - card.x : aim.y - card.y, card }); groups.set(key, group);
      return port;
    });
    result.set(edge.id, { source: ports[0], target: ports[1] });
  }
  for (const group of groups.values()) {
    const { card, port } = group[0];
    const length = horizontal(port.side) ? card.width : card.height;
    const inset = Math.min(length / 2, Math.max(22, (card.radius || 0) + 10));
    const gap = Math.min(22, (length - 2 * inset) / Math.max(1, group.length - 1));
    group.sort((a, b) => a.desired - b.desired || a.port.id.localeCompare(b.port.id));
    const offsets = group.map(item => clamp(item.desired, inset, length - inset));
    for (let i = 1; i < offsets.length; i++) offsets[i] = Math.max(offsets[i], offsets[i - 1] + gap);
    offsets[offsets.length - 1] = Math.min(offsets.at(-1)!, length - inset);
    for (let i = offsets.length - 2; i >= 0; i--) offsets[i] = Math.min(offsets[i], offsets[i + 1] - gap);
    group.forEach((item, i) => { item.port.offset = offsets[i]; item.port.point = portPoint(card, item.port.side, offsets[i]); });
  }
  return result;
}

function simplify(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const p of points) {
    if (result.length && distance(result.at(-1)!, p) < EPS) continue;
    while (result.length > 1) {
      const a = result.at(-2)!, b = result.at(-1)!;
      if (Math.abs((b.x - a.x) * (p.y - b.y) - (b.y - a.y) * (p.x - b.x)) > EPS || (b.x - a.x) * (p.x - b.x) + (b.y - a.y) * (p.y - b.y) < 0) break;
      result.pop();
    }
    result.push(p);
  }
  return result;
}

class MinHeap {
  items: { key: number; cost: number; rank: number }[] = [];
  push(item: { key: number; cost: number; rank: number }) {
    let i = this.items.length; this.items.push(item);
    while (i) { const p = (i - 1) >> 1; if (this.items[p].rank <= item.rank) break; this.items[i] = this.items[p]; i = p; } this.items[i] = item;
  }
  pop() {
    const first = this.items[0], last = this.items.pop()!;
    if (this.items.length) {
      let i = 0;
      while (i * 2 + 1 < this.items.length) {
        let c = i * 2 + 1; if (c + 1 < this.items.length && this.items[c + 1].rank < this.items[c].rank) c++;
        if (this.items[c].rank >= last.rank) break; this.items[i] = this.items[c]; i = c;
      } this.items[i] = last;
    } return first;
  }
}

/** Rectilinear visibility grid, searched lazily with A*. No unsafe straight fallback. */
function orthogonalRoute(start: Point, end: Point, obstacles: CardBounds[]): Point[] | null {
  if (obstacles.some(r => [start, end].some(p => p.x > r.x + EPS && p.x < r.x + r.width - EPS && p.y > r.y + EPS && p.y < r.y + r.height - EPS))) return null;
  const candidates: Point[][] = [
    [start, { x: end.x, y: start.y }, end], [start, { x: start.x, y: end.y }, end],
    [start, { x: (start.x + end.x) / 2, y: start.y }, { x: (start.x + end.x) / 2, y: end.y }, end],
    [start, { x: start.x, y: (start.y + end.y) / 2 }, { x: end.x, y: (start.y + end.y) / 2 }, end],
  ];
  const fast = candidates.map(simplify).filter(p => pathClear(p, obstacles)).sort((a, b) => a.length - b.length)[0];
  if (fast) return fast;
  const xs = [...new Set([start.x, end.x, ...obstacles.flatMap(r => [r.x, r.x + r.width])])].sort((a, b) => a - b);
  const ys = [...new Set([start.y, end.y, ...obstacles.flatMap(r => [r.y, r.y + r.height])])].sort((a, b) => a - b);
  const width = xs.length, startCell = ys.indexOf(start.y) * width + xs.indexOf(start.x), endCell = ys.indexOf(end.y) * width + xs.indexOf(end.x);
  const point = (cell: number): Point => ({ x: xs[cell % width], y: ys[Math.floor(cell / width)] });
  const best = new Map<number, number>(), parents = new Map<number, number>(), heap = new MinHeap();
  const startKey = startCell * 3;
  best.set(startKey, 0); heap.push({ key: startKey, cost: 0, rank: 0 });
  while (heap.items.length) {
    const current = heap.pop(); if (best.get(current.key) !== current.cost) continue;
    const cell = Math.floor(current.key / 3), direction = current.key % 3, p = point(cell);
    if (cell === endCell) {
      const route: Point[] = []; let key: number | undefined = current.key;
      while (key !== undefined) { route.push(point(Math.floor(key / 3))); key = parents.get(key); }
      return simplify(route.reverse());
    }
    const x = cell % width, y = Math.floor(cell / width);
    for (const [nx, ny, dir] of [[x - 1, y, 1], [x + 1, y, 1], [x, y - 1, 2], [x, y + 1, 2]]) {
      if (nx < 0 || nx >= xs.length || ny < 0 || ny >= ys.length) continue;
      const next = ny * width + nx, q = point(next);
      if (!clear(p, q, obstacles)) continue;
      const cost = current.cost + distance(p, q) + (direction && direction !== dir ? 32 : 0), key = next * 3 + dir;
      if (cost >= (best.get(key) ?? Infinity)) continue;
      best.set(key, cost); parents.set(key, current.key);
      heap.push({ key, cost, rank: cost + Math.abs(q.x - end.x) + Math.abs(q.y - end.y) });
    }
  }
  return null;
}

/** Diagonal visibility routing supplies a few obstacle-corner knots for flowing curves. */
function visibilityRoute(start: Point, end: Point, obstacles: CardBounds[]): Point[] | null {
  if (clear(start, end, obstacles)) return [start, end];
  const inside = (p: Point) => obstacles.some(r => p.x > r.x + EPS && p.x < r.x + r.width - EPS && p.y > r.y + EPS && p.y < r.y + r.height - EPS);
  if (inside(start) || inside(end)) return null;
  const points = [start, end, ...obstacles.flatMap(r => [
    { x: r.x, y: r.y }, { x: r.x + r.width, y: r.y },
    { x: r.x, y: r.y + r.height }, { x: r.x + r.width, y: r.y + r.height },
  ]).filter(p => !inside(p))];
  const best = new Map<number, number>([[0, 0]]), parents = new Map<number, number>(), heap = new MinHeap();
  heap.push({ key: 0, cost: 0, rank: distance(start, end) });
  while (heap.items.length) {
    const current = heap.pop(); if (best.get(current.key) !== current.cost) continue;
    if (current.key === 1) {
      const route: Point[] = []; let key: number | undefined = 1;
      while (key !== undefined) { route.push(points[key]); key = parents.get(key); }
      return simplify(route.reverse());
    }
    for (let i = 1; i < points.length; i++) {
      const cost = current.cost + distance(points[current.key], points[i]);
      if (cost >= (best.get(i) ?? Infinity) || !clear(points[current.key], points[i], obstacles)) continue;
      best.set(i, cost); parents.set(i, current.key); heap.push({ key: i, cost, rank: cost + distance(points[i], end) });
    }
  }
  return null;
}

type Cubic = [Point, Point, Point, Point];
const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
function splitCubic([a, b, c, d]: Cubic): [Cubic, Cubic] {
  const ab = midpoint(a, b), bc = midpoint(b, c), cd = midpoint(c, d), abc = midpoint(ab, bc), bcd = midpoint(bc, cd), m = midpoint(abc, bcd);
  return [[a, ab, abc, m], [m, bcd, cd, d]];
}

// A cubic stays inside its control hull. Subdivide ambiguous hulls rather than
// trusting sparse samples, which can miss a curve clipping a card's corner.
function cubicHitsCard(curve: Cubic, r: CardBounds, depth = 0): boolean {
  const xs = curve.map(p => p.x), ys = curve.map(p => p.y);
  if (Math.max(...xs) <= r.x + EPS || Math.min(...xs) >= r.x + r.width - EPS ||
      Math.max(...ys) <= r.y + EPS || Math.min(...ys) >= r.y + r.height - EPS) return false;
  if (depth === 12) return true;
  if (curve.every(p => p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height)) return true;
  const [left, right] = splitCubic(curve);
  return cubicHitsCard(left, r, depth + 1) || cubicHitsCard(right, r, depth + 1);
}
const cubicClear = (curve: Cubic, obstacles: CardBounds[]) => obstacles.every(r => !cubicHitsCard(curve, r));

function flattenCubic(curve: Cubic, depth = 0): Point[] {
  const [a, b, c, d] = curve, chord = distance(a, d);
  const deviation = (p: Point) => chord < EPS ? distance(a, p) : Math.abs((d.x - a.x) * (a.y - p.y) - (a.x - p.x) * (d.y - a.y)) / chord;
  if (depth === 12 || (Math.max(deviation(b), deviation(c)) < 0.15 && distance(a, b) + distance(b, c) + distance(c, d) - chord < 0.15)) return [a, d];
  const [left, right] = splitCubic(curve);
  return [...flattenCubic(left, depth + 1).slice(0, -1), ...flattenCubic(right, depth + 1)];
}
function cubicGeometry(curves: Cubic[]): { points: Point[]; path: string } {
  const xy = (p: Point) => `${number(p.x)} ${number(p.y)}`;
  return { points: curves.flatMap((curve, i) => flattenCubic(curve).slice(i ? 1 : 0)),
    path: `M ${xy(curves[0][0])} ` + curves.map(([, b, c, d]) => `C ${xy(b)} ${xy(c)} ${xy(d)}`).join(' ') };
}

function originalBezier(source: Port, target: Port): Cubic {
  const control = (port: Port, other: Port) => {
    const n = normal[port.side], delta = (other.point.x - port.point.x) * n.x + (other.point.y - port.point.y) * n.y;
    // Match React Flow's original default curvature (0.25).
    return add(port.point, n, delta >= 0 ? delta / 2 : 25 * Math.sqrt(-delta));
  };
  return [source.point, control(source, target), control(target, source), target.point];
}

/** Use the old single cubic when clear; add smooth waypoints only for obstacles. */
function flowingBezier(guide: Point[], source: Port, target: Port, obstacles: CardBounds[], guideObstacles: CardBounds[]) {
  // Remove grid corners that have line of sight. These remaining knots guide a
  // continuous curve, not an orthogonal line with small rounded elbows.
  const knots = [guide[0]];
  for (let i = 0; i < guide.length - 1;) {
    let next = guide.length - 1;
    while (next > i + 1 && !clear(guide[i], guide[next], guideObstacles)) next--;
    knots.push(guide[next]); i = next;
  }
  const unit = (a: Point, b: Point): Point => { const len = distance(a, b) || 1; return { x: (b.x - a.x) / len, y: (b.y - a.y) / len }; };
  const tangents = knots.map((_, i) => i === 0 ? normal[source.side] : i === knots.length - 1 ? add({ x: 0, y: 0 }, normal[target.side], -1) : unit(knots[i - 1], knots[i + 1]));
  const curves: Cubic[] = [];
  for (let i = 1; i < knots.length; i++) {
    const a = knots[i - 1], d = knots[i], length = distance(a, d);
    const before = i > 1 ? Math.min(length, distance(knots[i - 2], a)) : length;
    const after = i < knots.length - 1 ? Math.min(length, distance(d, knots[i + 1])) : length;
    for (const tension of [0.4, 0.28, 0.16, 0.08, 0]) {
      const curve: Cubic = [a, add(a, tangents[i - 1], before * tension), add(d, tangents[i], -after * tension), d];
      if (cubicClear(curve, obstacles) || tension === 0) { curves.push(curve); break; }
    }
  }
  return cubicGeometry(curves);
}
const number = (n: number) => +n.toFixed(3);
export const svgPath = (points: Point[]) => points.map((p, i) => `${i ? 'L' : 'M'} ${number(p.x)} ${number(p.y)}`).join(' ');

type Crossing = { under: Route; point: Point; along: number };
function lengths(points: Point[]): number[] {
  const result = [0]; for (let i = 1; i < points.length; i++) result.push(result[i - 1] + distance(points[i - 1], points[i])); return result;
}
function atLength(points: Point[], lengths: number[], along: number): { point: Point; normal: Point } {
  let i = 1; while (i < lengths.length - 1 && lengths[i] < along) i++;
  const a = points[i - 1], b = points[i], len = lengths[i] - lengths[i - 1], t = clamp((along - lengths[i - 1]) / len, 0, 1);
  return { point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, normal: { x: -(b.y - a.y) / len, y: (b.x - a.x) / len } };
}
function intersection(a: Point, b: Point, c: Point, d: Point): Point | null {
  const vx = b.x - a.x, vy = b.y - a.y, wx = d.x - c.x, wy = d.y - c.y, cross = vx * wy - vy * wx;
  if (Math.abs(cross) < EPS) return null;
  const t = ((c.x - a.x) * wy - (c.y - a.y) * wx) / cross, u = ((c.x - a.x) * vy - (c.y - a.y) * vx) / cross;
  return t >= -EPS && t <= 1 + EPS && u >= -EPS && u <= 1 + EPS ? { x: a.x + t * vx, y: a.y + t * vy } : null;
}

/** Stable over/under order, with two rails on each arch and a gap beneath it. */
function addBridges(routes: Map<string, Route>, cards: CardBounds[]) {
  const sorted = [...routes.entries()].sort(([a], [b]) => a.localeCompare(b));
  const obstacles = cards.map(r => inflate(r, 6));
  for (let i = 0; i < sorted.length; i++) {
    const over = sorted[i][1]; if (over.blocked) continue;
    const crossings: Crossing[] = [], cumulative = lengths(over.points), total = cumulative.at(-1)!;
    for (let j = 0; j < i; j++) {
      const under = sorted[j][1]; if (under.blocked) continue;
      for (let s = 1; s < over.points.length; s++) for (let t = 1; t < under.points.length; t++) {
        const point = intersection(over.points[s - 1], over.points[s], under.points[t - 1], under.points[t]);
        if (!point || [over.source.point, over.target.point, under.source.point, under.target.point].some(p => distance(p, point) < 1)) continue;
        if (!crossings.some(c => c.under === under && distance(c.point, point) < 1)) crossings.push({ under, point, along: cumulative[s - 1] + distance(over.points[s - 1], point) });
      }
    }
    const groups: Crossing[][] = [];
    for (const hit of crossings.sort((a, b) => a.along - b.along)) {
      const last = groups.at(-1); if (last && hit.along - last.at(-1)!.along < 28) last.push(hit); else groups.push([hit]);
    }
    for (const group of groups) {
      const begin = Math.max(1, group[0].along - 11), finish = Math.min(total - 1, group.at(-1)!.along + 11);
      const from = atLength(over.points, cumulative, begin).point, to = atLength(over.points, cumulative, finish).point;
      const cut = [from, ...over.points.filter((_, k) => cumulative[k] > begin && cumulative[k] < finish), to];
      let done = false;
      for (const height of [9, 6, 3]) {
        for (const sign of [-1, 1]) {
          const samples = Math.max(20, Math.ceil((finish - begin) / 2));
          // Offset the actual route, including rounded bends, rather than assuming a straight runway.
          const points = Array.from({ length: samples + 1 }, (_, k) => {
            const t = k / samples, at = atLength(over.points, cumulative, begin + (finish - begin) * t);
            return add(at.point, at.normal, Math.sin(t * Math.PI) * height * sign);
          });
          if (!pathClear(points, obstacles)) continue;
          over.bridges.push({ path: svgPath(points), cutPath: svgPath(cut), from, to, points });
          group.forEach(hit => hit.under.gaps.push({ ...hit.point, radius: height + over.width / 2 + 4 })); done = true; break;
        }
        if (done) break;
      }
    }
  }
}

export function routeConnections(cards: CardBounds[], edges: Connector[]): Map<string, Route> {
  const ports = allocatePorts(cards, edges), routes = new Map<string, Route>();
  const inkObstacles = cards.map(r => inflate(r, 6));
  for (const edge of edges) {
    const pair = ports.get(edge.id); if (!pair) continue;
    const { source, target } = pair;
    const curved = edge.style.path === 'automatic' || edge.style.path === 'bezier';
    const curveObstacles = cards.map(r => r.id === source.nodeId || r.id === target.nodeId ? r : inflate(r, 7));
    const direct = originalBezier(source, target);
    if (curved && cubicClear(direct, curveObstacles)) {
      routes.set(edge.id, { ...pair, ...cubicGeometry([direct]), bridges: [], gaps: [], width: edge.style.width + 1, blocked: false });
      continue;
    }
    let middle: Point[] | null = null, usedClearance = CLEARANCE;
    // Prefer breathing room, but use a narrower safe corridor when cards are close.
    for (const clearance of [CLEARANCE, 12, 6]) {
      const obstacles = cards.map(r => inflate(r, clearance));
      const start = add(source.point, normal[source.side], clearance), end = add(target.point, normal[target.side], clearance);
      const stemsClear = clear(source.point, start, inkObstacles.filter(r => r.id !== source.nodeId)) && clear(end, target.point, inkObstacles.filter(r => r.id !== target.nodeId));
      usedClearance = clearance;
      middle = stemsClear ? curved ? visibilityRoute(start, end, obstacles) : (edge.style.path === 'straight' && clear(start, end, obstacles) ? [start, end] : orthogonalRoute(start, end, obstacles)) : null;
      if (middle) break;
    }
    const points = middle ? simplify([source.point, ...middle, target.point]) : [];
    const geometry = points.length && curved ? flowingBezier(points, source, target, curveObstacles, cards.map(r => r.id === source.nodeId || r.id === target.nodeId ? r : inflate(r, usedClearance))) : { points, path: svgPath(points) };
    routes.set(edge.id, { ...pair, ...geometry, bridges: [], gaps: [], width: edge.style.width + 1, blocked: !middle });
  }
  addBridges(routes, cards); return routes;
}
