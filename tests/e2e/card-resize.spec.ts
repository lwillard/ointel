import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

test('resize cards, undo bounds, keep pinned origins, edit, duplicate, and restore saved sizes', async () => {
  const directory = path.resolve(`.test-data/card-resize-${Date.now()}`);
  const app = await electron.launch({ args: ['.'], env: { ...process.env, OINTEL_DATA_DIR: directory, OINTEL_MODEL_CACHE: path.resolve('.test-data/vectors/models'), OINTEL_TEST_MODE: '1' } });
  const page = await app.firstWindow();
  // Keep Electron's compositor active for pointer coordinates during animations,
  // without putting a visible test window over the user's work.
  await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.setOpacity(0); win.setSkipTaskbar(true); win.webContents.setBackgroundThrottling(false); win.showInactive(); });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const card = page.locator('.react-flow__node[data-id="start"]');
  const saved = async () => JSON.parse(await readFile(path.join(directory, 'workspace.json'), 'utf8'));
  const savedCard = async () => (await saved()).nodes.find((n: { id: string }) => n.id === 'start');
  const dimensions = () => card.evaluate(el => ({ width: (el as HTMLElement).offsetWidth, height: (el as HTMLElement).offsetHeight }));
  async function focus() {
    await page.locator('.idea-list-item').filter({ hasText: 'A more connected mind' }).click();
    await expect(card).toBeFocused();
    await page.waitForTimeout(500);
  }
  async function drag(corner: string, dx: number, dy: number) {
    const handle = card.locator(`.card-resize-handle.${corner}`);
    const box = (await handle.boundingBox())!;
    const zoom = (await card.boundingBox())!.width / (await dimensions()).width;
    expect(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.card-resize-handle'), { x: box.x + box.width / 2, y: box.y + box.height / 2 })).toBe(true);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + dx * zoom, box.y + box.height / 2 + dy * zoom, { steps: 12 }); await page.mouse.up();
  }
  try {
    await focus();
    await expect(card.locator('.card-resize-handle')).toHaveCount(4);
    const edge = page.locator('.react-flow__edge-path').first(); const oldPath = await edge.getAttribute('d');
    await drag('bottom.right', 100, 80);
    await expect.poll(dimensions).toEqual({ width: 340, height: 240 });
    await expect.poll(async () => (await savedCard()).size).toEqual({ width: 340, height: 240 });
    await expect(edge).not.toHaveAttribute('d', oldPath!);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(dimensions).toEqual({ width: 240, height: 160 });
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect.poll(dimensions).toEqual({ width: 340, height: 240 });
    await focus();
    await drag('top.left', -40, -30);
    await expect.poll(async () => { const p = (await savedCard()).position; return Math.max(Math.abs(p.x - 360), Math.abs(p.y - 200)); }).toBeLessThanOrEqual(2);
    await expect.poll(async () => { const s = await dimensions(); return Math.max(Math.abs(s.width - 380), Math.abs(s.height - 270)); }).toBeLessThanOrEqual(2);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(async () => (await savedCard()).position).toEqual({ x: 400, y: 230 });
    await expect.poll(dimensions).toEqual({ width: 340, height: 240 });
    await page.getByRole('button', { name: 'Pin position', exact: true }).click();
    await expect(card.locator('.card-resize-handle')).toHaveCount(1);
    await drag('bottom.right', 40, 30);
    await expect.poll(async () => { const s = (await savedCard()).size; return Math.max(Math.abs(s.width - 380), Math.abs(s.height - 270)); }).toBeLessThanOrEqual(2);
    expect((await savedCard()).position).toEqual({ x: 400, y: 230 });
    // Small cards expand temporarily to keep the editor usable; manual resizing
    // in the editor becomes the card's saved size.
    await card.locator('.idea-eyebrow').dblclick();
    const note = page.getByRole('textbox', { name: 'Card note' }); await expect(note).toBeVisible();
    await page.waitForTimeout(500);
    await drag('bottom.right', 30, 30);
    await expect.poll(dimensions).toEqual({ width: 500, height: 490 });
    await note.press('End'); await note.press('Enter'); await page.keyboard.type('Resizing keeps this note editable.');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect.poll(dimensions).toEqual({ width: 500, height: 490 });
    await expect.poll(async () => (await savedCard()).body).toContain('Resizing keeps this note editable.');
    await page.reload(); await focus();
    await expect.poll(dimensions).toEqual({ width: 500, height: 490 });
    expect((await savedCard()).position).toEqual({ x: 400, y: 230 });
    await card.locator('.idea-eyebrow').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Duplicate node', exact: true }).click();
    await expect.poll(async () => (await saved()).nodes.find((n: { title: string }) => n.title === 'A more connected mind (copy)')?.size).toEqual({ width: 500, height: 490 });
    expect(errors).toEqual([]);
  } finally { await app.evaluate(({ app }) => app.exit()); }
});
