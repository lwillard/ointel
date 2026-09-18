import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { defaultEdgeStyle, freshWorkspace, makeIdea } from '../../src/lib/model';

test('routes around cards live, spreads ports, bridges crossings, and preserves attachments on reconnect', async () => {
  const directory = path.resolve(`.test-data/routing-${Date.now()}`), workspace = freshWorkspace();
  workspace.nodes = [
    ['left', 0, 300], ['right', 1000, 300], ['top', 650, -140], ['bottom', 650, 700],
    ['blocker', 420, 260], ['extra1', 1000, -140], ['extra2', 1000, 700],
  ].map(([id, x, y]) => ({ ...makeIdea(String(id), { x: Number(x), y: Number(y) }, 'A note for routing.'), id: String(id) }));
  workspace.edges = [
    { id: 'horizontal', source: 'left', target: 'right', sourceHandle: 'right', targetHandle: 'left', style: { ...defaultEdgeStyle, endTerminator: 'solid-arrow' } },
    { id: 'vertical', source: 'top', target: 'bottom', sourceHandle: 'bottom', targetHandle: 'top', style: { ...defaultEdgeStyle, color: '#687cb1' } },
    ...['extra1', 'extra2'].map(id => ({ id, source: 'left', target: id, sourceHandle: 'right', style: { ...defaultEdgeStyle } })),
  ];
  await mkdir(directory, { recursive: true }); await writeFile(path.join(directory, 'workspace.json'), JSON.stringify(workspace));
  const app = await electron.launch({ args: ['.'], env: { ...process.env, OINTEL_DATA_DIR: directory, OINTEL_MODEL_CACHE: path.resolve('.test-data/vectors/models'), OINTEL_TEST_MODE: '1' } });
  const page = await app.firstWindow(), errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.setOpacity(0); win.setSkipTaskbar(true); win.webContents.setBackgroundThrottling(false); win.showInactive(); });
  const edge = page.locator('.react-flow__edge[data-id="horizontal"]'), line = edge.locator('.react-flow__edge-path');
  const blocker = page.locator('.react-flow__node[data-id="blocker"]');
  async function assertNoUnderpasses() {
    const intersections = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.react-flow__node')].map(el => ({ id: el.getAttribute('data-id'), rect: el.getBoundingClientRect() }));
      const hits: string[] = [];
      for (const element of document.querySelectorAll<SVGPathElement>('.react-flow__edge-path, .connector-bridge')) {
        for (let d = 1; d < element.getTotalLength(); d += 3) {
          const p = element.getPointAtLength(d).matrixTransform(element.getScreenCTM()!);
          for (const { id, rect: r } of cards) if (p.x > r.left + 1 && p.x < r.right - 1 && p.y > r.top + 1 && p.y < r.bottom - 1) hits.push(String(id));
        }
      }
      return [...new Set(hits)];
    });
    expect(intersections).toEqual([]);
  }
  async function selectEdge() {
    const p = await line.evaluate(el => { const p = (el as SVGPathElement).getPointAtLength(40).matrixTransform((el as SVGPathElement).getScreenCTM()!); return { x: p.x, y: p.y }; });
    await page.mouse.click(p.x, p.y);
    await expect(page.getByLabel('Path', { exact: true })).toBeVisible();
  }
  try {
    await expect(line).toBeAttached(); await expect(page.locator('.connector-bridge').first()).toBeAttached();
    await page.getByRole('button', { name: 'Fit all ideas', exact: true }).click(); await page.waitForTimeout(500);
    await assertNoUnderpasses();
    await expect(line).toHaveAttribute('d', /C /);
    await expect(line).not.toHaveAttribute('d', /[LQHV]/);
    const offsets = await page.locator('[data-id="left"] .routed-port').evaluateAll(els => els.map(el => parseFloat((el as HTMLElement).style.top)).sort((a, b) => a - b));
    expect(offsets).toHaveLength(3); expect(offsets[1] - offsets[0]).toBeGreaterThanOrEqual(21); expect(offsets[2] - offsets[1]).toBeGreaterThanOrEqual(21);
    await selectEdge(); await expect(page.getByLabel('Path', { exact: true })).toHaveValue('automatic');
    await expect(line).toHaveAttribute('marker-end', /horizontal/);
    await page.screenshot({ path: 'artifacts/ointel-automatic-connectors.png' });
    const before = await line.getAttribute('d'), box = (await blocker.boundingBox())!, zoom = box.width / 240;
    await page.mouse.move(box.x + 90 * zoom, box.y + 20 * zoom); await page.mouse.down();
    await page.mouse.move(box.x + 90 * zoom, box.y + 20 * zoom - 180 * zoom, { steps: 12 });
    await expect(line).not.toHaveAttribute('d', before!); await assertNoUnderpasses(); await page.mouse.up();
    await expect(page.locator('.save-indicator')).toHaveText('All changes saved');
    await selectEdge();
    await page.getByLabel('source attachment').selectOption('');
    const updater = (await edge.locator('.react-flow__edgeupdater-target').boundingBox())!;
    const target = (await page.locator('[data-id="bottom"] .react-flow__handle[data-handleid="left"]').boundingBox())!;
    await page.mouse.move(updater.x + updater.width / 2, updater.y + updater.height / 2); await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 15 }); await page.mouse.up();
    await expect(page.getByLabel('Connection target', { exact: true })).toHaveValue('bottom');
    await expect(page.getByLabel('source attachment')).toHaveValue(''); await expect(page.getByLabel('target attachment')).toHaveValue('left');
    await assertNoUnderpasses();
    await expect(page.locator('.save-indicator')).toHaveText('All changes saved');
    const saved = await page.evaluate(() => window.ointel!.load());
    expect(saved!.edges.find(e => e.id === 'horizontal')).toMatchObject({ sourceHandle: null, targetHandle: 'left', style: { path: 'automatic' } });
    await page.reload(); await expect(line).toBeAttached(); await assertNoUnderpasses();
    expect(errors).toEqual([]);
  } finally { await app.evaluate(({ app }) => app.exit()); }
});
