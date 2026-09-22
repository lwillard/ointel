export interface NodeStyle {
  background: string; borderColor: string; borderWidth: number; borderStyle: 'solid' | 'dashed' | 'dotted';
  radius: number; shadow: boolean; textColor: string; font: 'sans' | 'serif' | 'mono';
  fontSize: number; bold: boolean; italic: boolean;
}
export interface CardTheme { id: string; name: string; style: NodeStyle }
export interface EdgeStyle {
  color: string; width: number; path: 'automatic' | 'bezier' | 'angular' | 'straight';
  line: 'solid' | 'dashed' | 'dotted'; arrow: boolean;
  startTerminator: Terminator; endTerminator: Terminator;
}
export type Terminator = 'none' | 'solid-arrow' | 'white-arrow' | 'open-arrow' | 'dot' | 'hollow-dot' | 'diamond' | 'one' | 'many';
export type TaskState = 'new' | 'in progress' | 'canceled' | 'completed';
export interface Revision { taskState?: TaskState; id: string; title: string; body: string; tags: string[]; cardType: string; savedAt: string }
export interface Idea {
  taskState?: TaskState;
  collapsed?: boolean;
  size?: { width: number; height: number };
  meetingSourceKey?: string;
  id: string; title: string; body: string; tags: string[]; cardType: string; createdAt: string; updatedAt: string;
  position: { x: number; y: number }; locked: boolean; style: NodeStyle; history: Revision[];
}
export interface Connector { id: string; source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null; style: EdgeStyle }
export interface SearchHistoryEntry { query: string; mode: 'semantic' | 'text'; includeHistory: boolean; cutoff: number; searchedAt: string }
export interface GroupStyle {
  background: string; opacity: number; borderColor: string; borderWidth: number; borderStyle: 'solid' | 'dashed' | 'dotted';
  textColor: string; padding: number; roundness: number; shadow: boolean; shadowColor: string; shadowBlur: number;
}
export interface CardGroup { id: string; name: string; nodeIds: string[]; style: GroupStyle }
export interface Workspace {
  groups: CardGroup[];
  schemaVersion: 1; id: string; title: string; updatedAt: string;
  nodes: Idea[]; edges: Connector[]; assets: Record<string, string>;
  searchHistory: SearchHistoryEntry[];
  customThemes: CardTheme[];
}
export interface VectorStatus { state: 'idle' | 'loading' | 'indexing' | 'ready' | 'error'; message: string; progress?: number; count?: number; chunks?: number }
export interface SearchResult { nodeId: string; revisionId?: string; savedAt?: string; title: string; snippet: string; score: number; exact?: boolean; distance?: number; matchedTag?: string }
export interface TagSearch { query: string; results: SearchResult[]; cutoff: number; busy: boolean; error: string }
export interface ZoomConnection { connected: boolean; clientId: string; connecting: boolean }
export interface ZoomRecording { key: string; title: string; date: string; recordingId: string; meetingUuid: string }
export interface LiveCue { speaker: string; text: string; start: number; end: number }
export interface LiveDraft { id: string; title: string; date: string; cues: LiveCue[]; names: Record<string, string>; microphone: boolean }
export interface SpeechStatus { bundled?: boolean; ready: boolean; active: boolean; preparing: boolean; stopping: boolean; progress: number; pending: number; message: string; error: string; draft: LiveDraft | null; platform: string; arch: string }
declare global {
  interface Window {
    ointel?: {
      copyNodeLink: (node: { id: string; title: string }) => Promise<void>;
      speechStatus: () => Promise<SpeechStatus>;
      speechPrepare: () => Promise<SpeechStatus>;
      speechStart: (options: { title: string; microphone: boolean }) => Promise<SpeechStatus>;
      speechAudio: (chunk: { channel: 'system' | 'mic'; samples: Float32Array; start: number }) => Promise<void>;
      speechStop: () => Promise<SpeechStatus>;
      speechEdit: (patch: { title?: string; names?: Record<string, string> }) => Promise<SpeechStatus>;
      speechDiscard: () => Promise<SpeechStatus>;
      onSpeechStatus: (callback: (status: SpeechStatus) => void) => () => void;
      zoomStatus: () => Promise<ZoomConnection>;
      zoomConnect: (clientId: string) => Promise<ZoomConnection>;
      zoomCancel: () => Promise<void>;
      zoomDisconnect: () => Promise<ZoomConnection>;
      zoomRecordings: (from: string, to: string, nextPage?: string) => Promise<{ items: ZoomRecording[]; nextPage: string; meetingCount: number }>;
      zoomTranscript: (key: string) => Promise<{ text: string; key: string; title: string; date: string; source: string }>;
      load: () => Promise<Workspace | null>;
      save: (workspace: Workspace) => Promise<void>;
      reveal: () => Promise<void>;
      openExternal: (url: string) => Promise<void>;
      search: (text: string, includeHistory: boolean) => Promise<SearchResult[]>;
      vectorStatus: () => Promise<VectorStatus>;
      retryVectors: () => Promise<void>;
      onVectorStatus: (callback: (status: VectorStatus) => void) => () => void;
      onClose: (callback: () => Promise<void>) => () => void;
    };
  }
}
