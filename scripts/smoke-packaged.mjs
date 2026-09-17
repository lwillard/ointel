import { _electron as electron, expect } from '@playwright/test';
import path from 'node:path';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const application = await electron.launch({ executablePath: path.resolve(process.env.OINTEL_PACKAGED_APP || (process.platform === 'darwin' ? 'release/mac-arm64/Ointel.app/Contents/MacOS/Ointel' : 'release/win-unpacked/Ointel.exe')),
  env: { ...process.env, OINTEL_DATA_DIR: path.resolve(`.test-data/packaged-${Date.now()}`), OINTEL_TEST_MODE: '1', OINTEL_TEST_OFFLINE: '1' },
});
try {
  const page = await application.firstWindow();
  await page.route(/^https?:\/\//, route => route.abort());
  await page.getByLabel('Map title').waitFor();
  console.log('Runtime', await application.evaluate(({ app }) => ({ directory: process.env.OINTEL_DATA_DIR, packaged: app.isPackaged })));
  console.log('Packaged renderer and secure bridge loaded.');
  assert.equal(await application.evaluate(({ app }) => app.getVersion()), JSON.parse(await readFile('package.json', 'utf8')).version);
  await page.locator('[data-id="start"] .idea-eyebrow').dblclick();
  const note = page.getByRole('textbox', { name: 'Card note' });
  await note.press(process.platform === 'darwin' ? 'Meta+ArrowDown' : 'Control+End');
  await page.keyboard.type('Packaged editor check.');
  await expect(note).toContainText('Packaged editor check.');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByLabel('Node tags', { exact: true }).fill('#packaged');
  await page.getByLabel('Node tags', { exact: true }).press('Enter');
  await expect(page.locator('.save-indicator')).toHaveText('All changes saved');
  await expect.poll(async () => {
    const status = await page.evaluate(() => window.ointel.vectorStatus());
    if (status.state === 'error') throw new Error(status.message);
    return status.state;
  }, { timeout: 90000 }).toBe('ready');
  console.log('Status', await page.evaluate(() => window.ointel.vectorStatus()));
  const results = await page.evaluate(() => window.ointel.search('collecting sources and investigating questions', false));
  assert(results.length > 0); console.log('Packaged vector search passed:', results.map(r => r.title).join(', '));
  const saved = await page.evaluate(() => window.ointel.load());
  assert.equal(saved.nodes.length, 6);
  assert(saved.nodes[0].body.includes('Packaged editor check.'));
  assert(saved.nodes[0].tags.includes('packaged'));
  const tagResults = await page.evaluate(() => window.ointel.search('#PACKAGED', false));
  assert(tagResults.some(result => result.nodeId === 'start' && result.exact && result.distance === 0));
  await page.getByRole('button', { name: 'Select all cards', exact: true }).click();
  await expect(page.locator('.selected-card-count')).toHaveText('6 selected');
  await page.getByRole('button', { name: 'Apply Blueprint theme', exact: true }).click();
  await expect(page.locator('.idea-title.font-mono')).toHaveCount(6);
  await page.getByRole('button', { name: 'Theme editor', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Theme editor', exact: true });
  await editor.getByLabel('Theme name', { exact: true }).fill('Packaged custom theme');
  await editor.getByRole('button', { name: 'Save theme', exact: true }).click();
  await expect.poll(async () => (await page.evaluate(() => window.ointel.load())).customThemes.length).toBe(1);
  console.log('Packaged multi-selection and custom theme persistence passed.');
  await page.getByRole('button', { name: 'Zoom notes', exact: true }).click();
  const zoom = page.getByRole('dialog', { name: 'Zoom meeting notes' });
  await zoom.getByRole('button', { name: 'Prepare local speech', exact: true }).click();
  await expect(zoom.getByRole('button', { name: 'Start live notes', exact: true })).toBeEnabled({ timeout: 60000 });
  const wav = await readFile('.test-data/speech/two-speakers.wav');
  // Public PCM16 WAV fixture has a standard 44-byte header. Exercise packaged native libraries.
  assert.equal(wav.readUInt32LE(24), 16000);
  const samples = Array.from({ length: (wav.length - 44) / 2 }, (_, i) => wav.readInt16LE(44 + i * 2) / 32768);
  await page.evaluate(async values => {
    await window.ointel.speechStart({ title: 'Packaged speech check', microphone: false });
    await window.ointel.speechAudio({ channel: 'system', samples: new Float32Array(values.slice(0, 128000)), start: 0 });
    await window.ointel.speechAudio({ channel: 'system', samples: new Float32Array(values.slice(128000)), start: 8 });
    await window.ointel.speechStop();
  }, samples);
  const spoken = await page.evaluate(() => window.ointel.speechStatus());
  assert.equal(spoken.bundled, true);
  assert.match(spoken.draft.cues.map(c => c.text).join(' '), /steady green flame/i);
  assert.equal(new Set(spoken.draft.cues.map(c => c.speaker)).size, 2);
  await page.evaluate(() => window.ointel.speechDiscard());
  console.log('Packaged native speech, two-speaker separation, IPC and draft persistence passed.');
  await zoom.getByRole('button', { name: 'Transcript file', exact: true }).click();
  await zoom.getByLabel('Zoom transcript file').setInputFiles({ name: 'Packaged meeting.vtt', mimeType: 'text/vtt', buffer: Buffer.from('WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nAlice: We will prepare the next release tomorrow.\n\n2\n00:00:04.000 --> 00:00:06.000\nBob: I will check the release notes and documentation.') });
  await expect(zoom).toContainText('2 speakers · 2 passages');
  await zoom.getByRole('button', { name: 'Add meeting notes to map', exact: true }).click();
  await expect(page.locator('.idea-card')).toHaveCount(9);
  await expect.poll(async () => (await page.evaluate(() => window.ointel.load())).nodes.filter(node => node.cardType === 'Speaker').length).toBe(2);
  assert.equal((await page.evaluate(() => window.ointel.zoomStatus())).connected, false);
  console.log('Packaged Zoom notes import and secure IPC passed.');
  console.log('Packaged smoke test passed.');
} finally { await application.evaluate(({ app }) => app.exit()); }
