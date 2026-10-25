import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EditorContent, Mark, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TableKit } from '@tiptap/extension-table';
import Mathematics from '@tiptap/extension-mathematics';
import { Bold, Italic, Code, CodeXml, List, ListOrdered, Quote, Table, Undo2, Redo2, RemoveFormatting, Sigma, Superscript, Subscript } from 'lucide-react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import './rich-text.css';

const scriptMarks = (['sup', 'sub'] as const).map(tag => Mark.create({
  name: tag === 'sup' ? 'superscript' : 'subscript',
  excludes: 'superscript subscript',
  parseHTML: () => [{ tag }],
  renderHTML: () => [tag, 0],
  markdownOptions: { htmlReopen: { open: `<${tag}>`, close: `</${tag}>` } },
  renderMarkdown: (node, helpers) => `<${tag}>${helpers.renderChildren(node)}</${tag}>`,
}));

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
  group?: { host: HTMLDivElement | null; active: string; activate: (label: string) => void };
}

export function ProblemStatementEditor({ sections }: { sections: Omit<Props, 'group'>[] }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [active, setActive] = useState(sections[0].label);
  return <section aria-label="Nội dung đề bài" className="rich-text-group rounded-md border border-[var(--border)] bg-[var(--bg-primary)]">
    <div ref={setHost} className="sticky top-14 z-20 rounded-t-md bg-[var(--bg-secondary)]" />
    <div className="divide-y divide-[var(--border)]">
      {sections.map(section => <RichTextEditor key={section.label} {...section} group={{ host, active, activate: setActive }} />)}
    </div>
  </section>;
}

export default function RichTextEditor({ label, value, onChange, compact = false, group }: Props) {
  const lastValue = useRef(value);
  const dialog = useRef<HTMLDialogElement>(null);
  const selection = useRef({ from: 1, to: 1 });
  const [formula, setFormula] = useState({ latex: '', block: false, pos: null as number | null });
  const openFormula = (latex = '', block = false, pos: number | null = null) => {
    if (editor) selection.current = { from: editor.state.selection.from, to: editor.state.selection.to };
    setFormula({ latex, block, pos });
    dialog.current?.showModal();
  };
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, underline: false, link: { openOnClick: false } }),
      ...scriptMarks, TableKit, Mathematics.configure({
        katexOptions: { throwOnError: false, trust: false },
        inlineOptions: { onClick: (node, pos) => openFormula(node.attrs.latex, false, pos) },
        blockOptions: { onClick: (node, pos) => openFormula(node.attrs.latex, true, pos) },
      }), Markdown,
    ],
    content: value,
    contentType: 'markdown',
    editorProps: { attributes: { role: 'textbox', 'aria-label': label, 'aria-multiline': 'true', class: `rich-text-content ${compact ? 'rich-text-compact' : ''}` } },
    onFocus: () => group?.activate(label),
    onUpdate: ({ editor }) => {
      const markdown = editor.isEmpty ? '' : editor.getMarkdown();
      lastValue.current = markdown;
      onChange(markdown);
    },
  });
  useEditorState({ editor, selector: ({ transactionNumber }) => transactionNumber });
  useEffect(() => {
    if (editor && value !== lastValue.current) {
      editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
      lastValue.current = value;
    }
  }, [editor, value]);

  if (!editor) return <p role="status">Đang tải trình soạn thảo...</p>;
  const tools = [
    { label: 'In đậm', icon: Bold, active: editor.isActive('bold'), run: () => editor.chain().focus().toggleBold().run() },
    { label: 'In nghiêng', icon: Italic, active: editor.isActive('italic'), run: () => editor.chain().focus().toggleItalic().run() },
    { label: 'Chỉ số trên', icon: Superscript, active: editor.isActive('superscript'), run: () => editor.chain().focus().toggleMark('superscript').run() },
    { label: 'Chỉ số dưới', icon: Subscript, active: editor.isActive('subscript'), run: () => editor.chain().focus().toggleMark('subscript').run() },
    { label: 'Mã trong dòng', icon: Code, active: editor.isActive('code'), run: () => editor.chain().focus().toggleCode().run() },
    { label: 'Khối mã', icon: CodeXml, active: editor.isActive('codeBlock'), run: () => editor.chain().focus().toggleCodeBlock().run() },
    { label: 'Danh sách dấu đầu dòng', icon: List, active: editor.isActive('bulletList'), run: () => editor.chain().focus().toggleBulletList().run() },
    { label: 'Danh sách đánh số', icon: ListOrdered, active: editor.isActive('orderedList'), run: () => editor.chain().focus().toggleOrderedList().run() },
    { label: 'Trích dẫn', icon: Quote, active: editor.isActive('blockquote'), run: () => editor.chain().focus().toggleBlockquote().run() },
    { label: 'Chèn bảng', icon: Table, run: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { label: 'Công thức', icon: Sigma, run: () => openFormula() },
    { label: 'Bỏ định dạng', icon: RemoveFormatting, run: () => editor.chain().focus().unsetAllMarks().clearNodes().run() },
    { label: 'Hoàn tác', icon: Undo2, disabled: !editor.can().undo(), run: () => editor.chain().focus().undo().run() },
    { label: 'Làm lại', icon: Redo2, disabled: !editor.can().redo(), run: () => editor.chain().focus().redo().run() },
  ];
  let preview = '';
  let formulaError = '';
  if (formula.latex.trim()) {
    try { preview = katex.renderToString(formula.latex, { displayMode: formula.block, trust: false, maxExpand: 1000 }); }
    catch { formulaError = 'Công thức chưa hợp lệ. Kiểm tra dấu ngoặc và ký hiệu.'; }
  }
  const applyFormula = () => {
    if (!preview || formulaError) return;
    const chain = editor.chain().focus();
    if (formula.pos !== null) {
      const options = { latex: formula.latex.trim(), pos: formula.pos };
      if (formula.block) chain.updateBlockMath(options).run();
      else chain.updateInlineMath(options).run();
    } else {
      chain.setTextSelection(selection.current);
      if (formula.block) chain.insertBlockMath({ latex: formula.latex.trim() }).run();
      else chain.insertInlineMath({ latex: formula.latex.trim() }).run();
    }
    dialog.current?.close();
  };
  const toolbar = (
      <div role="toolbar" aria-label={`Định dạng ${group ? 'đề bài' : label}`} className="flex flex-wrap items-center gap-1 border-b border-[var(--border)] bg-[var(--bg-secondary)] p-2">
        <select aria-label={`Kiểu đoạn ${group ? 'đề bài' : label}`} value={editor.isActive('heading') ? editor.getAttributes('heading').level : 'paragraph'}
          onChange={event => event.target.value === 'paragraph' ? editor.chain().focus().setParagraph().run() : editor.chain().focus().setHeading({ level: Number(event.target.value) as 1 | 2 | 3 }).run()}
          className="text-xs rounded border border-[var(--border)] bg-[var(--bg-primary)] px-2 py-1.5 text-[var(--text-primary)]">
          <option value="paragraph">Văn bản</option><option value="1">Tiêu đề 1</option><option value="2">Tiêu đề 2</option><option value="3">Tiêu đề 3</option>
        </select>
        {tools.map(tool => <button key={tool.label} type="button" title={tool.label} aria-label={tool.label} aria-pressed={tool.active} disabled={tool.disabled}
          onMouseDown={event => event.preventDefault()} onClick={tool.run}
          className={`p-1.5 rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-30 ${tool.active ? 'bg-[var(--accent-light)] text-[var(--accent-text)]' : 'text-[var(--text-secondary)]'}`}>
          <tool.icon size={16} aria-hidden="true" />
        </button>)}
        {editor.isActive('table') && <div className="flex flex-wrap gap-1 text-xs border-l border-[var(--border)] pl-2">
          <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()}>Thêm hàng</button>
          <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()}>Thêm cột</button>
          <button type="button" onClick={() => editor.chain().focus().deleteRow().run()}>Xóa hàng</button>
          <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()}>Xóa cột</button>
          <button type="button" onClick={() => editor.chain().focus().deleteTable().run()}>Xóa bảng</button>
        </div>}
      </div>
  );
  return <section className={group ? 'min-w-0 space-y-2 px-4 py-4' : 'min-w-0 space-y-2'}>
    <h3 className="text-sm font-semibold text-[var(--text-primary)]">{label}</h3>
    <div className={group ? '' : 'rounded-md border border-[var(--border)] bg-[var(--bg-primary)] overflow-hidden'}>
      {group ? group.active === label && group.host && createPortal(toolbar, group.host) : toolbar}
      <EditorContent editor={editor} />
    </div>
    <dialog ref={dialog} aria-label="Công thức toán" className="w-[min(560px,calc(100%-2rem))] rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] p-5 shadow-xl backdrop:bg-black/40">
      <div className="flex items-center justify-between mb-4"><h3 className="font-semibold">Công thức toán</h3><button type="button" aria-label="Đóng" onClick={() => dialog.current?.close()}>×</button></div>
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          ['Số mũ', '10^{9}'], ['Chỉ số', 'a_{i}'], ['Phân số', String.raw`\frac{a}{b}`],
          ['Căn bậc hai', String.raw`\sqrt{n}`], ['Giới hạn', String.raw`1 \le n \le 10^{5}`],
        ].map(([name, latex]) => <button key={name} type="button" className="border border-[var(--border)] rounded px-2 py-1 text-sm hover:bg-[var(--bg-secondary)]" onClick={() => setFormula(prev => ({ ...prev, latex }))}>{name}</button>)}
      </div>
      <label className="block text-sm">Biểu thức toán<input value={formula.latex} onChange={event => setFormula(prev => ({ ...prev, latex: event.target.value }))} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); applyFormula(); } }} className="block w-full border border-[var(--border)] bg-[var(--bg-secondary)] rounded p-2 mt-1 font-mono" /></label>
      <p className="mt-2 text-xs text-[var(--text-secondary)]">Chọn mẫu ở trên rồi sửa giá trị. Ví dụ: 10^9, a_i, \frac{'{a}{b}'}.</p>
      <label className="flex gap-2 items-center my-3 text-sm"><input type="checkbox" checked={formula.block} disabled={formula.pos !== null} onChange={event => setFormula(prev => ({ ...prev, block: event.target.checked }))} />Hiển thị riêng một dòng</label>
      {preview && <div aria-label="Xem trước công thức" className="overflow-x-auto rounded bg-[var(--bg-secondary)] p-4" dangerouslySetInnerHTML={{ __html: preview }} />}
      {formulaError && <p role="alert" className="text-sm text-[var(--danger)]">{formulaError}</p>}
      <div className="flex justify-end gap-2 mt-5">
        <button type="button" className="border border-[var(--border)] rounded px-3 py-2 text-sm" onClick={() => dialog.current?.close()}>Hủy</button>
        <button type="button" disabled={!preview || !!formulaError} onClick={applyFormula} className="bg-[var(--accent)] text-white rounded px-3 py-2 text-sm disabled:opacity-40">{formula.pos === null ? 'Chèn công thức' : 'Cập nhật công thức'}</button>
      </div>
    </dialog>
  </section>;
}
