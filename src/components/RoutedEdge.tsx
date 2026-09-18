import { BaseEdge, type Edge, type EdgeProps } from '@xyflow/react';
import type { Route } from '../lib/connectorRouting';

export function RoutedEdge({ id, data, style, markerStart, markerEnd, interactionWidth }: EdgeProps<Edge<{ route: Route }>>) {
  const route = data?.route;
  if (!route || route.blocked) return null;
  const maskId = `route-mask-${id}`, railId = `rail-mask-${id}`;
  const width = Number(style?.strokeWidth || 2);
  const points = [...route.points, ...route.bridges.flatMap(b => b.points)];
  const x = Math.min(...points.map(p => p.x)) - 30, y = Math.min(...points.map(p => p.y)) - 30;
  const bounds = { x, y, width: Math.max(...points.map(p => p.x)) - x + 30, height: Math.max(...points.map(p => p.y)) - y + 30 };
  return <>
    <defs>
      <mask id={maskId} maskUnits="userSpaceOnUse" {...bounds}>
        <rect {...bounds} fill="white" />
        {route.bridges.map((bridge, i) => <path key={i} d={bridge.cutPath} fill="none" stroke="black" strokeWidth={width + 2} />)}
        {route.gaps.map((point, i) => <circle key={i} cx={point.x} cy={point.y} r={point.radius} fill="black" />)}
      </mask>
      <mask id={railId} maskUnits="userSpaceOnUse" {...bounds}>
        <rect {...bounds} fill="white" />
        {route.bridges.map((bridge, i) => <path key={i} d={bridge.path} fill="none" stroke="black" strokeWidth={2} />)}
      </mask>
    </defs>
    <BaseEdge id={id} path={route.path} style={style} markerStart={markerStart} markerEnd={markerEnd} interactionWidth={interactionWidth} mask={`url(#${maskId})`} />
    {route.bridges.map((bridge, i) => <path key={i} className="connector-bridge" d={bridge.path} fill="none" stroke={style?.stroke || '#a4b6ac'} strokeWidth={width + 3} strokeLinejoin="round" mask={`url(#${railId})`} pointerEvents="none" />)}
  </>;
}
