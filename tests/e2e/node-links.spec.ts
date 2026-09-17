import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

test('native copy/paste inserts a titled node link at the caret, preserves text copy, and persists navigation', async () => {
  const directory = path.resolve(`.test-data/node-links-${Date.now()}`);
  const app = await electron.launch({ args: ['.'], env: { ...process.env, OINTEL_DATA_DIR: directory, OINTEL_MODEL_CACHE: path.resolve('.test-data/vectors/models'), OINTEL_TEST_MODE: '1' } });
  const page = await app.firstWindow();
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  async function expectFocusedCard(id: string) {
    const card = page.locator(`.react-flow__node[data-id="${id}"]`);
    await expect(card).toHaveClass(/selected/);
    await expect(card).toBeFocused();
    await expect.poll(async () => {
      const bounds = await card.boundingBox(), canvas = await page.getByTestId('canvas').boundingBox();
      if (!bounds || !canvas) return Infinity;
      return Math.max(Math.abs(bounds.x + bounds.width / 2 - canvas.x - canvas.width / 2), Math.abs(bounds.y + bounds.height / 2 - canvas.y - canvas.height / 2));
    }).toBeLessThan(3);
  }
  try {
    await app.evaluate(async ({ clipboard, ClipboardItem }) => { (globalThis as any).clipboardBeforeTest = await Promise.all((await clipboard.read()).map(async item => new ClipboardItem(Object.fromEntries(await Promise.all(item.types.map(async type => [type, await item.getType(type)])))))); });
    const title = 'Plan [A] & <details> *draft*';
    await page.locator('[data-id="research"] .idea-eyebrow').click();
    await page.getByLabel('Node title', { exact: true }).fill(title);
    await page.locator('[data-id="research"] .idea-eyebrow').click();
    await page.keyboard.press(`${mod}+c`);
    const expected = '[Plan \\[A\\] &amp; &lt;details&gt; \\*draft\\*](node://research)';
    await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readText())).toBe(expected);
    await page.locator('[data-id="start"] .idea-eyebrow').dblclick();
    const note = page.getByRole('textbox', { name: 'Card note' });
    await note.press(`${mod}+a`); await page.keyboard.type('Before after');
    await expect(note).toHaveText('Before after');
    await note.press(process.platform === 'darwin' ? 'Meta+ArrowUp' : 'Control+Home'); for (let i = 0; i < 7; i++) await note.press('ArrowRight');
    await expect.poll(() => page.evaluate(() => window.getSelection()?.anchorOffset)).toBe(7);
    await note.press(`${mod}+v`);
    await expect(note.getByRole('link', { name: title, exact: true })).toHaveAttribute('href', 'node://research');
    await expect(note).toHaveText(`Before ${title}after`);
    // Undo/redo paste stays inside the note editor.
    await note.press(`${mod}+z`); await expect(note).toHaveText('Before after');
    await note.press(`${mod}+Shift+z`); await expect(note.getByRole('link', { name: title, exact: true })).toBeVisible();
    await note.press(process.platform === 'darwin' ? 'Meta+ArrowUp' : 'Control+Home'); for (let i = 0; i < 6; i++) await note.press('Shift+ArrowRight');
    await note.press(`${mod}+c`);
    await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readText())).toBe('Before');
    // A normal click follows the link even inside the live editor. Opening the
    // hidden inspector must not leave the card centered behind the panel.
    await page.getByRole('button', { name: 'Toggle details', exact: true }).click();
    await note.getByRole('link', { name: title, exact: true }).click();
    await expect(note).toHaveCount(0);
    await expectFocusedCard('research');
    await expect.poll(async () => JSON.parse(await readFile(path.join(directory, 'workspace.json'), 'utf8')).nodes.find((n: { id: string }) => n.id === 'start').body).toContain('node://research');
    await page.reload();
    await page.locator('.inspector .markdown').getByRole('link', { name: title, exact: true }).click();
    await expect(page.getByLabel('Node title', { exact: true })).toHaveValue(title);
    await expectFocusedCard('research');
    // Context menu uses the same two clipboard formats and can target an unselected card.
    await page.locator('[data-id="notes"] .idea-eyebrow').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Copy node link', exact: true }).click();
    await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readText())).toBe('[Keep the good bits](node://notes)');
    // Plain Markdown clipboard fallback also handles escaped punctuation in a title.
    await app.evaluate(({ clipboard }, text) => clipboard.writeText(text), expected);
    await page.locator('[data-id="research"] .idea-eyebrow').dblclick();
    await note.press(`${mod}+a`); await note.press(`${mod}+v`);
    await expect(note.getByRole('link', { name: title, exact: true })).toHaveAttribute('href', 'node://research');
    expect(errors).toEqual([]);
  } catch (error) { console.log('Node-link test failed:', String(error)); throw error; }
  finally {
    try { await app.evaluate(({ clipboard }) => { if ((globalThis as any).clipboardBeforeTest) return clipboard.write((globalThis as any).clipboardBeforeTest); }); }
    finally { await app.evaluate(({ app }) => app.exit()); }
  }
});
