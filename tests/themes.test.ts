import { describe, it, expect } from 'vitest';
import { initialWorkspace, parseWorkspace } from '../src/lib/model';
import { applyCardTheme, builtInThemes, sameCardStyle } from '../src/lib/themes';
import { nodeStyleSchema } from '../shared/schema.mjs';

describe('card themes', () => {
  it('defines complete distinct presets and applies every visual field only to selected cards', () => {
    const workspace = initialWorkspace();
    workspace.nodes[1].locked = true;
    for (const theme of builtInThemes) expect(nodeStyleSchema.parse(theme.style)).toEqual(theme.style);
    expect(new Set(builtInThemes.map(theme => theme.id)).size).toBe(builtInThemes.length);
    const theme = builtInThemes.find(theme => theme.name === 'Blueprint')!;
    const changed = applyCardTheme(workspace, ['start', 'research'], theme.style);
    expect(changed.nodes[0].style).toEqual(theme.style);
    expect(changed.nodes[1].style).toEqual(theme.style);
    expect(changed.nodes[0].style).not.toBe(changed.nodes[1].style);
    expect(changed.nodes[2]).toBe(workspace.nodes[2]);
    expect(changed.nodes[1].position).toEqual(workspace.nodes[1].position);
    expect(changed.nodes[1].locked).toBe(true);
    expect(changed.nodes[0].body).toBe(workspace.nodes[0].body);
    expect(workspace.nodes[0].style).not.toEqual(theme.style);
    expect(applyCardTheme(changed, ['start', 'research'], theme.style)).toBe(changed);
    expect(applyCardTheme(workspace, [], theme.style)).toBe(workspace);
    expect(sameCardStyle({ ...theme.style, italic: !theme.style.italic }, theme.style)).toBe(false);
  });
  it('migrates old maps and preserves validated custom themes in portable exports', () => {
    const old = JSON.parse(JSON.stringify(initialWorkspace())); delete old.customThemes;
    expect(parseWorkspace(old).customThemes).toEqual([]);
    old.customThemes = [{ ...builtInThemes[0], id: 'my-theme', name: 'My theme' }];
    const saved = parseWorkspace(old);
    expect(parseWorkspace(JSON.parse(JSON.stringify(saved))).customThemes).toEqual(saved.customThemes);
    old.customThemes.push(old.customThemes[0]); expect(() => parseWorkspace(old)).toThrow();
    old.customThemes = [{ ...builtInThemes[0] }]; expect(() => parseWorkspace(old)).toThrow();
  });
});
