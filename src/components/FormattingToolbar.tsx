import { useEffect, useRef, useState } from 'react';
import { Bold, Italic, Underline, Strikethrough, Code, List, ListOrdered, Quote, ImagePlus, Link2, Undo2, Redo2, RemoveFormatting, Type } from 'lucide-react';
import { fonts, type ActiveCardEditor } from '../lib/richText';
import type { Idea } from '../types';
interface Props {
  active: ActiveCardEditor | null; nodes: Idea[];
  onImage: (id: string, file: File, editor: ActiveCardEditor['editor']) => void;
}
export function FormattingToolbar({ active, nodes, onImage }: Props) {
  const editor = active?.editor;
  const [, render] = useState(0);
  const [links, setLinks] = useState(false);
  const upload = useRef<HTMLInputElement>(null);
  const pendingImage = useRef<ActiveCardEditor | null>(null);
  useEffect(() => {
    setLinks(false);
    if (!editor) return;
    const changed = () => render(n => n + 1);
    editor.on('transaction', changed);
    return () => { editor.off('transaction', changed); };
  }, [editor]);
  const disabled = !editor || editor.isDestroyed;
  const style = editor?.getAttributes('textStyle') || {};
  const markButton = (label: string, mark: string, icon: React.ReactNode, action: () => void) =>
    <button aria-label={label} title={label} disabled={disabled} aria-pressed={editor?.isActive(mark) || false} className={editor?.isActive(mark) ? 'active' : ''} onMouseDown={e => e.preventDefault()} onClick={action}>{icon}</button>;
  return <div className="formatting-toolbar" role="toolbar" aria-label="Note text formatting">
    <span className="formatting-label"><Type size={15} />NOTE TEXT</span>
    <select aria-label="Note font" disabled={disabled} value={style.fontFamily || ''} onChange={e => { if (e.target.value) editor?.chain().focus().setFontFamily(e.target.value).run(); else editor?.chain().focus().unsetFontFamily().run(); }}><option value="">Default font</option>{fonts.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}</select>
    <select aria-label="Note font size" disabled={disabled} value={style.fontSize || ''} onChange={e => { if (e.target.value) editor?.chain().focus().setFontSize(e.target.value).run(); else editor?.chain().focus().unsetFontSize().run(); }}><option value="">Size</option>{[10,12,14,16,18,20,24,28,32,40,48].map(size => <option key={size} value={`${size}px`}>{size}</option>)}</select>
    <span className="toolbar-divider" />
    {markButton('Bold note text', 'bold', <Bold size={15} />, () => editor?.chain().focus().toggleBold().run())}
    {markButton('Italic note text', 'italic', <Italic size={15} />, () => editor?.chain().focus().toggleItalic().run())}
    {markButton('Underline note text', 'underline', <Underline size={15} />, () => editor?.chain().focus().toggleUnderline().run())}
    {markButton('Strikethrough note text', 'strike', <Strikethrough size={15} />, () => editor?.chain().focus().toggleStrike().run())}
    {markButton('Inline code', 'code', <Code size={15} />, () => editor?.chain().focus().toggleCode().run())}
    <label className="toolbar-color" title="Note text color"><span>A</span><input aria-label="Note text color" type="color" disabled={disabled} value={/^#[0-9a-f]{6}$/i.test(style.color || '') ? style.color : '#374633'} onChange={e => editor?.chain().focus().setColor(e.target.value).run()} /></label>
    <label className="toolbar-color highlight-color" title="Text highlight"><span>ab</span><input aria-label="Text highlight" type="color" disabled={disabled} value={/^#[0-9a-f]{6}$/i.test(style.backgroundColor || '') ? style.backgroundColor : '#edf2b7'} onChange={e => editor?.chain().focus().setBackgroundColor(e.target.value).run()} /></label>
    <span className="toolbar-divider" />
    <select aria-label="Paragraph style" disabled={disabled} value={editor?.isActive('heading') ? String(editor.getAttributes('heading').level) : 'paragraph'} onChange={e => { if (e.target.value === 'paragraph') editor?.chain().focus().setParagraph().run(); else editor?.chain().focus().setHeading({ level: +e.target.value as 1 | 2 | 3 }).run(); }}><option value="paragraph">Paragraph</option><option value="1">Heading 1</option><option value="2">Heading 2</option><option value="3">Heading 3</option></select>
    {markButton('Bullet list', 'bulletList', <List size={16} />, () => editor?.chain().focus().toggleBulletList().run())}
    {markButton('Numbered list', 'orderedList', <ListOrdered size={16} />, () => editor?.chain().focus().toggleOrderedList().run())}
    {markButton('Block quote', 'blockquote', <Quote size={14} />, () => editor?.chain().focus().toggleBlockquote().run())}
    <button aria-label="Clear text formatting" title="Clear text formatting" disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().unsetAllMarks().run()}><RemoveFormatting size={16} /></button>
    <span className="toolbar-divider" />
    <button aria-label="Insert note image" title="Insert note image" disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={() => { pendingImage.current = active; upload.current?.click(); }}><ImagePlus size={16} /></button>
    <button aria-label="Insert node link" title="Insert node link" disabled={disabled} aria-expanded={links} onMouseDown={e => e.preventDefault()} onClick={() => setLinks(!links)}><Link2 size={16} /></button>
    {links && active && <div className="toolbar-link-picker"><strong>Link to another idea</strong>{nodes.filter(n => n.id !== active.nodeId).map(node => <button key={node.id} onMouseDown={e => e.preventDefault()} onClick={() => {
      if (!editor) return;
      if (editor.state.selection.empty) editor.chain().focus().insertContent({ type: 'text', text: node.title || 'Untitled idea', marks: [{ type: 'link', attrs: { href: `node://${node.id}` } }] }).run();
      else editor.chain().focus().setLink({ href: `node://${node.id}` }).run();
      setLinks(false);
    }}>{node.title || 'Untitled idea'}</button>)}<button onClick={() => setLinks(false)}>Close</button></div>}
    <button aria-label="Undo note edit" title="Undo note edit" disabled={disabled || !editor?.can().undo()} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().undo().run()}><Undo2 size={15} /></button>
    <button aria-label="Redo note edit" title="Redo note edit" disabled={disabled || !editor?.can().redo()} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().redo().run()}><Redo2 size={15} /></button>
    <span className="formatting-hint">{disabled ? 'Double-click a card to edit its note' : editor?.state.selection.empty ? 'Formatting applies where you type' : 'Formatting applies to selected text'}</span>
    <input hidden ref={upload} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e => { const file = e.target.files?.[0]; const target = pendingImage.current; if (file && target && !target.editor.isDestroyed) onImage(target.nodeId, file, target.editor); e.target.value = ''; }} />
  </div>;
}
