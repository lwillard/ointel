import { it, expect } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createZoomService, zoomDownloadUrl } from '../electron/zoom-service.mjs';
const safeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: text => Buffer.from([...Buffer.from(text)].map(byte => byte ^ 0xa5)),
  decryptString: bytes => Buffer.from([...bytes].map(byte => byte ^ 0xa5)).toString(),
};
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });

it('uses PKCE/state, persists encrypted credentials, refreshes once and fetches only listed Zoom transcripts', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ointel-zoom-'));
  let authUrl, refreshes = 0, revokedDestination = false;
  const requests = [];
  const fetchImpl = async (input, options) => {
    const url = new URL(input); requests.push({ url, options });
    if (url.pathname === '/oauth/token') {
      expect(options.headers.Authorization).toBeUndefined();
      expect(options.body.get('client_id')).toBe('public-client-id');
      if (options.body.get('grant_type') === 'authorization_code') {
        expect(createHash('sha256').update(options.body.get('code_verifier')).digest('base64url')).toBe(authUrl.searchParams.get('code_challenge'));
        return json({ access_token: 'test-access-first', refresh_token: 'test-refresh-first', expires_in: 1 });
      }
      refreshes++; expect(options.body.get('refresh_token')).toBe('test-refresh-first');
      return json({ access_token: 'test-access-second', refresh_token: 'test-refresh-second', expires_in: 3600 });
    }
    expect(options.headers.Authorization).toBe('Bearer test-access-second');
    if (url.pathname === '/v2/users/me/recordings') return json({ total_records: 1, meetings: [{ uuid: 'meeting/uuid==', topic: 'Garden planning', start_time: '2026-09-16T10:00:00Z', recording_files: [
      { id: 'transcript', recording_type: 'audio_transcript', status: 'completed', download_url: 'https://us06web.zoom.us/rec/download/first' },
      { id: 'pending', recording_type: 'audio_transcript', status: 'processing', download_url: 'https://us06web.zoom.us/rec/download/second' },
      { id: 'video', recording_type: 'shared_screen_with_speaker_view', status: 'completed', download_url: 'https://us06web.zoom.us/rec/download/video' },
    ] }] });
    if (url.pathname === '/rec/download/first') return new Response(null, { status: 302, headers: { location: revokedDestination ? 'https://example.com/steal' : 'https://us06web.zoom.us/rec/download/final' } });
    if (url.pathname === '/rec/download/final') return new Response('WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.000\nAlice: Hello.');
    throw new Error('Unexpected request');
  };
  let service;
  try {
    service = createZoomService({ directory, safeStorage, fetchImpl, openExternal: async url => {
      authUrl = new URL(url);
      expect(authUrl.origin).toBe('https://zoom.us'); expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256');
      const callback = new URL(authUrl.searchParams.get('redirect_uri'));
      expect(callback.hostname).toBe('127.0.0.1');
      callback.search = new URLSearchParams({ code: 'test-code', state: 'wrong' }).toString();
      expect((await fetch(callback)).status).toBe(400);
      callback.searchParams.set('state', authUrl.searchParams.get('state'));
      expect((await fetch(callback)).status).toBe(200);
    } });
    expect(await service.connect('public-client-id')).toEqual({ connected: true, connecting: false, clientId: 'public-client-id' });
    expect((await readFile(path.join(directory, 'zoom-connection.enc'))).toString()).not.toContain('test-access');
    const [a, b] = await Promise.all([service.list('2026-09-01', '2026-09-16'), service.list('2026-09-01', '2026-09-16')]);
    expect(refreshes).toBe(1); expect(a.items).toHaveLength(1); expect(b.items).toEqual(a.items);
    const value = await service.transcript(a.items[0].key);
    expect(value.text).toContain('Alice: Hello.'); expect(value.title).toBe('Garden planning');
    await expect(service.transcript('https://example.com/steal')).rejects.toThrow('Refresh');
    revokedDestination = true;
    await expect(service.transcript(a.items[0].key)).rejects.toThrow('unsupported');
    expect(requests.some(request => request.url.hostname === 'example.com')).toBe(false);
    const restored = createZoomService({ directory, safeStorage, fetchImpl, openExternal: async () => {} });
    expect((await restored.status()).connected).toBe(true);
    await restored.disconnect(); expect((await restored.status()).connected).toBe(false);
    await expect(readFile(path.join(directory, 'zoom-connection.enc'))).rejects.toMatchObject({ code: 'ENOENT' });
  } finally { service?.cancel(); await rm(directory, { recursive: true, force: true }); }
});

it('rejects unsafe download URLs, invalid ranges and unavailable OS credential encryption', async () => {
  for (const value of ['http://zoom.us/file', 'https://zoom.us.evil.example/file', 'https://user:pass@zoom.us/file', 'https://zoom.us:444/file', 'https://127.0.0.1/file']) expect(() => zoomDownloadUrl(value)).toThrow();
  const service = createZoomService({ directory: 'unused', safeStorage: { isEncryptionAvailable: () => false }, openExternal: async () => {} });
  await expect(service.connect('public-client-id')).rejects.toThrow('encryption');
  await expect(service.list('2026-01-01', '2026-09-16')).rejects.toThrow('30 days');
  await expect(service.list('2026-99-99', '2026-09-16')).rejects.toThrow('30 days');
});

it('cancels sign-in without saving credentials even when the token response arrives late', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ointel-zoom-cancel-'));
  let release, signalStarted;
  const started = new Promise(resolve => { signalStarted = resolve; });
  const service = createZoomService({ directory, safeStorage,
    fetchImpl: async () => { signalStarted(); return new Promise(resolve => { release = () => resolve(json({ access_token: 'late-access', refresh_token: 'late-refresh', expires_in: 3600 })); }); },
    openExternal: async address => { const url = new URL(address), callback = new URL(url.searchParams.get('redirect_uri')); callback.search = new URLSearchParams({ state: url.searchParams.get('state'), code: 'late-code' }).toString(); await fetch(callback); },
  });
  try {
    const connecting = service.connect('public-client-id');
    const rejected = expect(connecting).rejects.toThrow('canceled');
    await started; await service.disconnect(); release(); await rejected;
    await new Promise(resolve => setImmediate(resolve));
    expect((await service.status()).connected).toBe(false);
    await expect(readFile(path.join(directory, 'zoom-connection.enc'))).rejects.toMatchObject({ code: 'ENOENT' });
  } finally { service.cancel(); await rm(directory, { recursive: true, force: true }); }
});
