import { Extension, type Editor, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle, Color, FontFamily, FontSize, BackgroundColor } from '@tiptap/extension-text-style';
import { Underline } from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown } from '@tiptap/markdown';
import type { CSSProperties } from 'react';

export interface ActiveCardEditor { editor: Editor; nodeId: string; field: 'title' | 'body' }
export const fonts = [
  { name: 'Sans serif', value: 'Segoe UI' }, { name: 'Serif', value: 'Georgia' },
  { name: 'Monospace', value: 'Consolas' },
];
const isColor = (s: string) => /^#[0-9a-f]{3,8}$/i.test(s) || /^rgba?\([\d.,%\s]+\)$/.test(s);
export function safeTextStyle(input: Record<string, unknown> = {}): CSSProperties {
  const style: Record<string, string> = {};
  for (const key of ['color', 'backgroundColor']) if (typeof input[key] === 'string' && isColor(input[key])) style[key] = input[key];
  if (typeof input.fontFamily === 'string') {
    const family = input.fontFamily.replace(/["']/g, '').trim();
    if (fonts.some(f => f.value === family)) style.fontFamily = family;
  }
  if (typeof input.fontSize === 'string' && /^\d+(\.\d+)?px$/.test(input.fontSize) && parseFloat(input.fontSize) >= 8 && parseFloat(input.fontSize) <= 72) style.fontSize = input.fontSize;
  return style;
}
const StyledText = TextStyle.extend({
  renderMarkdown(node, helpers) {
    const attrs = safeTextStyle(node.attrs || {});
    const style = Object.entries(attrs).map(([key, value]) => `${key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}: ${value}`).join('; ');
    return style ? `<span style="${style}">${helpers.renderChildren(node)}</span>` : helpers.renderChildren(node);
  },
});
const UnderlinedText = Underline.extend({ renderMarkdown: (node, helpers) => `<u>${helpers.renderChildren(node)}</u>` });
// Mixed Markdown inside HTML spans is not parsed consistently by Markdown
// readers. Serialize styled runs entirely as inline HTML, keeping the rest of
// the document in ordinary Markdown. Entities protect literal Markdown symbols.
const escapeHtml = (text: string) => text.replace(/[&<>"'\\*_~`\[\]]/g, char => `&#${char.charCodeAt(0)};`);
function inlineHtml(node: JSONContent): string {
  let text = escapeHtml(node.text || '');
  for (const mark of [...(node.marks || [])].reverse()) {
    const tag = { bold: 'strong', italic: 'em', strike: 'del', underline: 'u', code: 'code' }[mark.type];
    if (tag) text = `<${tag}>${text}</${tag}>`;
    else if (mark.type === 'link') text = `<a href="${escapeHtml(String(mark.attrs?.href || ''))}">${text}</a>`;
    else if (mark.type === 'textStyle') {
      const style = Object.entries(safeTextStyle(mark.attrs)).map(([key, value]) => `${key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}: ${value}`).join('; ');
      if (style) text = `<span style="${style}">${text}</span>`;
    }
  }
  return text;
}
const InlineHtml = Extension.create({ name: 'inlineHtml', renderMarkdown: node => String(node.attrs?.html || '') });
export function serializeNote(editor: Editor): string {
  const convert = (node: JSONContent): JSONContent => {
    if (node.type === 'text' && node.marks?.some(mark => ['textStyle', 'underline'].includes(mark.type))) {
      return { type: 'inlineHtml', attrs: { html: inlineHtml(node) } };
    }
    return { ...node, ...(node.content ? { content: node.content.map(convert) } : {}) };
  };
  return editor.markdown!.serialize(convert(editor.getJSON()));
}
export function editorExtensions(resolveImage: (src: string) => string) {
  return [
    StarterKit.configure({ underline: false, link: { openOnClick: false, protocols: ['node'], autolink: false } }),
    StyledText, Color, FontFamily, FontSize, BackgroundColor, UnderlinedText,
    Image.extend({ renderHTML({ HTMLAttributes }) { return ['img', { ...HTMLAttributes, src: resolveImage(String(HTMLAttributes.src || '')) }]; } }),
    TableKit, TaskList, TaskItem.configure({ nested: true }), InlineHtml, Markdown,
  ];
}
