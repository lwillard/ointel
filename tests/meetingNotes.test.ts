import { describe, it, expect } from 'vitest';
import { parseTranscript, addMeetingNotes, UNKNOWN_SPEAKER } from '../src/lib/meetingNotes';
import { initialWorkspace, parseWorkspace } from '../src/lib/model';

export const transcript = `WEBVTT

1
00:00:01.200 --> 00:00:06.000
Alice: We decided to plant tomatoes in the community garden.

2
00:00:07.000 --> 00:00:11.500
Bob: I'll collect compost and prepare the growing beds.

3
00:00:12.000 --> 00:00:16.000
Alice: We need to order the seeds before Friday.

4
00:00:17.000 --> 00:00:20.000
This passage has no speaker label.
`;
describe('Zoom meeting notes', () => {
  it('preserves VTT speakers, timestamps, line breaks and unlabeled speech', () => {
    const result = parseTranscript('\uFEFF' + transcript.replace(/\n/g, '\r\n'));
    expect(result.cues).toHaveLength(4);
    expect(result.cues[0]).toEqual({ speaker: 'Alice', text: 'We decided to plant tomatoes in the community garden.', start: 1.2, end: 6 });
    expect(result.cues[3].speaker).toBe(UNKNOWN_SPEAKER);
    expect(result.warnings).toHaveLength(1);
  });
  it('accepts SRT voice tags and Zoom saved live transcript text', () => {
    expect(parseTranscript('1\n00:01:02,100 --> 00:01:03,250\n<v Alice>We &amp; you\ncan help.</v>').cues[0]).toEqual({ speaker: 'Alice', text: 'We & you\ncan help.', start: 62.1, end: 63.25 });
    expect(parseTranscript('[Alice Smith] 10:03:12\nFirst line\nSecond line\n[Bob] 10:03:14\nNext thought').cues.map(cue => [cue.speaker, cue.text])).toEqual([['Alice Smith', 'First line\nSecond line'], ['Bob', 'Next thought']]);
    expect(parseTranscript('Alice: First\nBob: Second').cues.map(cue => cue.speaker)).toEqual(['Alice', 'Bob']);
    expect(() => parseTranscript('WEBVTT\n\n1\n00:00:05.000 --> 00:00:01.000\nAlice: Invalid')).toThrow('No transcript passages');
    expect(() => parseTranscript(' ')).toThrow('empty');
  });
  it('creates linked speaker notes, histories, source deduplication and portable searchable Markdown', () => {
    const workspace = initialWorkspace();
    const options = { title: 'Garden planning', date: '2026-09-16', source: 'meeting.vtt', sourceKey: 'file:abc', speakerCards: true, parentId: 'start', position: { x: 1500, y: 100 }, cues: parseTranscript(transcript).cues };
    const result = addMeetingNotes(workspace, options);
    const saved = parseWorkspace(JSON.parse(JSON.stringify(result.workspace)));
    expect(saved.nodes).toHaveLength(10); expect(saved.edges).toHaveLength(9);
    const root = saved.nodes.find(node => node.id === result.rootId)!;
    expect(root.tags).toEqual(['zoom', 'meeting']); expect(root.meetingSourceKey).toBe('file:abc');
    expect(root.body).toContain('Possible follow-ups'); expect(root.body).toContain('00:00:01');
    const alice = saved.nodes.find(node => node.cardType === 'Speaker' && node.title.startsWith('Alice'))!;
    expect(alice.body).toContain('tomatoes'); expect(alice.body).toContain('seeds'); expect(alice.body).not.toContain('compost');
    expect(alice.history[0].body).toBe(alice.body); expect(root.history[0].body).toBe(root.body);
    expect(root.body).toContain(`node://${alice.id}`); expect(alice.body).toContain(`node://${root.id}`);
    expect(() => addMeetingNotes(saved, options)).toThrow('already in the map');
    expect(workspace.nodes).toHaveLength(6);
  });
  it('keeps participant content literal and supports a single meeting card', () => {
    const result = addMeetingNotes(initialWorkspace(), { title: '[Untrusted](https://example.com)', date: '', source: 'paste', speakerCards: false, position: { x: 0, y: 0 }, cues: [{ speaker: 'A [link]', start: 2, end: 3, text: '<script>alert(1)</script> ![image](https://example.com/tracker.png)' }] });
    const root = result.workspace.nodes.at(-1)!;
    expect(root.body).not.toContain('<script>'); expect(root.body).toContain('&lt;script&gt;');
    expect(root.body).not.toContain('![image]'); expect(root.body).toContain('\\!\\[image\\]');
    expect(result.workspace.nodes).toHaveLength(7);
  });
});
