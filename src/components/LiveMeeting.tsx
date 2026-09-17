import { useEffect, useRef, useState } from 'react';
import { AudioLines, Download, Mic, Square, ShieldCheck, Users } from 'lucide-react';
import type { SpeechStatus, Workspace } from '../types';
import { speakerGroups, timestamp, type MeetingImport } from '../lib/meetingNotes';
import { startLiveCapture, stopLiveCapture } from '../lib/liveCapture';

export function LiveMeeting({ workspace, parentId, onImport, onBusyChange }: { workspace: Workspace; parentId: string | null; onImport: (options: Omit<MeetingImport, 'position'>) => void; onBusyChange: (busy: boolean) => void }) {
  const [status, setStatus] = useState<SpeechStatus | null>(null), [error, setError] = useState(''), [operation, setOperation] = useState('');
  const [title, setTitle] = useState('Live Zoom meeting'), [microphone, setMicrophone] = useState(false), [speakerCards, setSpeakerCards] = useState(true), [attach, setAttach] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({}), [levels, setLevels] = useState({ system: 0, mic: 0 }), [silent, setSilent] = useState(false);
  const mounted = useRef(true), draftId = useRef(''), lastSound = useRef(Date.now());
  const busy = !!(status?.active || status?.stopping || operation === 'Starting' || operation === 'Stopping');
  useEffect(() => { onBusyChange(busy); }, [busy, onBusyChange]);
  useEffect(() => {
    mounted.current = true;
    const receive = (value: SpeechStatus) => {
      if (!mounted.current) return;
      setStatus(value);
      if ((value.draft?.id || '') !== draftId.current) { draftId.current = value.draft?.id || ''; setTitle(value.draft?.title || 'Live Zoom meeting'); setNames(value.draft?.names || {}); }
      if (!value.active && value.error) void stopLiveCapture().catch(e => setError(e.message));
    };
    void window.ointel?.speechStatus().then(receive).catch(e => setError(e.message));
    const off = window.ointel?.onSpeechStatus(receive);
    return () => { mounted.current = false; off?.(); };
  }, []);
  useEffect(() => {
    if (!status?.active) { setSilent(false); return; }
    lastSound.current = Date.now();
    const timer = setInterval(() => setSilent(Date.now() - lastSound.current > 15000), 1000);
    return () => clearInterval(timer);
  }, [status?.active]);
  async function task(label: string, run: () => Promise<unknown>) {
    setOperation(label); setError('');
    try { await run(); } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Live capture failed.'); }
    finally { if (mounted.current) setOperation(''); }
  }
  async function start() {
    await window.ointel!.speechStart({ title, microphone });
    if (!mounted.current) { await window.ointel!.speechStop(); return; }
    try {
      await startLiveCapture(microphone, (channel, level) => {
        if (channel === 'system' && level > 0.002) lastSound.current = Date.now();
        if (mounted.current) setLevels(previous => ({ ...previous, [channel]: level }));
      }, message => { if (mounted.current) setError(message); });
    } catch (e) { await window.ointel!.speechStop(); throw e; }
  }
  const draft = status?.draft, groups = speakerGroups(draft?.cues || []);
  const alreadyAdded = !!draft && workspace.nodes.some(node => node.meetingSourceKey === `live:${draft.id}`);
  async function add() {
    if (!draft) return;
    await window.ointel!.speechEdit({ title, names });
    // Keep the recovery draft until the user explicitly clears it, including if map persistence fails.
    onImport({ title, date: draft.date.slice(0, 10), source: 'Live system audio · local English speech recognition · review for accuracy', sourceKey: `live:${draft.id}`, cues: draft.cues.map(cue => ({ ...cue, speaker: names[cue.speaker]?.trim() || cue.speaker })), speakerCards, parentId: attach ? parentId || undefined : undefined });
  }
  function exportText() {
    if (!draft) return;
    const text = `${title}\n${draft.date}\n\n` + draft.cues.map(cue => `${timestamp(cue.start)} ${names[cue.speaker]?.trim() || cue.speaker}: ${cue.text}`).join('\n\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'ointel-live-meeting.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="live-meeting">
    <div className="live-heading"><div className={`live-emblem ${status?.active ? 'listening' : ''}`}><AudioLines size={27} /></div><div><h3>Notes, as the conversation happens.</h3><p>Local speech recognition · English · Apple Silicon ready</p></div><span className="live-private"><ShieldCheck size={15} />On device</span></div>
    <p className="section-description">Captures the audio playing through your computer, including Zoom and other apps. No Zoom sign-in, cloud recording, or Zoom transcript is needed. Screen permission may also be requested; screen images are never saved.</p>
    {!window.ointel ? <p className="zoom-error">Live audio capture is available in the Ointel desktop app.</p> : <>
      <div className="live-status" role="status"><span className={status?.active ? 'live-dot' : 'status-dot'} /><span>{status?.message || 'Checking local speech…'}</span>{!!status?.pending && <small>{status.pending} audio batches processing</small>}</div>
      {!status?.ready && <div className="live-models"><p>{status?.bundled ? 'All speech models are included. Prepare local speech to verify and load them; no download is needed.' : 'One-time model download: about 135 MB. After setup, voice recognition and speaker separation work offline.'} Audio stays in memory and is discarded after processing.</p><button className="secondary" disabled={!!operation || status?.preparing} onClick={() => void task('Preparing', () => window.ointel!.speechPrepare())}><Download size={15} />{status?.preparing ? `Preparing models · ${status.progress}%` : 'Prepare local speech'}</button></div>}
      <label>Meeting title<input aria-label="Live meeting title" value={title} maxLength={160} onChange={e => setTitle(e.target.value)} onBlur={() => { if (draft) void window.ointel!.speechEdit({ title }).catch(e => setError(e.message)); }} /></label>
      {!draft && <><label className="zoom-option"><input type="checkbox" checked={microphone} disabled={busy} onChange={e => setMicrophone(e.target.checked)} /><Mic size={14} />Include my microphone as “You”</label><p className="section-description">Use headphones to avoid recording remote voices twice. Ointel’s microphone is independent of Zoom’s mute button: if enabled, it captures you even when Zoom is muted.</p></>}
      <div className="live-controls">
        {!draft && <button className="primary" disabled={!status?.ready || !!operation || busy} onClick={() => void task('Starting', start)}><AudioLines size={16} />Start live notes</button>}
        {busy && <button className="live-stop" disabled={operation === 'Starting' || operation === 'Stopping' || status?.stopping} onClick={() => void task('Stopping', stopLiveCapture)}><Square size={14} fill="currentColor" />{operation === 'Starting' ? 'Opening audio…' : status?.stopping || operation === 'Stopping' ? 'Finishing transcript…' : 'Stop capture'}</button>}
        {status?.active && <div className="live-meters"><label>System audio<meter aria-label="System audio level" min={0} max={0.15} value={levels.system} /></label>{draft?.microphone && <label>Your microphone<meter aria-label="Microphone level" min={0} max={0.15} value={levels.mic} /></label>}</div>}
      </div>
      {silent && <p className="zoom-warnings">No system sound detected for 15 seconds. If people are speaking, check Ointel’s audio/screen permissions in System Settings and restart the app. Also check that Zoom is playing to this computer.</p>}
      {(error || status?.error) && <p className="zoom-error" role="alert">{status?.error || error}</p>}
      {draft && <div className="zoom-preview">
        <div className="zoom-preview-heading"><Users size={18} /><strong>{groups.size} speakers · {draft.cues.length} passages</strong><span>{status?.pending ? 'Saving new passages…' : 'Draft saved locally'}</span></div>
        <p className="section-description">Speaker labels are estimated from voices, not Zoom participant names. Short turns, overlapping voices, and similar voices may be misidentified. Rename or merge labels below; review and edit the resulting Markdown notes.</p>
        <div className="zoom-speakers">{[...groups].map(([speaker, cues]) => <label key={speaker}><span>{speaker}<small>{cues.length} passages</small></span><input aria-label={`Live speaker name for ${speaker}`} value={names[speaker] ?? speaker} maxLength={120} onChange={e => setNames(previous => ({ ...previous, [speaker]: e.target.value }))} onBlur={() => void window.ointel!.speechEdit({ names }).catch(e => setError(e.message))} /></label>)}</div>
        <div className="zoom-transcript-preview live-transcript" aria-label="Live transcript">{!draft.cues.length && <p>{busy ? 'Listening for speech. Passages appear after a pause or about 12 seconds of continuous audio.' : 'No speech was transcribed in this session.'}</p>}{draft.cues.slice(-100).map((cue, i) => <p key={`${cue.start}-${i}`}><strong>{timestamp(cue.start)} · {names[cue.speaker]?.trim() || cue.speaker}</strong><span>{cue.text}</span></p>)}{draft.cues.length > 100 && <small>Showing the latest 100 passages. All passages are saved and included when added to the map.</small>}</div>
        {!busy && <><label className="zoom-option"><input type="checkbox" checked={speakerCards} onChange={e => setSpeakerCards(e.target.checked)} />Create linked cards for each speaker</label>{parentId && <label className="zoom-option"><input type="checkbox" checked={attach} onChange={e => setAttach(e.target.checked)} />Connect this meeting to the selected card</label>}<div className="live-controls"><button className="primary" disabled={!!operation || !draft.cues.length || !title.trim() || alreadyAdded} onClick={() => void task('Adding notes', add)}>{alreadyAdded ? 'Already added to this map' : 'Add live notes to map'}</button><button className="secondary" disabled={!draft.cues.length} onClick={exportText}>Export text</button><button className="text-button" disabled={!!operation} onClick={() => void task('Clearing draft', () => window.ointel!.speechDiscard())}>{alreadyAdded ? 'Clear draft for next call' : 'Discard this draft'}</button></div><p className="section-description">Adding creates editable Markdown meeting and speaker cards, saved history, and local vector search entries. The recovery draft stays here until you clear it.</p></>}
      </div>}
    </>}
  </div>;
}
