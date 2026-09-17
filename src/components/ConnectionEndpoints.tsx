import type { Connector, Idea } from '../types';
import type { Connection } from '@xyflow/react';
export function ConnectionEndpoints({ edge, nodes, onChange }: { edge: Connector; nodes: Idea[]; onChange: (id: string, connection: Connection) => void }) {
  function change(patch: Partial<Connection>) { onChange(edge.id, { source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle || null, targetHandle: edge.targetHandle || null, ...patch }); }
  return <div className="connection-endpoints"><h4>Move this connection</h4><p>Drag either end on the map, or choose its node and attachment side here.</p>
    {(['source', 'target'] as const).map(end => <div key={end}><label>{end === 'source' ? 'From node' : 'To node'}<select aria-label={end === 'source' ? 'Connection source' : 'Connection target'} value={edge[end]} onChange={e => change({ [end]: e.target.value, [`${end}Handle`]: null })}>{nodes.filter(node => node.id !== edge[end === 'source' ? 'target' : 'source']).map(node => <option key={node.id} value={node.id}>{node.title || 'Untitled idea'}</option>)}</select></label>
      <label>Attachment<select aria-label={`${end} attachment`} value={edge[`${end}Handle`] || ''} onChange={e => change({ [`${end}Handle`]: e.target.value || null })}><option value="">Automatic</option>{['left', 'right', 'top', 'bottom'].map(side => <option key={side} value={side}>{side}</option>)}</select></label></div>)}
  </div>;
}
