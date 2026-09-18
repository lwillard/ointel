import { describe, expect, it } from 'vitest';
import { allocatePorts, routeConnections, segmentHitsCard, type CardBounds } from '../src/lib/connectorRouting';
import { defaultEdgeStyle, initialWorkspace, parseWorkspace } from '../src/lib/model';
import type { Connector, EdgeStyle } from '../src/types';

const card = (id: string, x: number, y: number, width = 240, height = 160): CardBounds => ({ id, x, y, width, height, radius: 14 });
const edge = (id: string, source: string, target: string, options: Partial<Connector> = {}): Connector => ({ id, source, target, style: { ...defaultEdgeStyle }, ...options });
function assertClear(cards: CardBounds[], edges: Connector[]) {
  const routes = routeConnections(cards, edges);
  for (const route of routes.values()) {
    expect(route.blocked).toBe(false);
    for (let i = 1; i < route.points.length; i++) for (const r of cards) expect(segmentHitsCard(route.points[i - 1], route.points[i], r), `route intersects ${r.id}`).toBe(false);
    for (const bridge of route.bridges) for (let i = 1; i < bridge.points.length; i++) for (const r of cards) expect(segmentHitsCard(bridge.points[i - 1], bridge.points[i], r)).toBe(false);
  }
  return routes;
}

describe('automatic connector routing', () => {
  it('defaults to automatic and preserves explicitly saved legacy styles', () => {
    expect(defaultEdgeStyle.path).toBe('automatic');
    const workspace = initialWorkspace(); workspace.edges[0].style.path = 'bezier';
    expect(parseWorkspace(workspace).edges[0].style.path).toBe('bezier');
    delete (workspace.edges[0].style as Partial<EdgeStyle>).path;
    expect(parseWorkspace(workspace).edges[0].style.path).toBe('automatic');
  });
  for (const path of ['automatic', 'bezier'] as const) {
    it(`${path} preserves the original cubic when no obstacle is in the way`, () => {
      const cards = [card('a', 0, 0), card('b', 600, 240)];
      const route = assertClear(cards, [edge('ab', 'a', 'b', { sourceHandle: 'right', targetHandle: 'left', style: { ...defaultEdgeStyle, path } })]).get('ab')!;
      expect(route.path).toBe('M 240 136 C 420 136 420 264 600 264');
      expect(route.points.length).toBeGreaterThan(10);
    });
    it(`${path} adds cubic waypoints around a blocker rather than orthogonal elbows`, () => {
      const cards = [card('a', 0, 200), card('b', 850, 200), card('blocker', 400, 150, 300, 260)];
      const route = assertClear(cards, [edge('ab', 'a', 'b', { sourceHandle: 'right', targetHandle: 'left', style: { ...defaultEdgeStyle, path } })]).get('ab')!;
      expect(route.path.match(/C /g)!.length).toBeGreaterThan(1);
      expect(route.path).not.toMatch(/[LQHV]/);
      expect(route.points.some((p, i) => i && Math.abs(p.x - route.points[i - 1].x) > 1 && Math.abs(p.y - route.points[i - 1].y) > 1)).toBe(true);
    });
  }
  it('repels both incoming and outgoing ports on a face, compressing only when crowded', () => {
    const cards = [card('hub', 0, 0), ...Array.from({ length: 30 }, (_, i) => card(`n${i}`, 700, 0))];
    const edges = cards.slice(1).map((n, i) => i % 2 ? edge(`e${i}`, n.id, 'hub', { targetHandle: 'right' }) : edge(`e${i}`, 'hub', n.id, { sourceHandle: 'right' }));
    for (const count of [4, 30]) {
      const ports = [...allocatePorts(cards, edges.slice(0, count)).values()].flatMap(p => [p.source, p.target]).filter(p => p.nodeId === 'hub').sort((a, b) => a.offset - b.offset);
      expect(ports[0].offset).toBeGreaterThanOrEqual(24); expect(ports.at(-1)!.offset).toBeLessThanOrEqual(136);
      for (let i = 1; i < ports.length; i++) expect(ports[i].offset - ports[i - 1].offset).toBeCloseTo(count === 4 ? 22 : 112 / 29, 5);
    }
  });
  for (const path of ['automatic', 'angular', 'straight', 'bezier'] as const) {
    it(`${path} detours around a blocking card and respects manual sides`, () => {
      const cards = [card('a', 0, 200), card('b', 850, 200), card('blocker', 400, 150, 300, 260)];
      const routes = assertClear(cards, [edge('ab', 'a', 'b', { sourceHandle: 'right', targetHandle: 'left', style: { ...defaultEdgeStyle, path } })]);
      expect(routes.get('ab')!.source.side).toBe('right'); expect(routes.get('ab')!.target.side).toBe('left');
      expect(routes.get('ab')!.points.some(p => p.y < 150 || p.y > 410)).toBe(true);
    });
  }
  it('routes through an alternating obstacle maze and around resized cards', () => {
    const cards = [card('a', 0, 300), card('b', 1800, 300), card('wall1', 400, 100, 240, 520), card('wall2', 850, 0, 240, 350), card('wall3', 1300, 450, 240, 400)];
    const edges = [edge('ab', 'a', 'b', { sourceHandle: 'right', targetHandle: 'left' })];
    const before = assertClear(cards, edges).get('ab')!.path;
    cards[2].height = 900; cards[2].y = -200;
    const after = assertClear(cards, edges).get('ab')!.path;
    expect(after).not.toBe(before);
  });
  it('makes stable double-rail overpasses, irrespective of edge order', () => {
    const cards = [card('left', 0, 350), card('right', 900, 350), card('top', 450, 0), card('bottom', 450, 750)];
    const edges = [edge('horizontal', 'left', 'right'), edge('vertical', 'top', 'bottom')];
    const routes = assertClear(cards, edges);
    expect(routes.get('vertical')!.bridges).toHaveLength(1); expect(routes.get('horizontal')!.gaps).toHaveLength(1);
    expect(routeConnections(cards, [...edges].reverse()).get('vertical')!.bridges).toEqual(routes.get('vertical')!.bridges);
  });
  it('does not put a bridge on shared endpoints or parallel runs', () => {
    const cards = [card('a', 0, 0), card('b', 600, 0), card('c', 600, 300)];
    const routes = assertClear(cards, [edge('ab', 'a', 'b'), edge('ac', 'a', 'c')]);
    expect([...routes.values()].flatMap(r => r.bridges)).toHaveLength(0);
  });
  it('never falls back to a line through a card when a manual port is buried', () => {
    const cards = [card('a', 0, 0), card('b', 600, 0), card('cover', 210, -100, 250, 400)];
    const route = routeConnections(cards, [edge('ab', 'a', 'b', { sourceHandle: 'right' })]).get('ab')!;
    expect(route.blocked).toBe(true); expect(route.path).toBe('');
  });
  it('uses a narrow safe corridor when the preferred clearance does not fit', () => {
    const cards = [card('a', 0, 0), card('b', 260, 0)];
    const route = assertClear(cards, [edge('ab', 'a', 'b', { sourceHandle: 'right', targetHandle: 'left' })]).get('ab')!;
    expect(route.points[0]).toEqual({ x: 240, y: 80 });
    expect(route.points.at(-1)).toEqual({ x: 260, y: 80 });
    expect(route.points.every(p => p.y === 80)).toBe(true);
  });
  it('merges nearby crossings into one overpass and clears the whole arch underneath', () => {
    const cards = [card('left', 0, 350), card('right', 900, 350), card('top', 450, 0), card('bottom', 450, 750)];
    const edges = [edge('a', 'left', 'right'), edge('b', 'left', 'right'), edge('z', 'top', 'bottom')];
    const routes = assertClear(cards, edges);
    expect(routes.get('z')!.bridges).toHaveLength(1);
    expect(routes.get('a')!.gaps[0].radius).toBeGreaterThan(9);
    expect(routes.get('b')!.gaps[0].radius).toBeGreaterThan(9);
  });
  it('keeps the sample map connected', () => {
    const workspace = initialWorkspace();
    assertClear(workspace.nodes.map(n => card(n.id, n.position.x, n.position.y)), workspace.edges);
  });
  it('handles a representative 100-card map without an unbounded search', () => {
    const cards = Array.from({ length: 100 }, (_, i) => card(`n${i}`, (i % 10) * 380, Math.floor(i / 10) * 300));
    const edges = cards.slice(1).map((r, i) => edge(`e${i}`, cards[i].id, r.id));
    const start = performance.now(); assertClear(cards, edges);
    expect(performance.now() - start).toBeLessThan(2000);
  });
});
