import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { initialWorkspace } from '../../src/lib/model';

test('collapse cards, restore sizes, show equal type icons, and save empty types and edits', async () => {
  const directory = path.resolve(`.test-data/collapse-${Date.now()}`), workspace = initialWorkspace();
  const types = ['Person', 'Idea', 'Task', 'Project', 'Program', ''];
  workspace.nodes.forEach((n, i) => { n.cardType = types[i]; });
  workspace.nodes[0].size = { width: 340, height: 240 };
  await mkdir(directory, { recursive: true }); await writeFile(path.join(directory, 'workspace.json'), JSON.stringify(workspace));
  const app = await electron.launch({ args: ['.'], env: { ...process.env, OINTEL_DATA_DIR: directory, OINTEL_MODEL_CACHE: path.resolve('.test-data/vectors/models'), OINTEL_TEST_MODE: '1' } });
  const page = await app.firstWindow(), errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.setOpacity(0); win.setSkipTaskbar(true); win.webContents.setBackgroundThrottling(false); win.showInactive(); });
  const root = page.locator('.react-flow__node[data-id="start"]');
  const dimensions = () => root.evaluate(el => ({ width: (el as HTMLElement).offsetWidth, height: (el as HTMLElement).offsetHeight }));
  const paths = () => page.locator('.react-flow__edge-path').evaluateAll(els => els.map(el => el.getAttribute('d')));
  const saved = () => page.evaluate(async () => (await window.ointel!.load())!.nodes.find(n => n.id === 'start')!);
  try {
    await expect(root.locator('[data-card-type-icon="person"]')).toBeVisible();
    for (const [i, kind] of ['person', 'idea', 'task', 'project', 'program', 'question'].entries()) {
      const icon = page.locator(`.react-flow__node[data-id="${workspace.nodes[i].id}"] .card-type-icon svg`);
      await expect(icon).toHaveAttribute('width', '24'); await expect(icon).toHaveAttribute('height', '24');
      await expect(icon.locator('..')).toHaveAttribute('data-card-type-icon', kind);
    }
    const oldPaths = await paths();
    await root.getByRole('button', { name: 'Collapse card', exact: true }).click();
    await expect.poll(dimensions).toEqual({ width: 340, height: 64 });
    await expect(root.locator('.idea-preview, .idea-eyebrow, .idea-footer, .card-tags, .card-resize-handle')).toHaveCount(0);
    await expect(root.locator('.idea-title')).toHaveText(workspace.nodes[0].title);
    await expect(root.locator('[data-card-type-icon="person"]')).toBeVisible();
    await expect(root.getByRole('button', { name: 'Expand card', exact: true })).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(paths).not.toEqual(oldPaths);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(dimensions).toEqual({ width: 340, height: 240 });
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect.poll(dimensions).toEqual({ width: 340, height: 64 });
    await expect.poll(async () => (await saved()).collapsed).toBe(true);
    expect((await saved()).size).toEqual({ width: 340, height: 240 });
    expect((await saved()).body).toBe(workspace.nodes[0].body);
    await page.reload(); await expect.poll(dimensions).toEqual({ width: 340, height: 64 });
    await root.getByRole('button', { name: 'Expand card', exact: true }).click();
    await expect.poll(dimensions).toEqual({ width: 340, height: 240 });
    await expect(root.locator('.idea-preview')).toBeVisible();
    await page.getByLabel('Card type', { exact: true }).fill(''); await page.getByLabel('Card type', { exact: true }).press('Enter');
    await expect(root.locator('.card-type-icon')).toHaveAttribute('data-card-type-icon', 'question');
    await root.getByRole('button', { name: 'Collapse card', exact: true }).click();
    await expect(root.getByRole('img', { name: 'No type', exact: true })).toBeVisible();
    await root.locator('.idea-title').dblclick();
    await expect(page.getByRole('textbox', { name: 'Card note' })).toBeVisible();
    await expect(root.getByRole('img', { name: 'No type', exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Card note' }).fill('Edited before collapsing.');
    await root.getByRole('button', { name: 'Collapse card', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Card note' })).toHaveCount(0);
    await expect.poll(dimensions).toEqual({ width: 340, height: 64 });
    await expect.poll(async () => (await saved()).body).toContain('Edited before collapsing.');
    // Unknown custom types stay valid, including names inherited by ordinary JS objects.
    await page.getByLabel('Card type', { exact: true }).fill('__proto__'); await page.getByLabel('Card type', { exact: true }).press('Enter');
    await expect(root.locator('.card-type-icon')).toHaveAttribute('data-card-type-icon', 'custom');
    await page.getByLabel('Card type', { exact: true }).fill(''); await page.getByLabel('Card type', { exact: true }).press('Enter');
    await expect.poll(async () => (await saved()).cardType).toBe('');
    await page.getByRole('button', { name: 'Fit all ideas', exact: true }).click(); await page.waitForTimeout(400);
    await page.screenshot({ path: 'artifacts/ointel-collapse-and-type-icons.png' });
    await page.reload(); await expect(root.getByRole('img', { name: 'No type', exact: true })).toBeVisible();
    await expect.poll(dimensions).toEqual({ width: 340, height: 64 });
    expect(errors).toEqual([]);
  } finally { await app.evaluate(({ app }) => app.exit()); }
});
