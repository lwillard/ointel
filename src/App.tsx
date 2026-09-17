import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { type ReactFlowInstance, type Connection } from '@xyflow/react';
import { Network, Search, Plus, ArrowUpRight, ChevronDown, ChevronRight, Check, CheckCheck, Undo2, Redo2,
  Pin, SlidersHorizontal, PanelRightClose, PanelRightOpen, Download, Upload, FolderOpen, CircleHelp,
  X, Sparkles, Waypoints, GitBranch, CircleDot, Maximize, FileText, Keyboard, LockKeyhole, LoaderCircle,
  Leaf, Command, LayoutGrid, BookOpen, RotateCcw, AlertCircle } from 'lucide-react';
import type { Workspace, Idea, NodeStyle, EdgeStyle, VectorStatus, SearchResult, TagSearch, SearchHistoryEntry, CardTheme } from './types';
import { tagQuery, tagHighlight, DEFAULT_TAG_DISTANCE, MAX_TAG_DISTANCE } from '../shared/tags.mjs';
import { initialWorkspace, freshWorkspace, makeIdea, defaultEdgeStyle, uid, now, parseWorkspace, saveRevision, restoreRevision } from './lib/model';
import { loadWorkspace, persistWorkspace, download } from './lib/persistence';
import { arrange, type Layout } from './lib/layout';
import { cardSize } from './lib/cardSize';
import { MapCanvas } from './components/MapCanvas';
import { Inspector } from './components/Inspector';
import { Markdown } from './components/Markdown';
import { FormattingToolbar } from './components/FormattingToolbar';
import type { ActiveCardEditor } from './lib/richText';
import { branchNodeIds } from './lib/graph';
import { ContextMenu, type MenuItem } from './components/ContextMenu';
import { SearchHistory } from './components/SearchHistory';
import { ThemesToolbar } from './components/ThemesToolbar';
import { ThemeEditor } from './components/ThemeEditor';
import { builtInThemes, applyCardTheme } from './lib/themes';
import { SelectionInspector } from './components/SelectionInspector';
import { ZoomNotes } from './components/ZoomNotes';
import { isCapturing, stopLiveCapture } from './lib/liveCapture';
import { nodeLinkClipboard } from '../shared/node-links.mjs';
import { addMeetingNotes, type MeetingImport } from './lib/meetingNotes';

function Brand({ small = false }: { small?: boolean }) {
  return <div className={`brand ${small ? 'small-brand' : ''}`}><div className="brand-mark"><Network size={23} strokeWidth={1.6} /></div>{!small && <span>ointel<span className="brand-period">.</span></span>}</div>;
}
function Modal({ title, children, onClose, className = '' }: { title: string; children: ReactNode; onClose: () => void; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const focusable = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, textarea, [tabindex="0"]') || []);
    focusable()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab') { const items = focusable(); const first = items[0], last = items.at(-1); if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } }
    };
    const element = ref.current; element?.addEventListener('keydown', key);
    return () => { element?.removeEventListener('keydown', key); previous?.focus(); };
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className={`modal ${className}`} ref={ref} role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div>{children}</div></div>;
}
function SemanticSearch({ workspace, status, onClose, onNavigate, onRetry, tagSearch, onTagQuery, onRecordSearch, onClearHistory }: { workspace: Workspace; status: VectorStatus; onClose: () => void; onNavigate: (id: string) => void; onRetry: () => void; tagSearch: TagSearch | null; onTagQuery: (query: string | null, cutoff?: number) => void; onRecordSearch: (entry: Omit<SearchHistoryEntry, 'searchedAt'>) => void; onClearHistory: () => void }) {
  const [query, setQuery] = useState(tagSearch?.query || '');
  const [mode, setMode] = useState<'semantic' | 'text'>(window.ointel ? 'semantic' : 'text');
  const [history, setHistory] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<SearchResult | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const isTag = query.trim().startsWith('#');
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    let active = true;
    setResults([]); setError(''); setBusy(false);
    if (!query.trim() || query.trim().startsWith('#')) return;
    const timer = setTimeout(async () => {
      setBusy(true);
      onRecordSearch({ query: query.trim(), mode, includeHistory: history, cutoff: DEFAULT_TAG_DISTANCE });
      try {
        let next: SearchResult[];
        if (mode === 'semantic' && window.ointel) { await persistWorkspace(workspace); next = await window.ointel.search(query, history); }
        else {
          const q = query.toLowerCase();
          next = workspace.nodes.flatMap(node => [
            { nodeId: node.id, title: node.title, snippet: `${node.tags.map(t => `#${t}`).join(' ')} ${node.body}`, score: 1 },
            ...(history ? node.history.map(r => ({ nodeId: node.id, revisionId: r.id, title: r.title, snippet: r.body, score: 1 })) : []),
          ]).filter(n => `${n.title} ${n.snippet}`.toLowerCase().includes(q)).slice(0, 30);
        }
        if (active) setResults(next);
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Search failed.'); }
      finally { if (active) setBusy(false); }
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [query, mode, history, workspace.nodes, status.state === 'ready']);
  const shownResults = isTag ? (tagSearch?.results || []).filter(r => tagHighlight(r, tagSearch!.cutoff)) : results;
  const searching = isTag ? !!tagSearch?.busy : busy;
  const searchError = isTag ? (!tagQuery(query) ? 'Enter one #tag, using hyphens or underscores between words.' : tagSearch?.error || '') : error;
  const revision = preview ? workspace.nodes.find(n => n.id === preview.nodeId)?.history.find(r => r.id === preview.revisionId) : null;
  return <Modal title="Find a thought" onClose={onClose} className="search-modal">
    <div className="search-input-large"><Search size={21} /><input ref={input} aria-label="Search thoughts" placeholder={mode === 'semantic' ? 'Search an idea or #tag…' : 'Search titles and notes…'} value={query} maxLength={2000} onChange={e => { const value = e.target.value; setQuery(value); const tag = tagQuery(value); if (tag && window.ointel) setMode('semantic'); onTagQuery(tag ? `#${tag}` : null); }} /><kbd>esc</kbd></div>
    <div className="search-options"><div className="segmented"><button className={mode === 'semantic' ? 'active' : ''} disabled={!window.ointel} onClick={() => setMode('semantic')}><Sparkles size={13} />Vector search</button><button className={mode === 'text' ? 'active' : ''} disabled={isTag} onClick={() => setMode('text')}>Exact text</button></div><label><input type="checkbox" checked={history && !isTag} disabled={isTag} onChange={e => setHistory(e.target.checked)} />Include saved versions</label></div>
    {mode === 'semantic' && <div className={`index-status ${status.state === 'error' ? 'error' : ''}`}><span>{status.state === 'ready' ? <CheckCheck size={14} /> : status.state === 'error' ? <AlertCircle size={14} /> : <LoaderCircle size={14} className="spin" />}{status.message}{status.state === 'loading' && ` ${status.progress || 0}%`}</span>{status.state === 'error' && <button className="text-button" onClick={onRetry}>Retry</button>}</div>}
    {!window.ointel && <div className="index-status">Local vector search runs in the Electron desktop app. This browser preview supports exact text search.</div>}
    <SearchHistory entries={workspace.searchHistory} onClear={onClearHistory} onRepeat={entry => { setQuery(entry.query); setMode(entry.mode); setHistory(entry.includeHistory); onTagQuery(tagQuery(entry.query) ? entry.query : null, entry.cutoff); }} />
    {isTag && tagQuery(query) && <div className="tag-search-summary"><span>Current node tags · green = exact · yellow = related</span><button className="secondary small" onClick={onClose}>Show matches on map</button></div>}
    <div className="search-results">
      {searching && !shownResults.length ? <div className="search-empty"><LoaderCircle className="spin" size={25} /><h3>Finding connections…</h3><p>{status.state === 'ready' ? 'Searching your local vector index.' : 'The first search may take a moment while the model gets ready.'}</p></div>
      : searchError && !shownResults.length ? <div className="search-empty error"><AlertCircle size={26} /><p>{searchError}</p></div>
      : shownResults.length ? <><div className="results-label">{shownResults.length} {mode === 'semantic' ? 'RELATED THOUGHTS' : 'MATCHES'}</div>{shownResults.map(r => <button className="search-result" key={`${r.nodeId}-${r.revisionId || 'current'}`} onClick={() => { if (r.revisionId) setPreview(r); else { onNavigate(r.nodeId); onClose(); } }}><div className="result-icon">{r.revisionId ? <HistoryIcon /> : <FileText size={18} />}</div><div><strong>{r.title || 'Untitled idea'}</strong><p>{r.snippet.slice(0, 190)}</p><span>{isTag ? (r.exact ? 'Exact tag match' : 'Related tag') : r.revisionId ? 'Saved version' : 'Current note'}{isTag ? ` · Distance ${(r.distance || 0).toFixed(2)}` : mode === 'semantic' && ` · Similarity ${r.score.toFixed(2)}`}</span></div><ArrowUpRight size={16} /></button>)}</>
      : <div className="search-empty"><Sparkles size={28} strokeWidth={1.4} /><h3>{query ? 'No thoughts found yet.' : 'Search for meaning.'}</h3><p>{query ? 'Try a broader idea or switch search modes.' : 'Try “turning inspiration into action” or “a place to collect research”. Your words don’t have to match.'}</p></div>}
      {preview && revision && <div className="search-revision"><div><strong>Saved version · {preview.title}</strong><button className="icon-button" aria-label="Close version preview" onClick={() => setPreview(null)}><X size={15} /></button></div><Markdown body={revision.body} assets={workspace.assets} onNavigate={id => { onNavigate(id); onClose(); }} /><button className="secondary" onClick={() => { onNavigate(preview.nodeId); onClose(); }}>Open node<ArrowUpRight size={14} /></button></div>}
    </div>
    <div className="search-footer"><LockKeyhole size={12} />Local embeddings. Your thoughts stay yours.<span>MiniLM · 384 dimensions</span></div>
  </Modal>;
}
function HistoryIcon() { return <RotateCcw size={18} />; }

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const current = useRef<Workspace | null>(null);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState<string | null>('start');
  const [selectedIds, setSelectedIds] = useState<string[]>(['start']);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingFocus, setEditingFocus] = useState<'title' | 'body'>('body');
  const [activeEditor, setActiveEditor] = useState<ActiveCardEditor | null>(null);
  const [filter, setFilter] = useState('');
  const [zoom, setZoom] = useState(1);
  const [layout, setLayout] = useState<Layout>('radial');
  const [layoutMenu, setLayoutMenu] = useState(false);
  const [minimap, setMinimap] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState<'search' | 'guide' | 'notes' | 'new' | 'import' | 'themes' | 'zoom' | null>(null);
  const [pendingImport, setPendingImport] = useState<Workspace | null>(null);
  const [contextMenu, setContextMenu] = useState<{ kind: 'node' | 'edge' | 'canvas'; id: string | null; x: number; y: number } | null>(null);
  const closeContextMenu = useCallback(() => setContextMenu(null), []);
  const [vectors, setVectors] = useState<VectorStatus>({ state: 'idle', message: window.ointel ? 'Preparing vector index…' : 'Desktop vector search' });
  const [tagSearch, setTagSearch] = useState<TagSearch | null>(null);
  const recordSearch = useCallback((entry: Omit<SearchHistoryEntry, 'searchedAt'>) => {
    const previous = current.current; if (!previous) return;
    const matches = (item: SearchHistoryEntry) => item.query.toLowerCase() === entry.query.toLowerCase() && item.mode === entry.mode && item.includeHistory === entry.includeHistory;
    const next = { ...previous, searchHistory: [{ ...entry, searchedAt: now() }, ...previous.searchHistory.filter(item => !matches(item))].slice(0, 50), updatedAt: now() };
    current.current = next; setWorkspace(next);
  }, []);
  const clearSearchHistory = useCallback(() => { if (current.current) { const next = { ...current.current, searchHistory: [], updatedAt: now() }; current.current = next; setWorkspace(next); } }, []);
  const onTagQuery = useCallback((query: string | null, cutoff?: number) => setTagSearch(previous => query ? previous?.query === query
    ? { ...previous, cutoff: cutoff ?? previous.cutoff }
    : { query, results: [], cutoff: cutoff ?? previous?.cutoff ?? DEFAULT_TAG_DISTANCE, busy: true, error: '' } : null), []);
  const [tagRetry, setTagRetry] = useState(0);
  const latestTagSearch = useRef(tagSearch); latestTagSearch.current = tagSearch;
  const tagMatches = useMemo(() => Object.fromEntries((tagSearch?.results || []).map(result => [result.nodeId, result])), [tagSearch?.results]);
  useEffect(() => {
    const query = tagSearch?.query;
    if (!query || !workspace) return;
    let active = true;
    const tag = tagQuery(query);
    const exact: SearchResult[] = workspace.nodes.filter(node => node.tags.includes(tag!)).map(node => ({
      nodeId: node.id, title: node.title, snippet: query, score: 1, distance: 0, exact: true, matchedTag: tag!,
    }));
    const update = (patch: Partial<TagSearch>) => { if (active) setTagSearch(previous => previous?.query === query ? { ...previous, ...patch } : previous); };
    update({ results: exact, busy: !!window.ointel, error: '' });
    const timer = setTimeout(async () => {
      recordSearch({ query, mode: 'semantic', includeHistory: false, cutoff: latestTagSearch.current?.cutoff ?? DEFAULT_TAG_DISTANCE });
      if (!window.ointel) { update({ busy: false, error: 'Related tags require the desktop app. Exact tags are highlighted.' }); return; }
      try {
        await persistWorkspace(workspace);
        const results = await window.ointel.search(query, false);
        update({ results, busy: false });
      } catch (error) { update({ results: exact, busy: false, error: `Showing exact tags only. ${error instanceof Error ? error.message : 'Semantic search unavailable.'}` }); }
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [tagSearch?.query, workspace?.nodes, tagRetry]);
  const undoStack = useRef<Workspace[]>([]), redoStack = useRef<Workspace[]>([]);
  const [undoCount, setUndoCount] = useState(0), [redoCount, setRedoCount] = useState(0);
  const lastGroup = useRef('');
  const fileInput = useRef<HTMLInputElement>(null);
  const flow = useRef<ReactFlowInstance<any> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notify = useCallback((message: string) => { setToast(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 4500); }, []);
  const liveBusy = useRef(false);
  const closeModal = useCallback(() => { if (liveBusy.current || isCapturing()) { notify('Stop capture before closing live notes.'); return; } setModal(null); }, [notify]);
  useEffect(() => {
    let active = true;
    loadWorkspace().then(loaded => { if (!active) return; const value = loaded || initialWorkspace(); current.current = value; setWorkspace(value); setSelected(value.nodes[0]?.id || null); setSelectedIds(value.nodes[0] ? [value.nodes[0].id] : []); })
      .catch(e => { if (active) setLoadError(String(e.message || e)); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!window.ointel) return;
    void window.ointel.vectorStatus().then(setVectors);
    return window.ointel.onVectorStatus(setVectors);
  }, []);
  useEffect(() => {
    if (!workspace) return;
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      void persistWorkspace(workspace).then(() => { if (current.current === workspace) setSaveStatus('saved'); })
        .catch(e => { setSaveStatus('error'); notify(`Save failed: ${e.message}. Export a backup.`); });
    }, 450);
    return () => clearTimeout(timer);
  }, [workspace, notify]);
  useEffect(() => {
    if (!workspace) return;
    const live = new Set(workspace.nodes.map(node => node.id));
    setSelectedIds(previous => previous.every(id => live.has(id)) ? previous : previous.filter(id => live.has(id)));
    setSelected(previous => previous && live.has(previous) ? previous : null);
  }, [workspace?.nodes]);
  useEffect(() => {
      const flush = async () => { await stopLiveCapture(); if (current.current) await persistWorkspace(current.current); };
    const off = window.ointel?.onClose(flush);
    const beforeUnload = () => { if (!window.ointel && current.current) void persistWorkspace(current.current).catch(() => {}); };
    window.addEventListener('beforeunload', beforeUnload);
    return () => { off?.(); window.removeEventListener('beforeunload', beforeUnload); };
  }, []);
  const commit = useCallback((change: (w: Workspace) => Workspace, group: string = uid()) => {
    const previous = current.current; if (!previous) return;
    const next = change(previous); if (next === previous) return;
    if (group !== lastGroup.current) { undoStack.current = [...undoStack.current.slice(-49), previous]; setUndoCount(undoStack.current.length); }
    lastGroup.current = group; redoStack.current = []; setRedoCount(0);
    const value = { ...next, updatedAt: now() }; current.current = value; setWorkspace(value);
  }, []);
  function undo() {
    const value = undoStack.current.pop(); if (!value || !current.current) return;
    redoStack.current.push(current.current); const restored = { ...value, searchHistory: current.current.searchHistory }; current.current = restored; setWorkspace(restored); lastGroup.current = '';
    setUndoCount(undoStack.current.length); setRedoCount(redoStack.current.length); notify('Change undone.');
  }
  function redo() {
    const value = redoStack.current.pop(); if (!value || !current.current) return;
    undoStack.current.push(current.current); const restored = { ...value, searchHistory: current.current.searchHistory }; current.current = restored; setWorkspace(restored); lastGroup.current = '';
    setUndoCount(undoStack.current.length); setRedoCount(redoStack.current.length); notify('Change restored.');
  }
  const select = useCallback((id: string) => {
    setSelected(id); setSelectedIds([id]); setSelectedEdge(null); setPanelOpen(true);
    setEditingId(current => current === id ? current : null);
    setActiveEditor(current => current?.nodeId === id ? current : null);
  }, []);
  const selectMany = useCallback((ids: string[]) => {
    setSelectedIds(previous => previous.length === ids.length && previous.every(id => ids.includes(id)) ? previous : ids);
    setSelected(previous => previous && ids.includes(previous) ? previous : ids.at(-1) || null);
    if (ids.length) setSelectedEdge(null);
    setEditingId(previous => previous && ids.includes(previous) ? previous : null);
    setActiveEditor(previous => previous && ids.includes(previous.nodeId) ? previous : null);
  }, []);
  const focusCard = useCallback(() => { setSelectedEdge(null); setPanelOpen(true); }, []);
  function selectAllCards() { if (current.current) selectMany(current.current.nodes.map(node => node.id)); }
  function clearCardSelection() { selectMany([]); setSelectedEdge(null); }
  function moveCards(moved: { id: string; position: { x: number; y: number } }[]) {
    const positions = new Map(moved.map(node => [node.id, node.position]));
    commit(w => {
      if (!w.nodes.some(node => { const position = positions.get(node.id); return !node.locked && position && (position.x !== node.position.x || position.y !== node.position.y); })) return w;
      return { ...w, nodes: w.nodes.map(node => !node.locked && positions.has(node.id) ? { ...node, position: positions.get(node.id)! } : node) };
    });
  }
  function applyTheme(theme: CardTheme) {
    commit(w => applyCardTheme(w, selectedIds, theme.style));
    notify(`${theme.name} applied to ${selectedIds.length} selected ${selectedIds.length === 1 ? 'card' : 'cards'}.`);
  }
  function resizeCard(id: string, bounds: { x: number; y: number; width: number; height: number }) {
    commit(w => ({ ...w, nodes: w.nodes.map(node => node.id === id ? {
      ...node, size: { width: bounds.width, height: bounds.height },
      position: node.locked ? node.position : { x: bounds.x, y: bounds.y },
    } : node) }));
  }
  function saveTheme(theme: CardTheme, apply: boolean) {
    if (!current.current) return;
    if (current.current.customThemes.length >= 100 && !current.current.customThemes.some(t => t.id === theme.id)) return notify('The workspace already has 100 custom themes. Delete a theme before adding another.');
    commit(w => {
      const customThemes = w.customThemes.some(t => t.id === theme.id) ? w.customThemes.map(t => t.id === theme.id ? theme : t) : [...w.customThemes, theme];
      const next = { ...w, customThemes };
      return apply ? applyCardTheme(next, selectedIds, theme.style) : next;
    });
    setModal(null); notify(apply ? 'Theme saved and applied to the selected cards.' : 'Custom theme saved.');
  }
  function finishEditing() { setEditingId(null); setActiveEditor(null); }
  function importMeeting(options: Omit<MeetingImport, 'position'>) {
    if (!current.current) return;
    const right = current.current.nodes.length ? Math.max(...current.current.nodes.map(node => node.position.x)) + 400 : 100;
    const position = { x: Math.min(right, 950000), y: 100 };
    const result = addMeetingNotes(current.current, { ...options, position });
    const validated = parseWorkspace(result.workspace);
    commit(() => validated); setModal(null); select(result.rootId); setTimeout(fit, 80);
    notify('Meeting notes and speaker cards added. They are included in local vector search.');
  }
  function beginEditing(id: string, focus: 'title' | 'body' = 'body') {
    select(id); setEditingFocus(focus); setEditingId(id);
    const node = current.current?.nodes.find(n => n.id === id);
    if (node) { const size = cardSize(node, true); void flow.current?.setCenter(node.position.x + size.width / 2, node.position.y + size.height / 2, { zoom: 1, duration: 300 }); }
  }
  function editCard(id: string, patch: Partial<Idea>) {
    commit(w => ({ ...w, nodes: w.nodes.map(n => n.id === id ? { ...n, ...patch, updatedAt: now() } : n) }), `edit-${id}`);
  }
  function saveCardVersion(id: string) {
    commit(w => ({ ...w, nodes: w.nodes.map(n => n.id === id ? saveRevision(n) : n) }));
    notify('A moment in your thinking, saved.');
  }
  async function insertCardImage(id: string, file: File, editor: ActiveCardEditor['editor']) {
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) return notify('Choose a PNG, JPEG, WebP, or GIF image.');
    if (file.size > 8 * 1024 * 1024) return notify('Please choose an image smaller than 8 MB.');
    let { from, to } = editor.state.selection;
    const mapSelection = ({ transaction }: { transaction: import('@tiptap/pm/state').Transaction }) => {
      from = transaction.mapping.map(from); to = transaction.mapping.map(to);
    };
    editor.on('transaction', mapSelection);
    try {
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
      if (editor.isDestroyed || !current.current?.nodes.some(n => n.id === id)) return notify('Image insertion canceled because the card was closed.');
      const name = `assets/${uid()}.${file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]}`;
      commit(w => ({ ...w, assets: { ...w.assets, [name]: data } }), `edit-${id}`);
      await new Promise(requestAnimationFrame);
      if (editor.isDestroyed) return;
      editor.off('transaction', mapSelection);
      editor.chain().focus().setTextSelection({ from, to }).setImage({ src: name, alt: file.name || 'Screenshot' }).run();
      notify('Image added to your note.');
    } catch { notify('The image could not be read. Please try again.'); }
    finally { editor.off('transaction', mapSelection); }
  }
  const navigationRequest = useRef(0);
  const navigate = useCallback((id: string) => {
    const node = current.current?.nodes.find(n => n.id === id);
    if (!node) return notify('This linked idea no longer exists.');
    const request = ++navigationRequest.current;
    setEditingId(null); setActiveEditor(null); setFilter(''); select(id);
    // Let the editor collapse and the details panel open before centering the
    // target's measured bounds in the resized canvas.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (request !== navigationRequest.current) return;
      void flow.current?.fitView({ nodes: [{ id }], minZoom: 1, maxZoom: 1, duration: 450, padding: 0.2 }).then(() => {
        if (request === navigationRequest.current) document.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
      });
    }));
  }, [notify, select]);
  function editNode(patch: Partial<Idea>, group?: string) {
    if (!selected) return;
    commit(w => ({ ...w, nodes: w.nodes.map(n => n.id === selected ? { ...n, ...patch, updatedAt: now() } : n) }), group);
  }
  function styleNode(patch: Partial<NodeStyle>) {
    const ids = new Set(selectedIds);
    commit(w => ({ ...w, nodes: w.nodes.map(n => ids.has(n.id) ? { ...n, style: { ...n.style, ...patch } } : n) }), `style-${selectedIds.slice().sort().join(',')}`);
  }
  function styleEdge(patch: Partial<EdgeStyle>) {
    commit(w => ({ ...w, edges: w.edges.map(e => e.id === selectedEdge ? { ...e, style: { ...e.style, ...patch } } : e) }), `edge-style-${selectedEdge}`);
  }
  function addIdea(parentId?: string, position?: { x: number; y: number }) {
    if (!current.current) return;
    const parent = current.current.nodes.find(n => n.id === parentId);
    const node = makeIdea('Untitled idea', position || (parent ? { x: parent.position.x + cardSize(parent).width + 100, y: parent.position.y + 170 } : flow.current?.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }) || { x: 350, y: 250 }));
    commit(w => ({ ...w, nodes: [...w.nodes, node], edges: parent ? [...w.edges, { id: uid(), source: parent.id, target: node.id, style: { ...defaultEdgeStyle } }] : w.edges }));
    select(node.id); requestAnimationFrame(() => navigate(node.id));
    notify(parent ? 'A new connection, a new possibility.' : 'A fresh space for a thought.');
  }
  function connect(connection: Connection) {
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    if (current.current?.edges.some(e => (e.source === connection.source && e.target === connection.target) || (e.target === connection.source && e.source === connection.target))) return notify('These ideas are already connected.');
    commit(w => ({ ...w, edges: [...w.edges, { id: uid(), source: connection.source, target: connection.target, sourceHandle: connection.sourceHandle, targetHandle: connection.targetHandle, style: { ...defaultEdgeStyle } }] }));
    notify('Connection made. Click the line to style it.');
  }
  function deleteSelection() {
    finishEditing();
    if (selectedEdge) { commit(w => ({ ...w, edges: w.edges.filter(e => e.id !== selectedEdge) })); setSelectedEdge(null); notify('Connection removed. Undo to bring it back.'); }
    else if (selectedIds.length) { const ids = new Set(selectedIds); commit(w => ({ ...w, nodes: w.nodes.filter(n => !ids.has(n.id)), edges: w.edges.filter(e => !ids.has(e.source) && !ids.has(e.target)) })); setSelected(null); setSelectedIds([]); notify(`${ids.size} cards removed. Undo to bring them back.`); }
  }
  function reconnect(id: string, connection: Connection) {
    const workspace = current.current;
    if (!workspace || !connection.source || !connection.target || connection.source === connection.target) return;
    if (![connection.source, connection.target].every(id => workspace.nodes.some(node => node.id === id))) return;
    if (workspace.edges.some(edge => edge.id !== id && ((edge.source === connection.source && edge.target === connection.target) || (edge.target === connection.source && edge.source === connection.target)))) return notify('These nodes are already connected.');
    commit(w => ({ ...w, edges: w.edges.map(edge => edge.id === id ? { ...edge, ...connection } : edge) }));
    notify('Connection moved.');
  }
  function deleteNodes(id: string, branch = false) {
    if (!current.current) return;
    const ids = branch ? branchNodeIds(current.current, id) : new Set([id]);
    finishEditing();
    commit(w => ({ ...w, nodes: w.nodes.filter(node => !ids.has(node.id)), edges: w.edges.filter(edge => !ids.has(edge.source) && !ids.has(edge.target)) }));
    if (selected && ids.has(selected)) setSelected(null);
    setSelectedEdge(null);
    notify(`${ids.size} ${ids.size === 1 ? 'node' : 'nodes'} deleted. Undo restores the nodes and connections.`);
  }
  function menuItems(): MenuItem[] {
    if (!contextMenu || !workspace) return [];
    const { id, kind, x, y } = contextMenu;
    const node = workspace.nodes.find(node => node.id === id);
    const edge = workspace.edges.find(edge => edge.id === id);
    if (kind === 'node' && node && selectedIds.length > 1 && selectedIds.includes(node.id)) return [
      { label: `Theme ${selectedIds.length} selected cards…`, action: () => setModal('themes') },
      { label: 'Pin selected cards', action: () => commit(w => ({ ...w, nodes: w.nodes.map(n => selectedIds.includes(n.id) ? { ...n, locked: true } : n) })) },
      { label: 'Unpin selected cards', action: () => commit(w => ({ ...w, nodes: w.nodes.map(n => selectedIds.includes(n.id) ? { ...n, locked: false } : n) })) },
      { label: `Delete selected cards (${selectedIds.length})`, danger: true, action: deleteSelection },
      { label: 'Edit this card', action: () => beginEditing(node.id) },
    ];
    if (kind === 'node' && node) return [
      { label: 'Copy node link', action: () => { void copyNodeLink(node); } },
      { label: 'Edit card', action: () => beginEditing(node.id) },
      { label: 'Add child node', action: () => addIdea(node.id) },
      { label: 'Duplicate node', action: () => {
        const copy = { ...makeIdea(`${node.title} (copy)`.slice(0, 160), { x: node.position.x + 50, y: node.position.y + cardSize(node).height + 30 }, node.body), cardType: node.cardType, tags: [...node.tags], style: { ...node.style }, ...(node.size ? { size: { ...node.size } } : {}) };
        copy.history = [{ id: uid(), title: copy.title, body: copy.body, tags: [...copy.tags], cardType: copy.cardType, savedAt: now() }];
        commit(w => ({ ...w, nodes: [...w.nodes, copy] })); select(copy.id);
      } },
      { label: node.locked ? 'Unpin position' : 'Pin position', action: () => commit(w => ({ ...w, nodes: w.nodes.map(n => n.id === node.id ? { ...n, locked: !n.locked } : n) })) },
      { label: 'Delete node', danger: true, action: () => deleteNodes(node.id) },
      { label: `Delete branch (${branchNodeIds(workspace, node.id).size} nodes)`, danger: true, action: () => deleteNodes(node.id, true) },
    ];
    if (kind === 'edge' && edge) return [
      { label: 'Edit connection', action: () => { finishEditing(); setSelectedIds([]); setSelected(null); setSelectedEdge(edge.id); setPanelOpen(true); } },
      { label: 'Reverse connection', action: () => reconnect(edge.id, { source: edge.target, target: edge.source, sourceHandle: edge.targetHandle || null, targetHandle: edge.sourceHandle || null }) },
      { label: 'Delete connection', danger: true, action: () => { commit(w => ({ ...w, edges: w.edges.filter(e => e.id !== edge.id) })); setSelectedEdge(null); notify('Connection deleted. Undo restores it.'); } },
    ];
    return [{ label: 'Add node here', action: () => addIdea(undefined, flow.current?.screenToFlowPosition({ x, y })) }, { label: 'Fit all nodes', action: fit }];
  }
  function fit() { void flow.current?.fitView({ padding: 0.2, duration: 500, maxZoom: 1.1 }); }
  function autoArrange(algorithm = layout) {
    finishEditing();
    setLayout(algorithm); setLayoutMenu(false);
    commit(w => ({ ...w, nodes: arrange(w.nodes, w.edges, algorithm) })); setTimeout(fit, 70);
    notify(`Map arranged. ${current.current?.nodes.filter(n => n.locked).length || 0} pinned ideas kept in place.`);
  }
  function exportMap() { if (current.current) { download(`${current.current.title.replace(/[^a-z0-9 _-]/gi, '') || 'mind-map'}.ointel.json`, JSON.stringify(current.current, null, 2)); notify('Map exported with notes, images, and history.'); } }
  async function importFile(file: File) {
    try { if (file.size > 100 * 1024 * 1024) throw new Error('The file is larger than 100 MB.'); const data = parseWorkspace(JSON.parse(await file.text())); setPendingImport(data); setModal('import'); }
    catch (e) { notify(`Could not import: ${e instanceof Error ? e.message.slice(0, 180) : 'Invalid map file.'}`); }
  }
  function replaceWorkspace(next: Workspace) {
    setTagSearch(null);
    finishEditing();
    commit(() => next); setSelected(next.nodes[0]?.id || null); setSelectedIds(next.nodes[0] ? [next.nodes[0].id] : []); setSelectedEdge(null); setModal(null); setPendingImport(null); setFilter(''); setTimeout(fit, 80);
  }
  async function copyNodeLink(node: Idea) {
    try {
      if (window.ointel) await window.ointel.copyNodeLink({ id: node.id, title: node.title });
      else {
        const data = nodeLinkClipboard(node);
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([data.text], { type: 'text/plain' }), 'text/html': new Blob([data.html], { type: 'text/html' }) })]);
      }
      notify('Node link copied. Paste it into another card’s note.');
    } catch { notify('Could not write to the clipboard. Select the card and press Ctrl/Cmd+C to copy its link.'); }
  }
  const copySelection = useRef({ selectedIds, selectedEdge, modal }); copySelection.current = { selectedIds, selectedEdge, modal };
  useEffect(() => {
    // Handle the native copy event so both keyboard shortcuts and macOS Edit > Copy work.
    const onCopy = (event: ClipboardEvent) => {
      const { selectedIds: ids, selectedEdge: edge, modal: dialog } = copySelection.current;
      if (event.defaultPrevented || dialog || edge || ids.length !== 1 || !event.clipboardData) return;
      if ((event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable], [role="dialog"]')) || !window.getSelection()?.isCollapsed) return;
      const node = current.current?.nodes.find(node => node.id === ids[0]);
      if (!node) return;
      const data = nodeLinkClipboard(node);
      event.clipboardData.setData('text/plain', data.text);
      event.clipboardData.setData('text/html', data.html);
      event.preventDefault();
      notify('Node link copied. Paste it into another card’s note.');
    };
    document.addEventListener('copy', onCopy);
    return () => document.removeEventListener('copy', onCopy);
  }, [notify]);
  const keyboardActions = useRef({ addIdea, undo, redo, exportMap, deleteSelection, selectAllCards }); keyboardActions.current = { addIdea, undo, redo, exportMap, deleteSelection, selectAllCards };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest('input, textarea, [contenteditable="true"]');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setModal('search'); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (current.current) void persistWorkspace(current.current).then(() => notify('Workspace saved.')).catch(() => notify('Save failed. Export a backup.')); }
      if (typing || (e.target as HTMLElement)?.closest('[role="dialog"]')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) keyboardActions.current.redo(); else keyboardActions.current.undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); keyboardActions.current.selectAllCards(); }
      if (e.key === 'Delete') { e.preventDefault(); keyboardActions.current.deleteSelection(); }
      if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'n') keyboardActions.current.addIdea();
    };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [notify]);
  if (loadError) return <div className="loading-screen"><Brand /><h2>Your workspace needs attention.</h2><p>{loadError}</p><button className="secondary" onClick={() => void window.ointel?.reveal()}><FolderOpen size={16} />Open data folder</button><button className="text-button" onClick={() => location.reload()}>Try again</button></div>;
  if (!workspace) return <div className="loading-screen"><Brand /><LoaderCircle size={24} className="spin" /><p>Making room for your thoughts…</p></div>;
  const idea = workspace.nodes.find(n => n.id === selected);
  const selectedCards = workspace.nodes.filter(node => selectedIds.includes(node.id));
  const selectionLocked = selectedCards.length > 0 && selectedCards.every(card => card.locked);
  const themes = [...builtInThemes, ...workspace.customThemes];
  const edge = workspace.edges.find(e => e.id === selectedEdge);
  const filtered = workspace.nodes.filter(n => `${n.title} ${n.body}`.toLowerCase().includes(filter.toLowerCase()));
  const pinned = workspace.nodes.filter(n => n.locked).length;
  return <div className={`app ${panelOpen ? '' : 'panel-hidden'}`}>
    <aside className="sidebar"><div className="sidebar-brand"><Brand /><span className="desktop-label">{window.ointel ? 'DESKTOP' : 'PREVIEW'}</span></div>
      <button className="search-launch" onClick={() => setModal('search')}><Search size={16} /><span>Search your thoughts</span><kbd>⌃ K</kbd></button>
      <div className="sidebar-label">YOUR WORKSPACE<button className="icon-button" title="New mind map" aria-label="New mind map" onClick={() => setModal('new')}><Plus size={14} /></button></div>
      <nav><button className="nav-item active" onClick={() => { setModal(null); fit(); }}><Waypoints size={17} /><span>Mind map</span><span className="nav-dot" /></button><button className="nav-item" onClick={() => setModal('notes')}><BookOpen size={17} /><span>All notes</span><span className="nav-count">{workspace.nodes.length}</span></button><button className="nav-item" onClick={() => { finishEditing(); setModal('zoom'); }}><FileText size={17} /><span>Zoom notes</span></button></nav>
      <div className="sidebar-divider" />
      <div className="sidebar-label">IDEAS IN THIS MAP<span className="pill-count">{workspace.nodes.length}</span></div>
      <div className="filter-input"><Search size={13} /><input aria-label="Filter ideas" placeholder="Filter ideas…" value={filter} onChange={e => setFilter(e.target.value)} />{filter && <button className="icon-button" aria-label="Clear filter" onClick={() => setFilter('')}><X size={12} /></button>}</div>
      <div className="idea-list">{filtered.map(n => <button key={n.id} className={`idea-list-item ${selectedIds.includes(n.id) && !selectedEdge ? 'active' : ''}`} onClick={() => navigate(n.id)}><span className="list-dot" style={{ background: n.style.textColor }} /><span>{n.title || 'Untitled idea'}</span>{n.locked ? <Pin size={12} /> : <ChevronRight size={12} />}</button>)}{!filtered.length && <p className="no-ideas">{filter ? 'No ideas match this filter.' : 'Your next idea starts here.'}</p>}<button className="sidebar-add" onClick={() => addIdea()}><Plus size={14} />Add an idea</button></div>
      <div className="sidebar-bottom"><button className="vector-card" onClick={() => setModal('search')}><div><Sparkles size={16} /><strong>Find the connection</strong><ArrowUpRight size={14} /></div><p>Search by meaning, not just words.</p><span><i className={vectors.state === 'ready' ? 'ready' : ''} />{vectors.state === 'ready' ? `${vectors.count} ideas vectorized` : vectors.state === 'loading' ? 'Preparing local model…' : vectors.state === 'indexing' ? 'Indexing your thoughts…' : vectors.state === 'error' ? 'Search needs attention' : 'Local semantic search'}</span></button>
        <button className="nav-item quiet" onClick={() => setModal('guide')}><CircleHelp size={17} /><span>A little guidance</span><Keyboard size={14} /></button>
        <div className="local-workspace"><div className="avatar"><Leaf size={17} /></div><div><strong>Personal workspace</strong><span><i />Stored on this device</span></div><button className="icon-button" title="Open workspace folder" aria-label="Open workspace folder" onClick={() => window.ointel ? void window.ointel.reveal() : notify('The desktop app stores Markdown files in your workspace folder. Browser preview uses local storage.')}><FolderOpen size={15} /></button></div>
      </div>
    </aside>
    <main className="main"><header className="topbar"><div><div className="breadcrumb">Personal workspace<ChevronRight size={12} /><span>Mind map</span></div><input className="map-title" aria-label="Map title" value={workspace.title} maxLength={160} onChange={e => { const title = e.target.value; if (title) commit(w => ({ ...w, title }), 'map-title'); }} /></div><div className="topbar-actions"><span className={`save-indicator ${saveStatus}`} title={saveStatus === 'saved' ? 'All changes saved locally' : undefined}>{saveStatus === 'saved' ? <CheckCheck size={14} /> : saveStatus === 'saving' ? <LoaderCircle size={14} className="spin" /> : <AlertCircle size={14} />}{saveStatus === 'saved' ? 'All changes saved' : saveStatus === 'saving' ? 'Saving…' : 'Save failed'}</span><button className="icon-button import-button" title="Import map" aria-label="Import map" onClick={() => fileInput.current?.click()}><Upload size={17} /></button><button className="secondary export-button" onClick={exportMap}><Download size={15} />Export</button><span className="profile-avatar">O</span></div></header>
      <div className="map-toolbar"><div className="toolbar-left"><div className="view-label"><Waypoints size={17} /><span>Canvas</span></div><span className="toolbar-divider" /><div className="arrange-control"><button className="toolbar-button" onClick={() => autoArrange()}><GitBranch size={15} />Auto-arrange</button><button className="arrange-chevron" aria-label="Choose arrangement" title="Choose arrangement" onClick={() => setLayoutMenu(!layoutMenu)}><ChevronDown size={13} /></button>{layoutMenu && <><div className="popover-dismiss" onClick={() => setLayoutMenu(false)} /><div className="layout-menu"><span>MAKE ROOM FOR CONNECTIONS</span>{([{ key: 'hierarchy', title: 'Hierarchy', detail: 'A clear, left-to-right flow', icon: GitBranch }, { key: 'radial', title: 'Radial', detail: 'Ideas around a central thought', icon: CircleDot }, { key: 'force', title: 'Force-directed', detail: 'Let connections find their balance', icon: Waypoints }] as const).map(item => <button key={item.key} onClick={() => autoArrange(item.key)}><item.icon size={18} /><div><strong>{item.title}</strong><small>{item.detail}</small></div>{layout === item.key && <Check size={15} />}</button>)}<p><Pin size={12} />Pinned ideas stay in place.</p></div></>}</div>
        <button className={`toolbar-button pin-toolbar ${selectionLocked ? 'active' : ''}`} disabled={!selectedCards.length} onClick={() => commit(w => ({ ...w, nodes: w.nodes.map(node => selectedIds.includes(node.id) ? { ...node, locked: !selectionLocked } : node) }))}><Pin size={14} /><span>{selectedCards.length > 1 ? (selectionLocked ? 'Unpin selected' : 'Pin selected') : (selectionLocked ? 'Unpin' : 'Pin position')}</span></button></div>
        <div className="toolbar-right"><button className="icon-button" title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!undoCount} onClick={undo}><Undo2 size={16} /></button><button className="icon-button" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" disabled={!redoCount} onClick={redo}><Redo2 size={16} /></button><span className="toolbar-divider" /><button className={`icon-button minimap-button ${minimap ? 'active' : ''}`} title="Toggle minimap" aria-label="Toggle minimap" onClick={() => setMinimap(!minimap)}><LayoutGrid size={16} /></button><button className="icon-button" title="Toggle details" aria-label="Toggle details" onClick={() => { setPanelOpen(!panelOpen); setTimeout(fit, 100); }}>{panelOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}</button><button className="primary add-node" onClick={() => addIdea()}><Plus size={16} /><span>Add idea</span></button></div>
      </div>
        <ThemesToolbar themes={themes} selected={selectedCards} total={workspace.nodes.length} onApply={applyTheme} onEdit={() => setModal('themes')} onSelectAll={selectAllCards} onClear={clearCardSelection} />
        <FormattingToolbar active={activeEditor} nodes={workspace.nodes} onImage={insertCardImage} />
        {tagSearch && <div className="tag-map-legend" role="region" aria-label="Tag search highlights">
          <strong>{tagSearch.query}</strong><span className="exact-key">Glowing green: exact</span><span className="related-key">Related: closer <i /> farther</span>
          <label>Maximum distance <input aria-label="Tag distance cutoff" type="range" min="0" max={MAX_TAG_DISTANCE} step="0.01" value={tagSearch.cutoff} onChange={e => { const cutoff = Number(e.target.value); setTagSearch(previous => previous ? { ...previous, cutoff } : null); recordSearch({ query: tagSearch.query, mode: 'semantic', includeHistory: false, cutoff }); }} /><output>{tagSearch.cutoff.toFixed(2)}</output></label>
          <span className="tag-match-count">{tagSearch.results.filter(r => tagHighlight(r, tagSearch.cutoff)).length} matches{tagSearch.busy ? ' · finding related tags…' : ''}</span>
          {tagSearch.error && <span role="status" className="tag-search-error">{tagSearch.error}</span>}
          <button className="icon-button" aria-label="Clear tag highlights" onClick={() => setTagSearch(null)}><X size={16} /></button>
        </div>}
      <div className="workspace-body"><MapCanvas onReconnect={reconnect} onContextMenu={(kind, id, x, y) => { setContextMenu({ kind, id, x, y }); }} tagMatches={tagMatches} tagCutoff={tagSearch?.cutoff ?? DEFAULT_TAG_DISTANCE} workspace={workspace} selectedIds={selectedIds} onSelectMany={selectMany} selectedEdge={selectedEdge} search={filter} zoom={zoom}
        editingId={editingId} editingFocus={editingFocus} onBeginEditing={beginEditing} onFinishEditing={finishEditing}
        onActiveEditor={setActiveEditor} onEdit={editCard} onSaveVersion={saveCardVersion} onImage={insertCardImage} onNavigate={navigate}
        onSelect={focusCard} onEdgeSelect={id => { finishEditing(); setSelectedIds([]); setSelected(null); setSelectedEdge(id); setPanelOpen(true); }}
        onMoveMany={moveCards} onResize={resizeCard}
        onConnect={connect} onInit={instance => { flow.current = instance; }} onZoom={setZoom}
        onAdd={position => addIdea(undefined, position)} onFit={fit} onZoomIn={() => void flow.current?.zoomIn({ duration: 200 })} onZoomOut={() => void flow.current?.zoomOut({ duration: 200 })} minimap={minimap} />
        {panelOpen && selectedCards.length > 1 && !selectedEdge && <SelectionInspector cards={selectedCards} onChange={styleNode} onEditTheme={() => setModal('themes')} onDelete={deleteSelection} onClose={() => setPanelOpen(false)} />}
        {panelOpen && (selectedCards.length <= 1 || selectedEdge) && <Inspector onReconnect={reconnect} workspace={workspace} idea={selectedEdge ? undefined : idea} edge={edge} onClose={() => setPanelOpen(false)}
          onEditCard={() => selected && beginEditing(selected)}
          onEdit={patch => editNode(patch, `edit-${selected}`)} onNodeStyle={styleNode} onEdgeStyle={styleEdge} onLock={() => idea && editNode({ locked: !idea.locked })}
          onSaveVersion={() => { commit(w => ({ ...w, nodes: w.nodes.map(n => n.id === selected ? saveRevision(n) : n) })); notify('A moment in your thinking, saved.'); }}
          onRestore={revisionId => { commit(w => ({ ...w, nodes: w.nodes.map(n => n.id === selected ? restoreRevision(n, revisionId) : n) })); notify('Version restored. Your previous work is kept in history.'); }}
          onNavigate={navigate} onAddChild={() => addIdea(selected || undefined)} onDelete={deleteSelection} />}
      </div>
      <footer className="statusbar"><div><span><span className="status-dot" />{workspace.nodes.length} ideas</span><span><GitBranch size={12} />{workspace.edges.length} connections</span>{pinned > 0 && <span><Pin size={11} />{pinned} pinned</span>}</div><div><LockKeyhole size={11} /><span>Local & private</span><span className="statusbar-separator">·</span><span>Made for a wandering mind</span><Leaf size={12} /></div></footer>
    </main>
    {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} items={menuItems()} onClose={closeContextMenu} />}
    {modal === 'zoom' && <Modal title="Zoom meeting notes" onClose={closeModal} className="zoom-modal"><ZoomNotes workspace={workspace} parentId={selectedIds.length === 1 ? selectedIds[0] : null} onImport={importMeeting} onBusyChange={busy => { liveBusy.current = busy; }} /></Modal>}
    {modal === 'themes' && <Modal title="Theme editor" onClose={closeModal} className="theme-editor-modal"><ThemeEditor themes={themes} selected={selectedCards} onSave={saveTheme} onDelete={id => { commit(w => ({ ...w, customThemes: w.customThemes.filter(theme => theme.id !== id) })); setModal(null); notify('Custom theme deleted. Applied card styles are kept.'); }} onClose={closeModal} /></Modal>}
    <input hidden ref={fileInput} type="file" accept=".json" onChange={e => { const file = e.target.files?.[0]; if (file) void importFile(file); e.target.value = ''; }} />
    {toast && <div role="status" className="toast"><Check size={16} /><span>{toast}</span><button className="icon-button" aria-label="Dismiss message" onClick={() => setToast('')}><X size={14} /></button></div>}
    {modal === 'search' && <SemanticSearch onRecordSearch={recordSearch} onClearHistory={clearSearchHistory} tagSearch={tagSearch} onTagQuery={onTagQuery} workspace={workspace} status={vectors} onClose={closeModal} onNavigate={navigate} onRetry={() => { void window.ointel?.retryVectors(); setTagRetry(value => value + 1); }} />}
    {modal === 'guide' && <Modal title="A little guidance" onClose={closeModal}><div className="guide-intro"><div className="guide-icon"><Leaf size={28} /></div><h3>Think freely. Connect naturally.</h3><p>Ointel gives your thoughts room to grow.</p></div><div className="guide-grid"><div><Plus /><h4>Capture a thought</h4><p>Double-click a card to edit its title and note in place. Use the top toolbar to format selected text or set the style at the caret. Paste a screenshot right where your cursor is.</p></div><div><Waypoints /><h4>Make a connection</h4><p>Drag between the dots on two cards. Click a connector to customize its path, color, line style, and arrowhead.</p></div><div><Pin /><h4>Find your arrangement</h4><p>Drag cards freely or choose an automatic layout. Pin a card to preserve its position.</p></div><div><Sparkles /><h4>Find by meaning</h4><p>Vector search runs locally in the desktop app. Offline installers include the search model. Titles, notes, and revisions are indexed on your device.</p></div></div><div className="keyboard-guide"><span><kbd>N</kbd>Add idea</span><span><kbd>Ctrl K</kbd>Search</span><span><kbd>Ctrl Z</kbd>Undo</span><span><kbd>Ctrl S</kbd>Save</span></div></Modal>}
    {modal === 'notes' && <Modal title="All your notes" onClose={closeModal}><p className="modal-description">{workspace.nodes.length} little windows into your thinking.</p><div className="all-notes">{workspace.nodes.map(n => <button key={n.id} onClick={() => { navigate(n.id); closeModal(); }}><div className="note-tile-icon" style={{ background: n.style.background, color: n.style.textColor }}><FileText size={21} /></div><div><strong>{n.title || 'Untitled idea'}</strong><p>{n.body.replace(/[#*`]/g, '').slice(0, 95) || 'An unwritten possibility.'}</p><span>{n.history.length} saved {n.history.length === 1 ? 'version' : 'versions'}</span></div><ArrowUpRight size={16} /></button>)}</div></Modal>}
    {(modal === 'new' || modal === 'import') && <Modal title={modal === 'new' ? 'A fresh canvas' : 'Open this mind map?'} onClose={closeModal}><p className="modal-description">{modal === 'new' ? 'Start a new map in this workspace.' : `“${pendingImport?.title}” has ${pendingImport?.nodes.length} ideas.`} Your current map will be replaced. Export it first if you want to keep a separate copy. You can also undo this change.</p><div className="modal-actions"><button className="secondary" onClick={exportMap}><Download size={15} />Export current map</button><button className="primary" onClick={() => replaceWorkspace(modal === 'new' ? freshWorkspace() : pendingImport!)}>{modal === 'new' ? 'Start fresh' : 'Open map'}<ArrowUpRight size={15} /></button></div></Modal>}
  </div>;
}
