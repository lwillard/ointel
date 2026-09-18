import type { Idea } from '../types';

export const MIN_CARD_SIZE = { width: 240, height: 160 };
export const EDIT_CARD_SIZE = { width: 470, height: 460 };
export const MAX_CARD_SIZE = 2000;

export function cardSize(idea: Pick<Idea, 'size' | 'collapsed'> & { style?: Pick<Idea['style'], 'fontSize' | 'borderWidth'> }, editing = false) {
  const size = idea.size || MIN_CARD_SIZE;
  if (idea.collapsed && !editing) return { width: size.width, height: Math.max(64, Math.ceil((idea.style?.fontSize || 16) * 1.25) + (idea.style?.borderWidth || 0) * 2 + 24) };
  return editing ? { width: Math.max(size.width, EDIT_CARD_SIZE.width), height: Math.max(size.height, EDIT_CARD_SIZE.height) } : size;
}
