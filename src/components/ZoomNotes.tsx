import { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Video, RefreshCw, Users, FileText, LoaderCircle } from 'lucide-react';
import type { Workspace, ZoomConnection, ZoomRecording } from '../types';
import { parseTranscript, speakerGroups, timestamp, type MeetingTranscript, type MeetingImport } from '../lib/meetingNotes';
import { LiveMeeting } from './LiveMeeting';

const day = (offset = 0) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
export function ZoomNotes({ workspace, parentId, onImport, onBusyChange }: { workspace: Workspace; parentId: string | null; onImport: (options: Omit<MeetingImport, 'position'>) => void; onBusyChange: (busy: boolean) => void }) {
  const [tab, setTab] = useState<'live' | 'file' | 'cloud'>('live');
  const [liveBusy, setLiveBusy] = useState(false);
  const liveBusyChange = (value: boolean) => { setLiveBusy(value); onBusyChange(value); };
  const [connection, setConnection] = useState<ZoomConnection>({ connected: false, connecting: false, clientId: '' });
  const [clientId, setClientId] = useState('');
  const [from, setFrom] = useState(day(-29)), [to, setTo] = useState(day());
  const [recordings, setRecordings] = useState<ZoomRecording[]>([]), [nextPage, setNextPage] = useState('');
  const [listed, setListed] = useState(false);
  const [busy, setBusy] = useState(''), [error, setError] = useState('');
  const [raw, setRaw] = useState('');
  const [transcript, setTranscript] = useState<MeetingTranscript | null>(null);
  const [title, setTitle] = useState('Zoom meeting'), [date, setDate] = useState('');
  const [source, setSource] = useState('Zoom transcript'), [sourceKey, setSourceKey] = useState('');
  const [names, setNames] = useState<Record<string, string>>({});
  const [speakerCards, setSpeakerCards] = useState(true), [attach, setAttach] = useState(false);
  const file = useRef<HTMLInputElement>(null), active = useRef(true);
  useEffect(() => {
    active.current = true;
    if (window.ointel) void window.ointel.zoomStatus().then(value => { if (active.current) { setConnection(value); setClientId(value.clientId); } }).catch(e => { if (active.current) setError(e.message); });
    return () => { active.current = false; void window.ointel?.zoomCancel(); };
  }, []);
  const groups = useMemo(() => speakerGroups(transcript?.cues || []), [transcript]);
  const alreadyImported = !!sourceKey && workspace.nodes.some(node => node.meetingSourceKey === sourceKey);
  async function task(name: string, work: () => Promise<void>) {
    setBusy(name); setError('');
    try { await work(); } catch (error) { if (active.current) setError(error instanceof Error ? error.message : 'Could not load the meeting.'); }
    finally { if (active.current) setBusy(''); }
  }
  async function preview(text: string, metadata: { title: string; date: string; source: string; key?: string }) {
    const parsed = parseTranscript(text);
    const hash = metadata.key || `file:${Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text.replace(/\r\n?/g, '\n').trim()))), n => n.toString(16).padStart(2, '0')).join('')}`;
    if (!active.current) return;
    setRaw(text); setTranscript(parsed); setTitle(metadata.title); setDate(metadata.date.slice(0, 10)); setSource(metadata.source); setSourceKey(hash); setNames(Object.fromEntries([...speakerGroups(parsed.cues).keys()].map(name => [name, name])));
  }
  async function list(more = false) {
    if (!window.ointel) return;
    await task('Loading recordings', async () => {
      const result = await window.ointel!.zoomRecordings(from, to, more ? nextPage : '');
      if (!active.current) return;
      setRecordings(previous => [...new Map([...(more ? previous : []), ...result.items].map(item => [item.key, item])).values()]);
      setNextPage(result.nextPage); setListed(true);
    });
  }
  function add() {
    if (!transcript) return;
    try {
      onImport({ title, date, source, sourceKey, cues: transcript.cues.map(cue => ({ ...cue, speaker: names[cue.speaker]?.trim() || cue.speaker })), speakerCards, parentId: attach ? parentId || undefined : undefined });
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not add meeting notes.'); }
  }
  return <div className="zoom-notes">
    <div className="zoom-tabs segmented"><button disabled={liveBusy} className={tab === 'live' ? 'active' : ''} onClick={() => setTab('live')}>Live audio</button><button disabled={liveBusy} className={tab === 'file' ? 'active' : ''} onClick={() => setTab('file')}><Upload size={14} />Transcript file</button><button disabled={liveBusy} className={tab === 'cloud' ? 'active' : ''} onClick={() => setTab('cloud')}><Video size={14} />Zoom cloud</button></div>
    {tab === 'live' ? <LiveMeeting workspace={workspace} parentId={parentId} onImport={onImport} onBusyChange={liveBusyChange} /> : tab === 'file' ? <div className="zoom-source">
      <div className="zoom-file-row"><button className="secondary" disabled={!!busy} onClick={() => file.current?.click()}><Upload size={15} />Choose transcript</button><span>VTT, SRT, or TXT · up to 4 MB</span></div>
      <input ref={file} type="file" hidden accept=".vtt,.srt,.txt" aria-label="Zoom transcript file" onChange={e => { const selected = e.target.files?.[0]; e.target.value = ''; if (selected) void task('Reading transcript', async () => { if (selected.size > 4_000_000) throw new Error('Choose a transcript smaller than 4 MB.'); await preview(await selected.text(), { title: selected.name.replace(/\.(vtt|srt|txt)$/i, ''), date: '', source: selected.name }); }); }} />
      <label>Or paste a transcript<textarea aria-label="Paste Zoom transcript" value={raw} maxLength={4_000_000} placeholder={'WEBVTT\n\n00:00:01.000 --> 00:00:06.000\nAlice: Let’s discuss the next steps.'} onChange={e => { setRaw(e.target.value); setTranscript(null); setSourceKey(''); }} /></label>
      <button className="secondary small" disabled={!raw.trim() || !!busy} onClick={() => void task('Parsing transcript', () => preview(raw, { title: 'Zoom meeting', date: '', source: 'Pasted Zoom transcript' }))}>Preview pasted transcript</button>
      <p className="section-description">Download the audio transcript from Zoom’s Recordings &amp; Transcripts page, or save the live transcript as text. Speaker labels must be present in the file; this does not identify voices from audio.</p>
    </div> : <div className="zoom-source">
      {!window.ointel ? <p>Zoom sign-in is available in the desktop app. You can import transcript files in this preview.</p> : <>
        <div className="zoom-connection"><strong>{connection.connected ? 'Zoom connected' : 'Connect Zoom cloud recordings'}</strong>{connection.connected && <button className="text-button" disabled={!!busy} onClick={() => void task('Disconnecting', async () => { setConnection(await window.ointel!.zoomDisconnect()); setRecordings([]); setListed(false); })}>Disconnect</button>}</div>
        {!connection.connected && <><details className="zoom-setup"><summary>One-time Zoom app setup</summary><ol><li>Create a user-managed General app in Zoom Marketplace and enable <b>Public Client OAuth</b>.</li><li>Register the loopback redirect <code>http://127.0.0.1/zoom/callback</code>. Enable PKCE/native loopback redirects.</li><li>Add the <code>cloud_recording:read:list_user_recordings</code> scope. Enable cloud recording and audio transcripts for your Zoom account.</li><li>Use the app’s <b>Public Client ID</b> below. Add your account as an allowed test user if the app is in development.</li></ol><button className="text-button" onClick={() => void window.ointel!.openExternal('https://developers.zoom.us/docs/integrations/oauth/')}>Open Zoom setup documentation</button></details>
          <label>Public Client ID<input aria-label="Zoom Public Client ID" value={clientId} maxLength={150} placeholder="From your Zoom Marketplace app" onChange={e => setClientId(e.target.value)} /></label>
          <div className="zoom-file-row"><button className="primary" disabled={!!busy || !clientId.trim()} onClick={() => void task('Waiting for Zoom sign-in', async () => { const value = await window.ointel!.zoomConnect(clientId.trim()); if (active.current) setConnection(value); })}>Connect Zoom</button>{busy === 'Waiting for Zoom sign-in' && <button className="secondary" onClick={() => void window.ointel!.zoomCancel()}>Cancel sign-in</button>}{!busy && error && <button className="text-button" onClick={() => void task('Clearing connection', async () => { setConnection(await window.ointel!.zoomDisconnect()); })}>Clear saved connection</button>}</div></>}
        {connection.connected && <><div className="zoom-date-range"><label>From<input aria-label="Recordings from" type="date" value={from} onChange={e => { setFrom(e.target.value); setNextPage(''); setListed(false); setRecordings([]); }} /></label><label>To<input aria-label="Recordings to" type="date" value={to} onChange={e => { setTo(e.target.value); setNextPage(''); setListed(false); setRecordings([]); }} /></label><button className="secondary" disabled={!!busy} onClick={() => void list()}><RefreshCw size={14} />Find recordings</button></div>
          <div className="zoom-recordings">{recordings.map(recording => { const imported = workspace.nodes.some(node => node.meetingSourceKey === recording.key); return <button className="zoom-recording" key={recording.key} disabled={!!busy || imported} onClick={() => void task('Downloading transcript', async () => { const value = await window.ointel!.zoomTranscript(recording.key); await preview(value.text, value); })}><FileText size={17} /><span><strong>{recording.title}</strong><small>{recording.date.replace('T', ' ').replace('Z', ' UTC')}{imported ? ' · Already imported' : ' · Preview transcript'}</small></span></button>; })}{listed && !recordings.length && <p>No completed audio transcripts in this date range. Zoom may still be processing the recording, or audio transcription may not be enabled.</p>}</div>
          {nextPage && <button className="secondary small" disabled={!!busy} onClick={() => void list(true)}>More recordings</button>}</>}
        <p className="section-description">Imports transcripts from recordings available to your Zoom account. Credentials stay encrypted on this device. Disconnect removes local credentials; revoke the app separately in Zoom Marketplace if needed.</p>
      </>}
    </div>}
    {busy && <div className="zoom-progress" role="status"><LoaderCircle className="spin" size={16} />{busy}…</div>}
    {error && <p className="zoom-error" role="alert">{error}</p>}
    {tab !== 'live' && transcript && <div className="zoom-preview">
      <div className="zoom-preview-heading"><Users size={18} /><strong>{groups.size} speakers · {transcript.cues.length} passages</strong><span>Review before adding</span></div>
      <div className="zoom-fields"><label>Meeting title<input aria-label="Meeting title" value={title} maxLength={160} onChange={e => setTitle(e.target.value)} /></label><label>Meeting date<input aria-label="Meeting date" type="date" value={date} onChange={e => setDate(e.target.value)} /></label></div>
      {!!transcript.warnings.length && <div className="zoom-warnings">{transcript.warnings.map(message => <p key={message}>{message}</p>)}</div>}
      <div className="zoom-speakers">{[...groups].map(([speaker, cues]) => <label key={speaker}><span>{speaker} <small>{cues.length} passages</small></span><input aria-label={`Speaker name for ${speaker}`} value={names[speaker] || ''} maxLength={120} onChange={e => setNames(previous => ({ ...previous, [speaker]: e.target.value }))} /></label>)}</div>
      <p className="section-description">Correct speaker names here. Giving labels the same name merges their speaker cards. Unlabeled voices cannot be separated automatically.</p>
      <div className="zoom-transcript-preview">{transcript.cues.slice(0, 12).map((cue, index) => <p key={index}><strong>{timestamp(cue.start)} · {names[cue.speaker]?.trim() || cue.speaker}</strong><span>{cue.text}</span></p>)}{transcript.cues.length > 12 && <small>First 12 passages shown. The complete transcript will be imported.</small>}</div>
      <label className="zoom-option"><input type="checkbox" checked={speakerCards} onChange={e => setSpeakerCards(e.target.checked)} />Create linked cards for each speaker</label>
      {parentId && <label className="zoom-option"><input type="checkbox" checked={attach} onChange={e => setAttach(e.target.checked)} />Connect this meeting to the selected card</label>}
      <p className="section-description">Includes quoted highlights, possible follow-ups for review, and the full transcript. Everything is editable Markdown and included in local vector search.</p>
      <button className="primary" disabled={!!busy || !title.trim() || alreadyImported} onClick={add}>{alreadyImported ? 'Already imported into this map' : 'Add meeting notes to map'}</button>
    </div>}
  </div>;
}
