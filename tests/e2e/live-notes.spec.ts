import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

test('real local speech through an AudioWorklet, speaker labels, stop flush, recovery and map import', async () => {
  const directory = path.resolve(`.test-data/live-e2e-${Date.now()}`);
  const app = await electron.launch({ args: ['.'], env: { ...process.env, OINTEL_DATA_DIR: directory, OINTEL_MODEL_CACHE: path.resolve('.test-data/vectors/models'), OINTEL_SPEECH_MODELS: path.resolve('.test-data/speech/models'), OINTEL_TEST_MODE: '1' } });
  const page = await app.firstWindow(), errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.getByRole('button', { name: 'Zoom notes', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Zoom meeting notes' });
    await expect(dialog.getByRole('button', { name: 'Start live notes', exact: true })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Prepare local speech', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Start live notes', exact: true })).toBeEnabled({ timeout: 60000 });
    // Only the OS source is substituted: real WAV -> MediaStream -> production AudioWorklet
    // -> secure IPC -> native models in utilityProcess -> disk -> actual UI/map.
    const wav = (await readFile('.test-data/speech/two-speakers.wav')).toString('base64');
    await page.evaluate(base64 => {
      Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', { configurable: true, value: async () => {
        const ctx = new AudioContext({ sampleRate: 48000 });
        const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
        const buffer = await ctx.decodeAudioData(bytes.buffer);
        const source = ctx.createBufferSource(), output = ctx.createMediaStreamDestination();
        source.buffer = buffer; source.connect(output); source.start(ctx.currentTime + 0.5);
        return output.stream;
      } });
    }, wav);
    await dialog.getByLabel('Live meeting title').fill('Live voice trial');
    await dialog.getByRole('button', { name: 'Start live notes', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Stop capture', exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Live transcript')).toContainText(/steady green flame/i, { timeout: 35000 });
    await expect(dialog.getByLabel('Live speaker name for Speaker 2')).toBeVisible({ timeout: 35000 });
    await dialog.getByRole('button', { name: 'Stop capture', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Add live notes to map', exact: true })).toBeEnabled({ timeout: 35000 });
    expect((await page.evaluate(() => window.ointel!.speechStatus())).active).toBe(false);
    await dialog.getByLabel('Live speaker name for Speaker 1').fill('Alice');
    await dialog.getByLabel('Live speaker name for Speaker 2').fill('Bob');
    await dialog.getByLabel('Live meeting title').click();
    await expect.poll(async () => JSON.parse(await readFile(path.join(directory, '.meetings/live-meeting.json'), 'utf8')).names['Speaker 2']).toBe('Bob');
    await page.reload();
    await page.getByRole('button', { name: 'Zoom notes', exact: true }).click();
    await expect(dialog.getByLabel('Live speaker name for Speaker 1')).toHaveValue('Alice');
    await expect(dialog.getByLabel('Live meeting title')).toHaveValue('Live voice trial');
    await page.screenshot({ path: 'artifacts/ointel-live-notes.png' });
    await dialog.getByRole('button', { name: 'Add live notes to map', exact: true }).click();
    await expect(page.locator('.idea-card')).toHaveCount(9);
    await expect(page.locator('.inspector .markdown')).toContainText('Live system audio');
    await page.locator('.inspector').getByRole('link', { name: 'Bob', exact: true }).click();
    await expect(page.getByLabel('Node title', { exact: true })).toHaveValue('Bob · Live voice trial');
    await page.getByRole('button', { name: 'Zoom notes', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Already added to this map', exact: true })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Clear draft for next call', exact: true }).click();
    await page.evaluate(() => { Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', { value: async () => { throw new DOMException('Permission denied in test', 'NotAllowedError'); } }); });
    await dialog.getByRole('button', { name: 'Start live notes', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('Permission denied');
    await expect.poll(async () => (await page.evaluate(() => window.ointel!.speechStatus())).active).toBe(false);
    await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    expect(errors).toEqual([]);
  } catch (error) { console.log('Live status at failure', await page.evaluate(() => window.ointel!.speechStatus())); console.log('Live UI at failure', await page.locator('.live-meeting').innerText()); throw error; }
  finally { await app.evaluate(({ app }) => app.exit()); }
});
