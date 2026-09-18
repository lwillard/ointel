import { clickEdge } from './edge-gestures';
import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { initialWorkspace } from '../../src/lib/model';

async function launch(name: string) {
  const directory = path.resolve(`.test-data/${name}-${Date.now()}`);
  const workspace = initialWorkspace();
  const tags = [['gardening'], ['horticulture'], ['spacecraft'], ['gardening'], ['garden'], []];
  workspace.nodes.forEach((node, i) => { node.tags = tags[i]; node.history[0].tags = [...tags[i]]; });
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'workspace.json'), JSON.stringify(workspace));
  const app = await electron.launch({ args: ['.'], env: { ...process.env, OINTEL_DATA_DIR: directory, OINTEL_MODEL_CACHE: path.resolve('.test-data/vectors/models'), OINTEL_TEST_MODE: '1' } });
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.setOpacity(0); win.setSkipTaskbar(true); win.webContents.setBackgroundThrottling(false); win.showInactive(); });
  await expect(page.getByLabel('Map title')).toBeVisible();
  return { app, page, directory, workspace };
}

test('tag search highlights all exact/related matches, clamps distance, persists history and metadata', async () => {
  const { app, page, directory } = await launch('tags');
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.getByLabel('Node tags', { exact: true }).fill('#FOOD, #Gardening');
    await page.getByLabel('Node tags', { exact: true }).press('Enter');
    await page.getByLabel('Card type', { exact: true }).fill('Project');
    await page.getByLabel('Card type', { exact: true }).press('Enter');
    await expect(page.locator('[data-id="start"] .idea-eyebrow')).toContainText('Project');
    await page.getByRole('button', { name: 'Save version', exact: true }).click();
    await page.getByRole('button', { name: /Search your thoughts/ }).click();
    await page.getByRole('textbox', { name: 'Search thoughts' }).fill('#GARDENING');
    await page.getByRole('button', { name: 'Show matches on map' }).click();
    await page.getByLabel('Tag distance cutoff').fill('0.42');
    await expect(page.getByLabel('Tag distance cutoff')).toHaveValue('0.42');
    const legend = page.getByRole('region', { name: 'Tag search highlights' });
    await expect(legend).not.toContainText('finding related', { timeout: 90000 });
    await expect(page.locator('.save-indicator')).toHaveText('All changes saved');
    await expect.poll(() => page.evaluate(async () => (await window.ointel!.load())?.searchHistory[0].cutoff)).toBe(0.42);
    await page.getByLabel('Tag distance cutoff').fill('0.55');
    await expect(page.locator('[data-id="start"] .idea-card')).toHaveAttribute('data-tag-match', 'exact');
    await expect(page.locator('[data-id="notes"] .idea-card')).toHaveAttribute('data-tag-match', 'exact');
    await expect(page.locator('[data-tag-match="semantic"]').first()).toBeVisible();
    await expect(page.locator('[data-id="reflect"] .idea-card')).not.toHaveAttribute('data-tag-match');
    const results = await page.evaluate(() => window.ointel!.search('#gardening', false));
    for (const result of results) {
      const card = page.locator(`[data-id="${result.nodeId}"] .idea-card`);
      if (result.exact) await expect(card).toHaveAttribute('data-tag-match', 'exact');
      else if (result.distance! <= 0.55) await expect(card).toHaveAttribute('data-tag-match', 'semantic');
      else await expect(card).not.toHaveAttribute('data-tag-match');
    }
    await page.getByLabel('Tag distance cutoff').fill('0');
    await expect(page.locator('[data-tag-match="semantic"]')).toHaveCount(0);
    await expect(page.locator('[data-tag-match="exact"]')).toHaveCount(2);
    await page.getByLabel('Tag distance cutoff').fill('0.55');
    await page.screenshot({ path: 'artifacts/ointel-tag-highlights.png' });
    await page.getByRole('button', { name: 'Clear tag highlights' }).click();
    await expect(page.locator('[data-tag-match]')).toHaveCount(0);
    await expect(page.locator('.save-indicator')).toHaveText('All changes saved');
    await page.reload();
    await expect(page.getByLabel('Card type', { exact: true })).toHaveValue('Project');
    await expect(page.getByRole('button', { name: 'Remove tag food', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Search your thoughts/ }).click();
    await page.locator('.search-history summary').click();
    await page.getByRole('button', { name: 'Repeat search #gardening', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Search thoughts' })).toHaveValue('#gardening');
    await page.getByRole('button', { name: 'Show matches on map' }).click();
    await expect(page.getByLabel('Tag distance cutoff')).toHaveValue('0.55');
    await expect(page.locator('[data-tag-match="exact"]')).toHaveCount(2);
    await expect(page.locator('.save-indicator')).toHaveText('All changes saved');
    const saved = JSON.parse(await readFile(path.join(directory, 'workspace.json'), 'utf8'));
    expect(saved.nodes[0].tags).toEqual(['gardening', 'food']);
    expect(saved.nodes[0].history.at(-1).cardType).toBe('Project');
    expect(saved.searchHistory.filter((entry: { query: string }) => entry.query === '#gardening')).toHaveLength(1);
    expect(errors).toEqual([]);
  } finally { await app.evaluate(({ app }) => app.exit()); }
});

test('context menus, branch deletion, reconnecting and connection terminators', async () => {
  const { app, page, directory, workspace } = await launch('graph');
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  try {
    const edgeId = workspace.edges[0].id;
    const edge = page.locator(`.react-flow__edge[data-id="${edgeId}"]`);
    await clickEdge(page, edge.locator('.react-flow__edge-path'));
    await page.getByLabel('Connection source', { exact: true }).selectOption('notes');
    await page.getByLabel('Connection target', { exact: true }).selectOption('reflect');
    await page.getByLabel('source attachment').selectOption('right');
    await page.getByLabel('Target terminator', { exact: true }).selectOption('white-arrow');
    await expect(page.locator(`#ointel-${edgeId}-end`)).toHaveAttribute('data-terminator', 'white-arrow');
    await expect(edge.locator('.react-flow__edge-path')).toHaveAttribute('marker-end', new RegExp(edgeId));
    await page.getByRole('button', { name: 'One to many', exact: true }).click();
    await expect(page.getByLabel('Source terminator', { exact: true })).toHaveValue('one');
    await expect(page.getByLabel('Target terminator', { exact: true })).toHaveValue('many');
    const updater = edge.locator('.react-flow__edgeupdater-target');
    await expect(updater).toBeAttached();
    const from = await updater.boundingBox();
    const to = await page.locator('[data-id="ideas"] .react-flow__handle[data-handleid="left"]').boundingBox();
    if (!from || !to) throw new Error('Reconnect handles unavailable');
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
    await page.mouse.up();
    await expect(page.getByLabel('Connection target', { exact: true })).toHaveValue('ideas');
    await page.screenshot({ path: 'artifacts/ointel-connection-ends.png' });
    const edgePoint = await edge.locator('.react-flow__edge-path').evaluate(element => {
      const path = element as SVGPathElement;
      for (const fraction of [0.2, 0.8, 0.3, 0.7]) {
        const point = path.getPointAtLength(path.getTotalLength() * fraction).matrixTransform(path.getScreenCTM()!);
        const hit = document.elementFromPoint(point.x, point.y);
        if (hit?.closest('.react-flow__edge') === path.closest('.react-flow__edge')) return { x: point.x, y: point.y };
      }
      throw new Error('No exposed connection segment');
    });
    await page.mouse.click(edgePoint.x, edgePoint.y, { button: 'right' });
    await page.getByRole('menuitem', { name: 'Delete connection', exact: true }).click();
    await expect(page.locator('.react-flow__edge')).toHaveCount(4);
    await expect(page.locator('.react-flow__node')).toHaveCount(6);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.locator('.react-flow__edge')).toHaveCount(5);
    await page.locator('[data-id="research"] .idea-eyebrow').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Add child node', exact: true }).click();
    await page.getByLabel('Node title').fill('Branch child');
    await page.getByRole('button', { name: 'Add connected idea' }).click();
    await page.getByLabel('Node title').fill('Branch grandchild');
    await page.getByRole('button', { name: 'Fit all ideas', exact: true }).click();
    await page.locator('[data-id="research"] .idea-eyebrow').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Delete branch (3 nodes)', exact: true }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(5);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(8);
    await expect(page.locator('.save-indicator')).toHaveText('All changes saved');
    const saved = JSON.parse(await readFile(path.join(directory, 'workspace.json'), 'utf8'));
    const connection = saved.edges.find((edge: { id: string }) => edge.id === edgeId);
    expect(connection).toMatchObject({ source: 'notes', target: 'ideas', sourceHandle: 'right', targetHandle: 'left', style: { startTerminator: 'one', endTerminator: 'many' } });
    await page.reload();
    await expect(page.locator('.react-flow__node')).toHaveCount(8);
    await expect(page.locator(`#ointel-${edgeId}-end`)).toHaveAttribute('data-terminator', 'many');
    expect(errors).toEqual([]);
  } finally { await app.evaluate(({ app }) => app.exit()); }
});
