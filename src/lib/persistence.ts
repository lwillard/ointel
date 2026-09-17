import type { Workspace } from '../types';
import { parseWorkspace } from './model';
const KEY = 'ointel.workspace.v1';
export async function loadWorkspace(): Promise<Workspace | null> {
  const data = window.ointel ? await window.ointel.load() : JSON.parse(localStorage.getItem(KEY) || 'null');
  return data ? parseWorkspace(data) : null;
}
let pending = Promise.resolve();
export function persistWorkspace(workspace: Workspace): Promise<void> {
  if (!window.ointel) {
    try { localStorage.setItem(KEY, JSON.stringify(workspace)); return Promise.resolve(); }
    catch (error) { return Promise.reject(error); }
  }
  const snapshot = structuredClone(workspace);
  pending = pending.catch(() => {}).then(() => window.ointel!.save(snapshot));
  return pending;
}
export function download(name: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
