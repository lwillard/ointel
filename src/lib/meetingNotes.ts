import { makeIdea, defaultEdgeStyle, uid, saveRevision } from './model';
import type { Workspace, Idea } from '../types';

export interface TranscriptCue { speaker: string; text: string; start: number | null; end: number | null }
export interface MeetingTranscript { cues: TranscriptCue[]; warnings: string[] }
export const UNKNOWN_SPEAKER = 'Unknown speaker';
const clock = '(?:\\d{1,3}:)?\\d{2}:\\d{2}(?:[.,]\\d{1,3})?';
const timing = new RegExp(`^(${clock})\\s*-->\\s*(${clock})(?:\\s.*)?$`);
function seconds(value: string) {
  const parts = value.replace(',', '.').split(':').map(Number);
  return parts.reduce((sum, part) => sum * 60 + part, 0);
}
export function timestamp(value: number | null) {
  if (value === null) return 'No timestamp';
  const whole = Math.floor(value), hours = Math.floor(whole / 3600);
  return [hours, Math.floor(whole / 60) % 60, whole % 60].map(n => String(n).padStart(2, '0')).join(':');
}
function plain(value: string) {
  return value.replace(/<[^>]*>/g, '').replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, entity: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' })[entity] || '').trim();
}
function utterance(value: string, start: number | null, end: number | null): TranscriptCue {
  const voice = value.match(/^\s*<v(?:\.\S+)?\s+([^>]+)>/i);
  const label = !voice && value.match(/^\s*([^\n:<>]{1,120}):\s*(?:\n|\s|$)/);
  const speaker = plain(voice?.[1] || (label ? label[1] : '')).trim() || UNKNOWN_SPEAKER;
  const text = plain(value.slice(voice ? voice[0].length : label ? label[0].length : 0));
  return { speaker, text, start, end };
}
export function parseTranscript(input: string): MeetingTranscript {
  if (input.length > 4_000_000) throw new Error('Choose a transcript smaller than 4 MB.');
  const source = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (!source) throw new Error('The transcript is empty.');
  const cues: TranscriptCue[] = [], warnings: string[] = [];
  const isTimed = /^WEBVTT(?:\s|$)/.test(source) || source.includes('-->');
  if (isTimed) {
    for (const block of source.split(/\n[\t ]*\n/)) {
      const lines = block.split('\n');
      if (/^(WEBVTT|NOTE|STYLE|REGION)(?:\s|$)/.test(lines[0])) continue;
      const index = lines.findIndex(line => timing.test(line.trim()));
      if (index < 0) { if (block.includes('-->')) warnings.push('A cue with an invalid timestamp was skipped.'); continue; }
      const match = lines[index].trim().match(timing)!;
      const start = seconds(match[1]), end = seconds(match[2]);
      if (end < start) { warnings.push('A cue ending before it starts was skipped.'); continue; }
      const cue = utterance(lines.slice(index + 1).join('\n'), start, end);
      if (cue.text) cues.push(cue);
    }
  } else {
    // Saved Zoom live transcripts commonly use: [Speaker] HH:MM:SS followed by text.
    const zoomLine = new RegExp(`^\\[([^\\]]+)\\]\\s+(${clock})\\s*$`);
    const timestampedLine = new RegExp(`^(?:\\[(${clock})\\]|(${clock}))\\s+(.+)$`);
    let current: TranscriptCue | null = null;
    const flush = () => { if (current?.text.trim()) cues.push({ ...current, text: current.text.trim() }); };
    for (const line of source.split('\n')) {
      const zoom = line.match(zoomLine), stamped = line.match(timestampedLine);
      if (zoom) { flush(); current = { speaker: plain(zoom[1]) || UNKNOWN_SPEAKER, start: seconds(zoom[2]), end: null, text: '' }; }
      else if (stamped) { flush(); current = utterance(stamped[3], seconds(stamped[1] || stamped[2]), null); }
      else if (/^[^\n:<>]{1,120}:\s/.test(line)) { flush(); current = utterance(line, null, null); }
      else if (line.trim()) { if (!current) current = { speaker: UNKNOWN_SPEAKER, text: '', start: null, end: null }; current.text += `${current.text ? '\n' : ''}${plain(line)}`; }
    }
    flush();
  }
  if (!cues.length) throw new Error('No transcript passages found. Use a Zoom VTT, SRT, or speaker-labeled TXT transcript.');
  if (cues.length > 20000) throw new Error('This transcript has more than 20,000 passages. Split it into smaller files.');
  if (cues.some(cue => cue.speaker === UNKNOWN_SPEAKER)) warnings.push('Some passages have no speaker label. They will be kept under Unknown speaker.');
  return { cues, warnings: [...new Set(warnings)] };
}

// Transcript content stays literal rather than introducing executable HTML,
// Markdown links, headings, or images from a participant's words.
export function literal(text: string) { return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\\`*_{}\[\]()#+.!|~-]/g, '\\$&'); }
export function speakerGroups(cues: TranscriptCue[]) {
  const groups = new Map<string, TranscriptCue[]>();
  for (const cue of cues) { if (!groups.has(cue.speaker)) groups.set(cue.speaker, []); groups.get(cue.speaker)!.push(cue); }
  return groups;
}
function transcriptMarkdown(cues: TranscriptCue[]) {
  return cues.map(cue => `**${timestamp(cue.start)} · ${literal(cue.speaker)}**\n\n${literal(cue.text)}`).join('\n\n');
}
export interface MeetingImport { title: string; date: string; source: string; cues: TranscriptCue[]; speakerCards: boolean; sourceKey?: string; parentId?: string; position: { x: number; y: number } }
export function addMeetingNotes(workspace: Workspace, options: MeetingImport): { workspace: Workspace; rootId: string } {
  if (!options.title.trim() || !options.cues.length) throw new Error('A meeting title and transcript are required.');
  const groups = speakerGroups(options.cues);
  if (options.sourceKey && workspace.nodes.some(node => node.meetingSourceKey === options.sourceKey)) throw new Error('This transcript is already in the map.');
  if (groups.size > 100 && options.speakerCards) throw new Error('More than 100 speakers were found. Turn off speaker cards or correct the transcript labels.');
  const extra = options.speakerCards ? groups.size : 0;
  if (workspace.nodes.length + 1 + extra > 5000 || workspace.edges.length + extra + (options.parentId ? 1 : 0) > 20000) throw new Error('This import would exceed the map capacity. Import into a new map or turn off speaker cards.');
  const root = makeIdea(options.title.trim().slice(0, 160), options.position);
  root.cardType = 'Meeting'; root.tags = ['zoom', 'meeting'];
  if (options.sourceKey) root.meetingSourceKey = options.sourceKey;
  root.style = { ...root.style, background: '#e9f2ff', borderColor: '#4380bf', textColor: '#224c7a', borderWidth: 2 };
  const speakers: Idea[] = options.speakerCards ? [...groups].map(([speaker, cues], index) => {
    const node = makeIdea(`${speaker} · ${options.title}`.slice(0, 160), { x: options.position.x + 360, y: options.position.y + index * 210 });
    node.cardType = 'Speaker'; node.tags = ['zoom', 'speaker'];
    node.body = `# ${literal(speaker)}\n\n[Back to meeting](node://${root.id})\n\n${transcriptMarkdown(cues)}`;
    node.history = []; return saveRevision(node);
  }) : [];
  const highlights = [...groups].slice(0, 30).flatMap(([, cues]) => cues.filter(cue => cue.text.length >= 35).slice(0, 2));
  const followUps = options.cues.filter(cue => /\b(action item|follow[ -]?up|I(?:'ll| will)|we(?:'ll| will)|need to|agreed to|decided to)\b/i.test(cue.text)).slice(0, 30);
  const quote = (cue: TranscriptCue) => `- **${literal(cue.speaker)} · ${timestamp(cue.start)}:** ${literal(cue.text.replace(/\n/g, ' '))}`;
  root.body = `# ${literal(options.title.trim())}\n\n${options.date ? `**Meeting date:** ${literal(options.date)}\n\n` : ''}**Source:** ${literal(options.source)}\n\n## My notes\n\n_Add your summary, decisions, and action items here._\n\n## Quoted highlights\n\n_Opening substantive passages from each speaker; excerpts, not an AI summary._\n\n${highlights.map(quote).join('\n') || '_No substantive highlights found._'}\n\n## Possible follow-ups\n\n_Keyword-matched quotes. Review before treating these as commitments._\n\n${followUps.map(quote).join('\n') || '_No follow-up phrases detected._'}\n\n## Speakers\n\n${[...groups].map(([speaker, cues], index) => `- ${speakers[index] ? `[${literal(speaker)}](node://${speakers[index].id})` : literal(speaker)} · ${cues.length} passages`).join('\n')}\n\n## Transcript\n\n${transcriptMarkdown(options.cues)}`;
  if ([root, ...speakers].some(node => node.body.length > 5_000_000)) throw new Error('The formatted notes are too large. Split this transcript into smaller files.');
  root.history = []; const savedRoot = saveRevision(root);
  const edges = speakers.map(node => ({ id: uid(), source: root.id, target: node.id, style: { ...defaultEdgeStyle } }));
  if (options.parentId && workspace.nodes.some(node => node.id === options.parentId)) edges.push({ id: uid(), source: options.parentId, target: root.id, style: { ...defaultEdgeStyle } });
  return { rootId: root.id, workspace: { ...workspace, nodes: [...workspace.nodes, savedRoot, ...speakers], edges: [...workspace.edges, ...edges] } };
}
