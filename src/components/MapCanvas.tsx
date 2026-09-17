import { createContext, useContext, useEffect, useMemo, useCallback } from 'react';
import { ReactFlow, Background, BackgroundVariant, Handle, Position, MiniMap, SelectionMode, NodeResizeControl,
  applyNodeChanges, useNodesState, useUpdateNodeInternals, type Node, type NodeChange, type Edge, type NodeProps, type ReactFlowInstance, type Connection } from '@xyflow/react';
import { FileText, Pin, Sprout, Plus, Maximize, Minus } from 'lucide-react';
import type { Idea, Workspace } from '../types';
import type { ActiveCardEditor } from '../lib/richText';
import { InlineCardEditor } from './InlineCardEditor';
import { Markdown } from './Markdown';
import type { SearchResult } from '../types';
import { tagHighlight } from '../../shared/tags.mjs';
import { ConnectionMarkers, markerId } from './ConnectionMarkers';
import { cardSize, MIN_CARD_SIZE, EDIT_CARD_SIZE, MAX_CARD_SIZE } from '../lib/cardSize';
import '@xyflow/react/dist/style.css';
type IdeaNode = Node<{ idea: Idea; dimmed: boolean; editing: boolean }, 'idea'>;
const CardContext = createContext<Props | null>(null);
function IdeaCard({ data, selected }: NodeProps<IdeaNode>) {
  const { idea, dimmed, editing } = data;
  const actions = useContext(CardContext)!;
  const updateInternals = useUpdateNodeInternals();
  useEffect(() => { requestAnimationFrame(() => updateInternals(idea.id)); }, [editing, idea.id, idea.size?.width, idea.size?.height, updateInternals]);
  const s = idea.style;
  const match = tagHighlight(actions.tagMatches[idea.id], actions.tagCutoff);
  const preview = idea.body.replace(/^#{1,6} [^\n]*\n+/, '');
  return <div data-tag-match={match?.kind || undefined} data-tag-distance={match?.distance} className={`idea-card ${match?.kind === 'exact' ? 'tag-exact-match' : ''} ${editing ? 'is-editing' : ''} ${selected ? 'is-selected' : ''} ${dimmed && !match ? 'dimmed' : ''}`} style={{
    background: match?.kind === 'semantic' ? match.color : s.background, borderColor: match?.kind === 'exact' ? '#26c65b' : s.borderColor, borderWidth: match?.kind === 'exact' ? Math.max(2, s.borderWidth) : s.borderWidth,
    borderStyle: s.borderStyle, borderRadius: s.radius, color: s.textColor,
    boxShadow: s.shadow ? '0 5px 16px -10px #233d3540, 0 2px 4px #233d3505' : 'none',
  }}>
    {selected && (idea.locked ? ['bottom-right'] as const : ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map(position => <NodeResizeControl
      key={position} position={position} className="card-resize-handle" color="#6d8d60"
      minWidth={editing ? EDIT_CARD_SIZE.width : MIN_CARD_SIZE.width} minHeight={editing ? EDIT_CARD_SIZE.height : MIN_CARD_SIZE.height}
      maxWidth={MAX_CARD_SIZE} maxHeight={MAX_CARD_SIZE}
      onResizeEnd={(_, size) => actions.onResize(idea.id, size)} />)}
    {(['left', 'right', 'top', 'bottom'] as const).map(side => <Handle key={side} id={side} type="source" position={Position[side === 'left' ? 'Left' : side === 'right' ? 'Right' : side === 'top' ? 'Top' : 'Bottom']} />)}
    <div className="idea-eyebrow"><span><span className="idea-dot" />{idea.cardType}</span>{idea.locked && <Pin size={12} fill="currentColor" aria-label="Pinned" />}</div>
    {editing ? <InlineCardEditor idea={idea} assets={actions.workspace.assets} focus={actions.editingFocus} onEdit={actions.onEdit}
      onActive={actions.onActiveEditor} onDone={actions.onFinishEditing} onSave={actions.onSaveVersion} onImage={actions.onImage} onNavigate={actions.onNavigate} /> : <>
    <div className={`idea-title font-${s.font}`} style={{ fontSize: s.fontSize, fontWeight: s.bold ? 650 : 400, fontStyle: s.italic ? 'italic' : 'normal' }}>{idea.title || 'Untitled idea'}</div>
    {!!idea.tags.length && <div className="card-tags" title={idea.tags.map(tag => `#${tag}`).join(' ')}>{idea.tags.slice(0, 3).map(tag => <span key={tag}>#{tag}</span>)}{idea.tags.length > 3 && <span>+{idea.tags.length - 3}</span>}</div>}
    <div className="idea-preview"><Markdown body={preview || 'Every idea starts somewhere.'} assets={actions.workspace.assets} onNavigate={actions.onNavigate} /></div>
    <div className="idea-footer"><FileText size={11} /><span>{idea.body.trim() ? `${idea.body.trim().split(/\s+/).length} words` : 'Empty note'}</span><span className="idea-footer-line" /><span>{idea.history.length} {idea.history.length === 1 ? 'version' : 'versions'}</span></div>
    </>}
  </div>;
}
const nodeTypes = { idea: IdeaCard };
interface Props {
  onContextMenu: (kind: 'node' | 'edge' | 'canvas', id: string | null, x: number, y: number) => void;
  onReconnect: (id: string, connection: Connection) => void;
  tagMatches: Record<string, SearchResult>; tagCutoff: number;
  editingId: string | null; editingFocus: 'title' | 'body'; onBeginEditing: (id: string, focus?: 'title' | 'body') => void;
  onFinishEditing: () => void; onActiveEditor: (value: ActiveCardEditor | null) => void;
  onEdit: (id: string, patch: Partial<Idea>) => void; onSaveVersion: (id: string) => void;
  onImage: (id: string, file: File, editor: ActiveCardEditor['editor']) => void; onNavigate: (id: string) => void;
  workspace: Workspace; selectedIds: string[]; selectedEdge: string | null; search: string; zoom: number;
  onSelectMany: (ids: string[]) => void;
  onSelect: (id: string) => void; onEdgeSelect: (id: string) => void;
  onMoveMany: (nodes: { id: string; position: { x: number; y: number } }[]) => void;
  onResize: (id: string, bounds: { x: number; y: number; width: number; height: number }) => void;
  onConnect: (connection: Connection) => void; onInit: (instance: ReactFlowInstance<IdeaNode>) => void;
  onZoom: (zoom: number) => void; onAdd: (position?: { x: number; y: number }) => void;
  onFit: () => void; onZoomIn: () => void; onZoomOut: () => void; minimap: boolean;
}
export function MapCanvas(props: Props) {
  const { workspace, selectedIds, selectedEdge, search } = props;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const initialNodes = useMemo(() => workspace.nodes.map(idea => ({ id: idea.id, type: 'idea' as const,
    position: idea.position, selected: selectedSet.has(idea.id), draggable: !idea.locked && props.editingId !== idea.id,
    ...cardSize(idea, props.editingId === idea.id),
    zIndex: props.editingId === idea.id ? 1000 : 0,
    data: { idea, editing: props.editingId === idea.id, dimmed: !!search && !`${idea.title} ${idea.body}`.toLowerCase().includes(search.toLowerCase()) },
  })), [workspace.nodes, selectedSet, search, props.editingId]);
  const [nodes, setNodes, onNodesChange] = useNodesState<IdeaNode>(initialNodes);
  const handleNodesChange = useCallback((changes: NodeChange<IdeaNode>[]) => {
    onNodesChange(changes);
    // Only native selection gestures update the parent selection. Observing
    // onSelectionChange also reports intermediate controlled-prop updates,
    // which can overwrite a newer sidebar or toolbar selection.
    if (changes.some(change => change.type === 'select')) {
      props.onSelectMany(applyNodeChanges(changes, nodes).filter(node => node.selected).map(node => node.id));
    }
  }, [nodes, onNodesChange, props.onSelectMany]);
  useEffect(() => setNodes(previous => {
    const previousNodes = new Map(previous.map(node => [node.id, node]));
    // Keep React Flow's measurements across content updates. Dropping them hides
    // the node until it is measured again, which clears a live browser caret.
    return initialNodes.map(node => {
      const old = previousNodes.get(node.id);
      return { ...node, measured: old?.measured, ...(old?.resizing ? { width: old.width, height: old.height, position: old.position, resizing: true } : {}) };
    });
  }), [initialNodes, setNodes]);
  const edges = useMemo<Edge[]>(() => workspace.edges.map(edge => {
    const source = workspace.nodes.find(n => n.id === edge.source)!;
    const target = workspace.nodes.find(n => n.id === edge.target)!;
    const dx = target.position.x - source.position.x, dy = target.position.y - source.position.y;
    const vertical = Math.abs(dy) > Math.abs(dx) * 0.8;
    return { id: edge.id, source: edge.source, target: edge.target,
      sourceHandle: edge.sourceHandle || (vertical ? (dy > 0 ? 'bottom' : 'top') : (dx > 0 ? 'right' : 'left')),
      targetHandle: edge.targetHandle || (vertical ? (dy > 0 ? 'top' : 'bottom') : (dx > 0 ? 'left' : 'right')),
      reconnectable: true,
      selected: selectedEdge === edge.id,
      type: edge.style.path === 'bezier' ? 'default' : edge.style.path === 'angular' ? 'smoothstep' : 'straight',
      pathOptions: { borderRadius: 0 },
      style: { stroke: selectedEdge === edge.id ? '#375d49' : edge.style.color, strokeWidth: edge.style.width + (selectedEdge === edge.id ? 1 : 0),
        strokeDasharray: edge.style.line === 'dashed' ? '8 6' : edge.style.line === 'dotted' ? '2 5' : undefined },
      markerStart: edge.style.startTerminator !== 'none' ? markerId(edge.id, 'start') : undefined,
      markerEnd: edge.style.endTerminator !== 'none' ? markerId(edge.id, 'end') : undefined,
      interactionWidth: 24,
    };
  }), [workspace.edges, workspace.nodes, selectedEdge]);
  return <CardContext.Provider value={props}><div className="canvas" data-testid="canvas">
    <ConnectionMarkers edges={workspace.edges} />
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={handleNodesChange}
      onNodeClick={(_, node) => props.onSelect(node.id)} onNodeDoubleClick={(event, node) => props.onBeginEditing(node.id, (event.target as HTMLElement).closest('.idea-title') ? 'title' : 'body')}
      onEdgeClick={(_, edge) => props.onEdgeSelect(edge.id)}
      onNodeContextMenu={(event, node) => { event.preventDefault(); props.onContextMenu('node', node.id, event.clientX, event.clientY); }}
      onEdgeContextMenu={(event, edge) => { event.preventDefault(); props.onContextMenu('edge', edge.id, event.clientX, event.clientY); }}
      onPaneContextMenu={event => { event.preventDefault(); props.onContextMenu('canvas', null, event.clientX, event.clientY); }}
      onReconnect={(edge, connection) => props.onReconnect(edge.id, connection)} reconnectRadius={14}
      onNodeDragStop={(_, node, moved) => props.onMoveMany(moved.length ? moved : [node])}
      onSelectionDragStop={(_, moved) => props.onMoveMany(moved)}
      onConnect={props.onConnect} connectionMode={'loose' as import('@xyflow/react').ConnectionMode}
      onInit={props.onInit} onMove={(_, viewport) => props.onZoom(viewport.zoom)}
      fitView fitViewOptions={{ padding: 0.18, maxZoom: 1 }} minZoom={0.15} maxZoom={2}
      deleteKeyCode={null} multiSelectionKeyCode={['Control', 'Meta']} selectionKeyCode="Shift" selectionMode={SelectionMode.Partial} panOnScroll selectionOnDrag={false} zoomOnDoubleClick={false}
      proOptions={{ hideAttribution: true }}>
      <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#cbd3c9" />
      {props.minimap && <MiniMap nodeColor={node => (node.data as { idea: Idea }).idea.style.background} nodeStrokeColor="#a5b4a7" nodeBorderRadius={8} maskColor="#f4f6f080" pannable zoomable />}
    </ReactFlow>
    {!workspace.nodes.length && <div className="empty-canvas"><div className="empty-illustration"><Sprout size={42} strokeWidth={1.2} /></div><h2>Give an idea somewhere to grow.</h2><p>Start with one thought. See where it takes you.</p><button className="primary" onClick={() => props.onAdd()}><Plus size={16} />Create your first idea</button></div>}
    <div className="canvas-caption"><span className="live-dot" />A LITTLE SPACE FOR BIG IDEAS</div>
    <div className="canvas-controls"><button title="Zoom out" aria-label="Zoom out" onClick={props.onZoomOut}><Minus size={16} /></button><span>{Math.round(props.zoom * 100)}%</span><button title="Zoom in" aria-label="Zoom in" onClick={props.onZoomIn}><Plus size={16} /></button><i /><button title="Fit all ideas" aria-label="Fit all ideas" onClick={props.onFit}><Maximize size={16} /></button></div>
    <div className="canvas-hint">Drag selected card corners to resize <span>·</span> Ctrl/⌘ + click to multi-select <span>·</span> Shift + drag to select an area</div>
  </div></CardContext.Provider>;
}
