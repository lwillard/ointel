import { mkdir, readFile, writeFile, rename, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { workspaceSchema } from '../shared/schema.mjs';

async function atomicWrite(file, content) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  await writeFile(temporary, content, 'utf8');
  await rename(temporary, file);
}
export function createStore(directory) {
  const manifest = path.join(directory, 'workspace.json');
  let queue = Promise.resolve();
  return {
    directory,
    async load() {
      try { return workspaceSchema.parse(JSON.parse(await readFile(manifest, 'utf8'))); }
      catch (error) {
        if (error.code === 'ENOENT') return null;
        throw new Error('The workspace could not be read. Your files have not been changed. Check workspace.json or restore workspace.backup.json.');
      }
    },
    save(input) {
      const workspace = workspaceSchema.parse(input);
      const serialized = JSON.stringify(workspace, null, 2);
      if (Buffer.byteLength(serialized) > 100 * 1024 * 1024) return Promise.reject(new Error('This workspace exceeds the 100 MB limit. Export a backup and use a smaller map.'));
      queue = queue.catch(() => {}).then(async () => {
        await mkdir(directory, { recursive: true });
        try { await copyFile(manifest, path.join(directory, 'workspace.backup.json')); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        // The atomic manifest is the recovery source; Markdown files are portable projections.
        await atomicWrite(manifest, serialized);
        const notes = path.join(directory, 'notes');
        for (const node of workspace.nodes) {
          await atomicWrite(path.join(notes, `${node.id}.md`), node.body);
          for (const revision of node.history) {
            const file = path.join(notes, '.history', node.id, `${revision.id}.md`);
            try { await readFile(file); }
            catch (error) {
              if (error.code !== 'ENOENT') throw error;
              await atomicWrite(file, revision.body.replace(/\]\(assets\//g, '](../../assets/'));
            }
          }
        }
        for (const [name, data] of Object.entries(workspace.assets)) {
          const file = path.join(notes, name);
          await mkdir(path.dirname(file), { recursive: true });
          await writeFile(file, Buffer.from(data.split(',')[1], 'base64'));
        }
      });
      return queue;
    },
    flush: () => queue,
  };
}
