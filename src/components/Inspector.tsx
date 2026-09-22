import { useEffect, useState } from 'react';
import { FileText, Paintbrush, History, X, CalendarDays, Clock3, Pin, Pencil, Check,
  Link2, ChevronLeft, ChevronRight, RotateCcw, Plus, Trash2, Download, ArrowUpRight } from 'lucide-react';
import type { Idea, Workspace, NodeStyle, EdgeStyle, Connector } from '../types';
import { Markdown } from './Markdown';
import { NodeStyleControls, EdgeStyleControls } from './StyleControls';
import { download } from '../lib/persistence';
import { TagsEditor } from './TagsEditor';
import { TaskStateEditor } from './TaskStateEditor';
import { isTask } from '../lib/tasks';
import { CardTypeEditor } from './CardTypeEditor';
import { ConnectionEndpoints } from './ConnectionEndpoints';
const date = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const time = (value: string) => new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
interface Props {
  workspace: Workspace; idea?: Idea; edge?: Connector; onClose: () => void; onEditCard: () => void;
  onEdit: (patch: Partial<Idea>) => void; onNodeStyle: (patch: Partial<NodeStyle>) => void;
  onEdgeStyle: (patch: Partial<EdgeStyle>) => void; onLock: () => void;
  onSaveVersion: () => void; onRestore: (id: string) => void;
  onNavigate: (id: string) => void; onAddChild: () => void; onDelete: () => void;
  onReconnect: (id: string, connection: { source: string; target: string; sourceHandle: string | null; targetHandle: string | null }) => void;
}
export function Inspector(props: Props) {
  const { idea, edge, workspace } = props;
  const [tab, setTab] = useState<'note' | 'style' | 'history'>('note');
  const [revisionIndex, setRevisionIndex] = useState(0);
  useEffect(() => { setTab('note'); setRevisionIndex(Math.max(0, (idea?.history.length || 1) - 1)); }, [idea?.id]);
  if (edge) return <aside className="inspector"><div className="inspector-heading"><span><Link2 size={15} />CONNECTION DETAILS</span><button className="icon-button" title="Close details" onClick={props.onClose}><X size={17} /></button></div><div className="edge-intro"><h2>A thread between ideas</h2><p>{workspace.nodes.find(n => n.id === edge.source)?.title}<ArrowUpRight size={15} />{workspace.nodes.find(n => n.id === edge.target)?.title}</p></div><div className="inspector-scroll"><ConnectionEndpoints edge={edge} nodes={workspace.nodes} onChange={props.onReconnect} /><EdgeStyleControls edge={edge} onChange={props.onEdgeStyle} /></div><div className="inspector-bottom"><button className="danger-text" onClick={props.onDelete}><Trash2 size={14} />Remove connection</button></div></aside>;
  if (!idea) return <aside className="inspector empty-inspector"><div className="inspector-heading"><span><FileText size={15} />A CLOSER LOOK</span><button className="icon-button" title="Close details" onClick={props.onClose}><X size={17} /></button></div><div className="empty-note"><FileText size={32} strokeWidth={1.2} /><h3>There’s more to every idea.</h3><p>Select a node to open its notes, explore its history, or make it your own.</p></div></aside>;
  const changed = (idea.history.at(-1)?.taskState || 'new') !== (idea.taskState || 'new') || idea.history.at(-1)?.cardType !== idea.cardType || idea.history.at(-1)?.body !== idea.body || idea.history.at(-1)?.title !== idea.title || JSON.stringify(idea.history.at(-1)?.tags) !== JSON.stringify(idea.tags);
  const revision = idea.history[Math.min(revisionIndex, idea.history.length - 1)];
  return <aside className="inspector" key={idea.id}>
    <div className="inspector-heading"><span><FileText size={15} />IDEA DETAILS</span><div><button className={`icon-button ${idea.locked ? 'is-pinned' : ''}`} title={idea.locked ? 'Unpin node' : 'Pin node'} aria-label={idea.locked ? 'Unpin node' : 'Pin node'} onClick={props.onLock}><Pin size={15} /></button><button className="icon-button" title="Close details" onClick={props.onClose}><X size={17} /></button></div></div>
    <div className="note-intro"><span className="note-category"><i style={{ background: idea.style.textColor }} />{idea.locked ? 'PINNED IDEA' : 'ROOM TO GROW'}</span>
      <input className="note-title" aria-label="Node title" value={idea.title} maxLength={160} placeholder="Untitled idea" onChange={e => props.onEdit({ title: e.target.value })} />
      <div className="note-metadata"><CalendarDays size={12} /><span>Created {date(idea.createdAt)}</span><span className="metadata-dot">·</span><span>{idea.body.trim() ? idea.body.trim().split(/\s+/).length : 0} words</span></div>
      <TagsEditor key={idea.id} tags={idea.tags} onChange={tags => props.onEdit({ tags })} />
      <CardTypeEditor key={`type-${idea.id}`} value={idea.cardType} onChange={cardType => props.onEdit({ cardType })} />
      <TaskStateEditor idea={idea} onChange={taskState => props.onEdit({ taskState })} />
    </div>
    <div className="inspector-tabs"><button className={tab === 'note' ? 'active' : ''} onClick={() => setTab('note')}><FileText size={14} />Note</button><button className={tab === 'style' ? 'active' : ''} onClick={() => setTab('style')}><Paintbrush size={14} />Style</button><button className={tab === 'history' ? 'active' : ''} onClick={() => { setTab('history'); setRevisionIndex(idea.history.length - 1); }}><History size={14} />History<span>{idea.history.length}</span></button></div>
    <div className="inspector-scroll">
      {tab === 'note' && <><div className="note-toolbar"><span><span className="markdown-badge">M↓</span>MARKDOWN NOTE</span><button className="text-button" onClick={props.onEditCard}><Pencil size={13} />Edit on card</button></div>
        <Markdown body={idea.body} assets={workspace.assets} onNavigate={props.onNavigate} />
        <div className="note-save"><span><Clock3 size={12} />{changed ? 'Changes since last version' : `Version saved ${time(idea.history.at(-1)?.savedAt || idea.createdAt)}`}</span><button className="secondary small" disabled={!changed} onClick={props.onSaveVersion}><Check size={13} />Save version</button></div>
      </>}
      {tab === 'style' && <NodeStyleControls idea={idea} onChange={props.onNodeStyle} onLock={props.onLock} />}
      {tab === 'history' && <div className="history-panel"><div className="section-heading"><History size={15} />Ideas evolve. Nothing gets lost.</div><p className="section-description">Browse saved versions. Restoring keeps your current work in history.</p>
        {revision ? <><div className="history-nav"><button className="icon-button" aria-label="Previous version" disabled={revisionIndex === 0} onClick={() => setRevisionIndex(i => i - 1)}><ChevronLeft size={17} /></button><div><strong>Version {Math.min(revisionIndex + 1, idea.history.length)} of {idea.history.length}</strong><span>{time(revision.savedAt)}</span></div><button className="icon-button" aria-label="Next version" disabled={revisionIndex >= idea.history.length - 1} onClick={() => setRevisionIndex(i => i + 1)}><ChevronRight size={17} /></button></div>
          <select aria-label="Saved version" className="version-select" value={revision.id} onChange={e => setRevisionIndex(idea.history.findIndex(r => r.id === e.target.value))}>{idea.history.map((r, i) => <option key={r.id} value={r.id}>Version {i + 1} · {time(r.savedAt)}</option>)}</select>
          <div className="version-preview"><span className="note-category">{revision.cardType}</span><h3>{revision.title}</h3>{isTask(revision) && <p>State: {revision.taskState || 'new'}</p>}<div className="tag-chips">{revision.tags.map(tag => <span key={tag}>#{tag}</span>)}</div><Markdown body={revision.body} assets={workspace.assets} onNavigate={props.onNavigate} /></div><button className="secondary restore-button" onClick={() => props.onRestore(revision.id)} disabled={(revision.taskState || 'new') === (idea.taskState || 'new') && revision.cardType === idea.cardType && revision.body === idea.body && revision.title === idea.title && JSON.stringify(revision.tags) === JSON.stringify(idea.tags)}><RotateCcw size={14} />Restore this version</button></> : <p>No saved versions yet.</p>}
      </div>}
    </div>
    <div className="inspector-bottom"><button className="text-button" onClick={props.onAddChild}><Plus size={15} />Add connected idea</button><div><button className="icon-button" title="Export note as Markdown" aria-label="Export note as Markdown" onClick={() => download(`${idea.title.replace(/[^a-z0-9 _-]/gi, '').trim() || 'note'}.md`, `# ${idea.title}\n\n${idea.body.replace(/\]\((assets\/[^)]+)\)/g, (match, key) => workspace.assets[key] ? `](${workspace.assets[key]})` : match)}`, 'text/markdown')}><Download size={15} /></button><button className="icon-button danger-text" title="Delete idea" aria-label="Delete idea" onClick={props.onDelete}><Trash2 size={15} /></button></div></div>
  </aside>;
}
