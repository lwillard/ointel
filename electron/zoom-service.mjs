import { createServer } from 'node:http';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
const CALLBACK = '/zoom/callback';
const MAX_TRANSCRIPT = 4_000_000;
export function zoomDownloadUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !['zoom.us', 'zoom.com'].some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) throw new Error('Zoom returned an unsupported transcript download address.');
  return url;
}
async function limitedText(response, limit) {
  if (Number(response.headers.get('content-length')) > limit) { await response.body?.cancel(); throw new Error('The Zoom response is too large.'); }
  const reader = response.body?.getReader(); if (!reader) return '';
  let size = 0; const chunks = [];
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > limit) throw new Error('The Zoom response is too large.'); chunks.push(value); } }
  finally { await reader.cancel(); }
  return Buffer.concat(chunks).toString('utf8');
}
function responseError(status) {
  if (status === 401) return new Error('Zoom authorization expired. Disconnect and connect again.');
  if (status === 403) return new Error('Zoom denied access. Check recording permissions and the app’s recording scopes.');
  if (status === 429) return new Error('Zoom’s request limit was reached. Wait a minute, then refresh.');
  return new Error(`Zoom request failed (${status}). Check your connection and Zoom app settings.`);
}
export function createZoomService({ directory, safeStorage, openExternal, fetchImpl = fetch }) {
  const file = path.join(directory, 'zoom-connection.enc');
  let connection, loaded = false, refreshPromise, pendingAuth, generation = 0, saving = Promise.resolve();
  const recordings = new Map();
  async function load() {
    if (loaded) return;
    const currentGeneration = generation;
    try {
      const bytes = await readFile(file);
      if (!safeStorage.isEncryptionAvailable()) throw new Error('OS credential encryption is unavailable.');
      const value = JSON.parse(safeStorage.decryptString(bytes));
      if (!value?.accessToken || !value?.refreshToken || !value?.clientId || !Number.isFinite(value?.expiresAt)) throw new Error('Invalid saved Zoom connection.');
      if (currentGeneration === generation) connection = value;
    } catch (error) { if (error.code !== 'ENOENT') throw new Error('The saved Zoom connection could not be opened. Disconnect to clear it, then connect again.'); }
    loaded = true;
  }
  function persist(value, expectedGeneration) {
    saving = saving.catch(() => {}).then(async () => {
      if (expectedGeneration !== generation) throw new Error('Zoom connection changed.');
      if (!safeStorage.isEncryptionAvailable()) throw new Error('OS credential encryption is unavailable.');
      await mkdir(directory, { recursive: true });
      await writeFile(`${file}.tmp`, safeStorage.encryptString(JSON.stringify(value)), { mode: 0o600 });
      if (expectedGeneration !== generation) throw new Error('Zoom connection changed.');
      await rename(`${file}.tmp`, file);
      if (expectedGeneration !== generation) throw new Error('Zoom connection changed.');
      connection = value; loaded = true;
    });
    return saving;
  }
  async function token(fields) {
    const response = await fetchImpl('https://zoom.us/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields), redirect: 'error', signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw responseError(response.status);
    const value = JSON.parse(await limitedText(response, 100000));
    if (typeof value.access_token !== 'string' || typeof value.refresh_token !== 'string' || !Number.isFinite(value.expires_in) || value.expires_in <= 0) throw new Error('Zoom returned an incomplete authorization response.');
    return { clientId: fields.client_id, accessToken: value.access_token, refreshToken: value.refresh_token, expiresAt: Date.now() + value.expires_in * 1000 };
  }
  async function accessToken() {
    await load(); if (!connection) throw new Error('Connect your Zoom account first.');
    if (connection.expiresAt > Date.now() + 60000) return connection.accessToken;
    if (!refreshPromise) {
      const currentGeneration = generation;
      refreshPromise = token({ grant_type: 'refresh_token', client_id: connection.clientId, refresh_token: connection.refreshToken }).then(async next => {
        if (generation !== currentGeneration) throw new Error('Zoom was disconnected.');
        await persist(next, currentGeneration); return next.accessToken;
      }).finally(() => { refreshPromise = null; });
    }
    return refreshPromise;
  }
  async function authorized(url, limit = 8_000_000) {
    const bearer = await accessToken();
    const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${bearer}` }, redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw responseError(response.status);
    return JSON.parse(await limitedText(response, limit));
  }
  async function status() { await load(); return { connected: !!connection, clientId: connection?.clientId || '', connecting: !!pendingAuth }; }
  async function connect(clientId) {
    if (typeof clientId !== 'string' || !/^[a-zA-Z0-9_-]{8,150}$/.test(clientId)) throw new Error('Enter the Public Client ID from your Zoom app.');
    if (!safeStorage.isEncryptionAvailable()) throw new Error('OS credential encryption is unavailable.');
    if (pendingAuth) throw new Error('Zoom sign-in is already open.');
    const verifier = randomBytes(48).toString('base64url'), state = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const currentGeneration = ++generation;
    return new Promise((resolve, reject) => {
      let timer, redirect, finished = false, exchanging = false;
      const finish = (error, value) => { if (finished) return; finished = true; clearTimeout(timer); server.close(); pendingAuth = null; error ? reject(error) : resolve(value); };
      const server = createServer(async (request, response) => {
        const url = new URL(request.url || '/', 'http://127.0.0.1');
        response.setHeader('Content-Type', 'text/plain; charset=utf-8'); response.setHeader('Cache-Control', 'no-store');
        const received = Buffer.from(url.searchParams.get('state') || ''); const expected = Buffer.from(state);
        if (request.method !== 'GET' || url.pathname !== CALLBACK || received.length !== expected.length || !timingSafeEqual(received, expected)) { response.writeHead(400).end('Invalid sign-in response. Return to Ointel.'); return; }
        if (url.searchParams.has('error') || !url.searchParams.get('code')) { response.end('Sign-in was canceled. Return to Ointel.'); finish(new Error('Zoom sign-in was canceled.')); return; }
        response.end('Zoom sign-in received. You can close this tab and return to Ointel.');
        if (finished || exchanging) return;
        exchanging = true;
        try {
          const value = await token({ grant_type: 'authorization_code', client_id: clientId, code: url.searchParams.get('code'), redirect_uri: redirect, code_verifier: verifier });
          if (currentGeneration !== generation || finished) throw new Error('Zoom sign-in was canceled.');
          await persist(value, currentGeneration); recordings.clear(); finish(null, { connected: true, clientId, connecting: false });
        } catch (error) { finish(error); }
      });
      pendingAuth = () => { generation++; finish(new Error('Zoom sign-in was canceled.')); };
      server.on('error', () => finish(new Error('Could not open the local Zoom sign-in callback.')));
      timer = setTimeout(() => { generation++; finish(new Error('Zoom sign-in timed out. Try again.')); }, 180000);
      server.listen(0, '127.0.0.1', async () => {
        redirect = `http://127.0.0.1:${server.address().port}${CALLBACK}`;
        const url = new URL('https://zoom.us/oauth/authorize');
        url.search = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: redirect, state, code_challenge: challenge, code_challenge_method: 'S256' }).toString();
        try { await openExternal(url.href); } catch { finish(new Error('Could not open Zoom sign-in in your browser.')); }
      });
    });
  }
  async function disconnect() {
    generation++; pendingAuth?.();
    if (refreshPromise) await refreshPromise.catch(() => {});
    await saving.catch(() => {});
    connection = undefined; loaded = true; recordings.clear();
    await rm(file, { force: true }); await rm(`${file}.tmp`, { force: true });
    return { connected: false, connecting: false, clientId: '' };
  }
  async function list(from, to, nextPage = '') {
    const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
    if (!validDate(from) || !validDate(to) || from > to || Date.parse(to) - Date.parse(from) > 30 * 86400000) throw new Error('Choose a date range of at most 30 days.');
    if (typeof nextPage !== 'string' || nextPage.length > 2000) throw new Error('Invalid recording page.');
    const currentGeneration = generation;
    const url = new URL('https://api.zoom.us/v2/users/me/recordings');
    url.search = new URLSearchParams({ from, to, page_size: '100', next_page_token: nextPage }).toString();
    const value = await authorized(url);
    if (currentGeneration !== generation) throw new Error('Zoom connection changed. Refresh the list.');
    const items = [];
    for (const meeting of value.meetings || []) {
      for (const recording of meeting.recording_files || []) {
        if (recording.recording_type !== 'audio_transcript' || recording.status !== 'completed' || !recording.download_url) continue;
        const key = `zoom:${meeting.uuid}:${recording.id}`;
        if (key.length > 512) continue;
        const item = { key, title: String(meeting.topic || 'Zoom meeting').slice(0, 160), date: String(meeting.start_time || '').slice(0, 30), recordingId: String(recording.id), meetingUuid: String(meeting.uuid) };
        recordings.set(key, { ...item, downloadUrl: zoomDownloadUrl(recording.download_url).href }); items.push(item);
      }
    }
    if (recordings.size > 5000) recordings.clear();
    return { items, nextPage: String(value.next_page_token || ''), meetingCount: Number(value.total_records || 0) };
  }
  async function transcript(key) {
    if (typeof key !== 'string' || !recordings.has(key)) throw new Error('Refresh the recording list before importing this transcript.');
    const currentGeneration = generation, recording = recordings.get(key), bearer = await accessToken();
    let url = zoomDownloadUrl(recording.downloadUrl);
    for (let hop = 0; hop < 5; hop++) {
      const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${bearer}` }, redirect: 'manual', signal: AbortSignal.timeout(30000) });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location'); await response.body?.cancel();
        if (!location) throw new Error('Zoom returned an incomplete redirect.');
        url = zoomDownloadUrl(new URL(location, url).href); continue;
      }
      if (!response.ok) throw responseError(response.status);
      const text = await limitedText(response, MAX_TRANSCRIPT);
      if (currentGeneration !== generation) throw new Error('Zoom was disconnected.');
      return { text, key, title: recording.title, date: recording.date, source: 'Zoom cloud recording' };
    }
    throw new Error('Zoom returned too many download redirects.');
  }
  return { status, connect, disconnect, list, transcript, cancel: () => pendingAuth?.() };
}
