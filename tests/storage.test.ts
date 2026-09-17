import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createStore } from '../electron/storage.mjs';
import { initialWorkspace } from '../src/lib/model';
const directories: string[] = [];
afterEach(async () => { for (const dir of directories.splice(0)) await rm(dir, { recursive: true }); });
describe('local file persistence', () => {
  it('serializes concurrent saves, writes Markdown and embedded assets, and reloads history', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'ointel-store-test-')); directories.push(dir);
    const store = createStore(dir); expect(await store.load()).toBeNull();
    const original = initialWorkspace();
    const updated = structuredClone(original); updated.nodes[0].body = '# Updated\n\n![image](assets/test.png)';
    updated.assets['assets/test.png'] = 'data:image/png;base64,aGVsbG8=';
    await Promise.all([store.save(original), store.save(updated)]);
    expect(await store.load()).toEqual(updated);
    expect(await readFile(path.join(dir, 'notes/start.md'), 'utf8')).toContain('# Updated');
    expect(await readFile(path.join(dir, 'notes/assets/test.png'), 'utf8')).toBe('hello');
    expect(await readFile(path.join(dir, 'notes/.history/start', `${original.nodes[0].history[0].id}.md`), 'utf8')).toBe(original.nodes[0].body);
    expect(JSON.parse(await readFile(path.join(dir, 'workspace.backup.json'), 'utf8'))).toEqual(original);
  });
});
