import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { initialWorkspace, saveRevision } from '../../src/lib/model';
import { defaultGroupStyle } from '../../src/lib/groups';
import type { Workspace } from '../../src/types';

async function launch(workspace: Workspace) {
  const directory = path.resolve(`.test-data/tasks-shared-${Date.now()}`);
  await mkdir(directory, { recursive: true }); await writeFile(path.join(directory, 'workspace.json'), JSON.stringify(workspace));
  const app = await electron.launch({ args: ['.'], env: { ...process.env, OINTEL_DATA_DIR: directory, OINTEL_MODEL_CACHE: path.resolve('.test-data/vectors/models'), OINTEL_TEST_MODE: '1' } });
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.setOpacity(0); win.setSkipTaskbar(true); win.webContents.setBackgroundThrottling(false); win.showInactive(); });
  const saved = () => page.evaluate(async () => (await window.ointel!.load())!);
  await expect(page.getByLabel('Map title')).toBeVisible();
  return { app, page, saved };
}

test('extends the selected group with modifier-click and keeps overlapping memberships independent', async () => {
  const w = initialWorkspace(); w.nodes = w.nodes.slice(0, 4); w.edges = [];
  w.nodes.forEach((n, i) => { n.position = { x: i * 280, y: i % 2 * 150 }; });
  const ids = w.nodes.map(n => n.id);
  w.groups = [{ id: 'a', name: 'Discovery', nodeIds: ids.slice(0, 2), style: { ...defaultGroupStyle } }, { id: 'b', name: 'Delivery', nodeIds: ids.slice(1, 3), style: { ...defaultGroupStyle, background: '#efdcf2' } }];
  const { app, page, saved } = await launch(w), errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const card = (i: number) => page.locator(`.react-flow__node[data-id="${ids[i]}"]`);
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  try {
    await expect(page.locator('.group-boundary')).toHaveCount(2);
    await page.getByLabel('Select card group', { exact: true }).selectOption('a');
    await card(2).click({ modifiers: [modifier] });
    await expect(page.getByLabel('Select card group', { exact: true })).toHaveValue('a');
    await expect(page.locator('.react-flow__node.selected')).toHaveCount(3);
    await page.keyboard.press(`${modifier}+g`);
    await expect.poll(async () => (await saved()).groups.find(g => g.id === 'a')?.nodeIds).toEqual(ids.slice(0, 3));
    expect((await saved()).groups.find(g => g.id === 'b')?.nodeIds).toEqual(ids.slice(1, 3));
    await page.getByRole('button', { name: 'Undo', exact: true }).click(); await expect.poll(async () => (await saved()).groups[0].nodeIds).toEqual(ids.slice(0, 2));
    await page.getByRole('button', { name: 'Redo', exact: true }).click(); await expect.poll(async () => (await saved()).groups[0].nodeIds).toEqual(ids.slice(0, 3));
    // Deselecting an extra candidate does not remove existing members.
    await card(3).click({ modifiers: [modifier] }); await card(3).click({ modifiers: [modifier] });
    await page.keyboard.press(`${modifier}+g`); await expect(page.locator('.react-flow__node.selected')).toHaveCount(3);
    // The chosen group is drawn on top, even when its members overlap another group.
    const before = (await saved()).nodes.map(n => n.position);
    const label = (await page.getByRole('button', { name: 'Select group Delivery', exact: true }).boundingBox())!;
    await page.getByLabel('Select card group', { exact: true }).selectOption('b');
    await page.mouse.move(label.x + 25, label.y + 10); await page.mouse.down(); await page.mouse.move(label.x + 65, label.y + 35, { steps: 8 }); await page.mouse.up();
    await expect.poll(async () => (await saved()).nodes[1].position.x).toBeGreaterThan(before[1].x + 10);
    expect((await saved()).nodes[0].position).toEqual(before[0]); expect((await saved()).nodes[3].position).toEqual(before[3]);
    await page.getByLabel('Select card group', { exact: true }).selectOption('a');
    await page.getByRole('button', { name: `Remove ${w.nodes[1].title} from group`, exact: true }).click();
    await expect.poll(async () => (await saved()).groups[0].nodeIds).toEqual([ids[0], ids[2]]);
    expect((await saved()).groups[1].nodeIds).toEqual(ids.slice(1, 3));
    await page.reload(); await expect(page.locator('.group-boundary')).toHaveCount(2);
    await page.getByLabel('Select card group', { exact: true }).selectOption('a');
    await page.getByRole('button', { name: 'Ungroup cards', exact: true }).click();
    await expect.poll(async () => (await saved()).groups.map(g => g.id)).toEqual(['b']); expect((await saved()).nodes).toHaveLength(4);
    expect(errors).toEqual([]);
  } finally { await app.evaluate(({ app }) => app.exit()); }
});

test('task panel derives due dates, updates status and history, and focuses the chosen card', async () => {
  const w = initialWorkspace();
  w.nodes[0] = saveRevision({ ...w.nodes[0], cardType: 'Task', body: '**Due:** September 30, 2026' });
  w.nodes[1] = saveRevision({ ...w.nodes[1], cardType: 'Task', body: 'Review research, due: 9/23/2026', taskState: 'in progress', position: { x: 3000, y: 2500 } });
  w.nodes[2] = saveRevision({ ...w.nodes[2], cardType: 'Task', body: 'No deadline', taskState: 'completed' });
  w.nodes[3] = saveRevision({ ...w.nodes[3], cardType: 'Task', body: 'due: 2026-02-30', taskState: 'canceled' });
  const { app, page, saved } = await launch(w), errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const panel = page.getByRole('region', { name: 'Tasks panel' });
  try {
    await page.getByRole('button', { name: 'Toggle tasks panel' }).click();
    await expect(panel.locator('tbody tr')).toHaveCount(4);
    await expect(panel.locator('tbody tr').first()).toHaveAttribute('data-task-id', 'research');
    await expect(panel.getByText('2026-09-30', { exact: true })).toBeVisible(); await expect(panel.getByText('No due date', { exact: true })).toBeVisible();
    await expect(panel.getByText('Check date: 2026-02-30', { exact: true })).toBeVisible();
    await panel.getByRole('button', { name: w.nodes[1].title, exact: true }).click();
    const target = page.locator('.react-flow__node[data-id="research"]'); await expect(target).toBeFocused();
    const targetBox = (await target.boundingBox())!, canvas = (await page.getByTestId('canvas').boundingBox())!;
    expect(Math.abs(targetBox.x + targetBox.width / 2 - canvas.x - canvas.width / 2)).toBeLessThan(8);
    await expect(page.getByLabel('Task state', { exact: true })).toBeEnabled();
    await page.getByLabel('Task state', { exact: true }).selectOption('completed');
    await expect(panel.getByLabel(`State of ${w.nodes[1].title}`, { exact: true })).toHaveValue('completed');
    await page.getByRole('button', { name: 'Save version', exact: true }).click();
    await expect.poll(async () => (await saved()).nodes[1].history.at(-1)?.taskState).toBe('completed');
    await page.getByRole('button', { name: 'History', exact: false }).click();
    await page.getByRole('button', { name: 'Previous version', exact: true }).click();
    await page.getByRole('button', { name: 'Restore this version', exact: true }).click();
    await expect(page.getByLabel('Task state', { exact: true })).toHaveValue('in progress');
    await page.getByLabel('Card type options', { exact: true }).selectOption('Idea');
    await expect(page.getByLabel('Task state', { exact: true })).toBeDisabled(); await expect(panel.locator('tbody tr')).toHaveCount(3);
    await page.getByLabel('Card type options', { exact: true }).selectOption('Task');
    await expect(panel.locator('tbody tr')).toHaveCount(4);
    await page.getByRole('button', { name: 'Close tasks panel' }).click();
    await target.locator('.idea-title').dblclick(); await expect(page.getByLabel('Inline task state', { exact: true })).toBeEnabled();
    await page.getByLabel('Inline task state', { exact: true }).selectOption('canceled');
    await page.getByRole('textbox', { name: 'Card note', exact: true }).fill('New deadline: due: 2026-10-12');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect.poll(async () => (await saved()).nodes[1].body).toContain('2026-10-12');
    await expect.poll(async () => (await saved()).nodes[1].taskState).toBe('canceled');
    await page.reload(); await page.getByRole('button', { name: 'Toggle tasks panel' }).click();
    await expect(panel.getByText('2026-10-12', { exact: true })).toBeVisible();
    await expect(panel.getByLabel(`State of ${w.nodes[1].title}`, { exact: true })).toHaveValue('canceled');
    await panel.getByLabel(`State of ${w.nodes[1].title}`, { exact: true }).selectOption('new');
    await expect.poll(async () => (await saved()).nodes[1].taskState).toBe('new');
    await panel.getByRole('button', { name: w.nodes[0].title, exact: true }).click();
    await expect(page.locator('.react-flow__node[data-id="start"]')).toBeFocused();
    await page.screenshot({ path: 'artifacts/ointel-tasks-panel.png' });
    expect(errors).toEqual([]);
  } finally { await app.evaluate(({ app }) => app.exit()); }
});
