import { useEffect, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { Check, History, FileText } from 'lucide-react';
import type { Idea } from '../types';
import { editorExtensions, serializeNote, type ActiveCardEditor } from '../lib/richText';
import { TagsEditor } from './TagsEditor';
import { CardTypeIcon } from './CardTypeIcon';
import { TaskStateEditor } from './TaskStateEditor';
import { CardTypeEditor } from './CardTypeEditor';
import { isNodeLinkMarkdown } from '../../shared/node-links.mjs';

interface Props {
  idea: Idea; assets: Record<string, string>; focus: 'title' | 'body';
  onEdit: (id: string, patch: Partial<Idea>) => void;
  onActive: (value: ActiveCardEditor | null) => void;
  onDone: () => void; onSave: (id: string) => void;
  onNavigate: (id: string) => void;
  onImage: (id: string, file: File, editor: ActiveCardEditor['editor']) => void;
}
export function InlineCardEditor(props: Props) {
  const callbacks = useRef(props); callbacks.current = props;
  const latestMarkdown = useRef(props.idea.body);
  const emitted = useRef<string[]>([]);
  const title = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    extensions: editorExtensions(src => callbacks.current.assets[src] || (src.startsWith('https:') ? src : '')),
    content: props.idea.body, contentType: 'markdown',
    editorProps: {
      attributes: { role: 'textbox', 'aria-label': 'Card note', 'aria-multiline': 'true', class: 'card-prose' },
      handleClick: (_view, _position, event) => {
        const link = event.target instanceof Element ? event.target.closest('a[href^="node://"]') : null;
        if (!link) return false;
        event.preventDefault(); event.stopPropagation();
        callbacks.current.onNavigate(link.getAttribute('href')!.slice(7));
        return true;
      },
      handlePaste: (view, event) => {
        const image = Array.from(event.clipboardData?.items || []).find(item => item.type.startsWith('image/'))?.getAsFile();
        if (image && editor) { callbacks.current.onImage(callbacks.current.idea.id, image, editor); return true; }
        const plain = event.clipboardData?.getData('text/plain');
        if (plain && editor && isNodeLinkMarkdown(plain)) {
          // A native caret move can arrive before ProseMirror's selectionchange.
          // Use the actual paste range so a quick move-and-paste cannot append at an old caret.
          const selection = view.dom.ownerDocument.getSelection();
          let range = { from: view.state.selection.from, to: view.state.selection.to };
          if (selection?.anchorNode && selection.focusNode && view.dom.contains(selection.anchorNode) && view.dom.contains(selection.focusNode)) {
            const anchor = view.posAtDOM(selection.anchorNode, selection.anchorOffset), head = view.posAtDOM(selection.focusNode, selection.focusOffset);
            range = { from: Math.min(anchor, head), to: Math.max(anchor, head) };
          }
          editor.commands.insertContentAt(range, plain.trim(), { contentType: 'markdown' }); return true;
        }
        if (plain && !event.clipboardData?.getData('text/html') && editor && /(^|\n)(#{1,6}\s|[-*] |\d+\. |```)|\[[^\]]+\]\(|\*\*[^*]+\*\*/.test(plain)) {
          editor.commands.insertContent(plain, { contentType: 'markdown' }); return true;
        }
        return false;
      },
      handleKeyDown: (_view, event) => {
        if (event.key === 'Escape') { event.preventDefault(); callbacks.current.onDone(); return true; }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      latestMarkdown.current = serializeNote(editor);
      emitted.current.push(latestMarkdown.current);
      callbacks.current.onEdit(callbacks.current.idea.id, { body: latestMarkdown.current });
    },
    onFocus: ({ editor }) => callbacks.current.onActive({ editor, nodeId: callbacks.current.idea.id, field: 'body' }),
  }, [props.idea.id]);
  useEffect(() => {
    if (!editor) return;
    callbacks.current.onActive({ editor, nodeId: callbacks.current.idea.id, field: 'body' });
    if (callbacks.current.focus === 'title') { title.current?.focus(); title.current?.select(); }
    else editor.commands.focus('end');
    return () => callbacks.current.onActive(null);
  }, [editor]);
  useEffect(() => {
    // React Flow delivers node props one render after a note transaction. Acknowledge
    // our own queued writes without resetting the live caret or its stored marks.
    const echo = emitted.current.lastIndexOf(props.idea.body);
    if (echo !== -1) { emitted.current.splice(0, echo + 1); return; }
    if (editor && props.idea.body !== latestMarkdown.current) {
      emitted.current = [];
      latestMarkdown.current = props.idea.body;
      editor.commands.setContent(props.idea.body, { contentType: 'markdown', emitUpdate: false });
    }
  }, [props.idea.body, editor]);
  const changed = (props.idea.history.at(-1)?.taskState || 'new') !== (props.idea.taskState || 'new') || props.idea.history.at(-1)?.cardType !== props.idea.cardType || props.idea.history.at(-1)?.body !== props.idea.body || props.idea.history.at(-1)?.title !== props.idea.title || JSON.stringify(props.idea.history.at(-1)?.tags) !== JSON.stringify(props.idea.tags);
  return <div className="inline-card-editor nodrag nopan nowheel" onDoubleClick={e => e.stopPropagation()} onKeyDown={e => {
    if (!((e.ctrlKey || e.metaKey) && ['s', 'k'].includes(e.key.toLowerCase()))) e.stopPropagation();
  }}>
    <div className="card-title-row editing-title-row"><CardTypeIcon type={props.idea.cardType} /><input ref={title} aria-label="Card title" className={`inline-card-title font-${props.idea.style.font}`} style={{
      fontSize: props.idea.style.fontSize, fontWeight: props.idea.style.bold ? 650 : 400,
      fontStyle: props.idea.style.italic ? 'italic' : 'normal',
    }} value={props.idea.title} maxLength={160} placeholder="Untitled idea" onFocus={() => props.onActive(null)}
      onChange={e => props.onEdit(props.idea.id, { title: e.target.value })}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); editor?.commands.focus('start'); } if (e.key === 'Escape') props.onDone(); }} /></div>
    <div className="inline-note-heading"><FileText size={12} />NOTE<span>Select text to format it with the toolbar above.</span></div>
    <TagsEditor key={props.idea.id} label="Card tags" tags={props.idea.tags} onChange={tags => props.onEdit(props.idea.id, { tags })} />
    <CardTypeEditor value={props.idea.cardType} label="Inline card type" onChange={cardType => props.onEdit(props.idea.id, { cardType })} />
    <TaskStateEditor idea={props.idea} label="Inline task state" onChange={taskState => props.onEdit(props.idea.id, { taskState })} />
    <div className="inline-note-scroll"><EditorContent editor={editor} /></div>
    <div className="inline-edit-footer"><span>Autosaved · Esc to finish</span><button className="text-button" disabled={!changed} onClick={() => props.onSave(props.idea.id)}><History size={13} />Save version</button><button className="secondary small" onClick={props.onDone}><Check size={13} />Done</button></div>
  </div>;
}
