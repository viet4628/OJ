import { Fragment } from 'react';
import type { ReactNode } from 'react';

const CODE_RE = /`([^`]+)`/g;
const BOLD_RE = /\*\*([^*]+)\*\*/g;
const ITALIC_RE = /\*([^*\n]+)\*/g;

let uid = 0;
const nextKey = () => `md-${++uid}`;

function renderItalic(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  ITALIC_RE.lastIndex = 0;
  while ((m = ITALIC_RE.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<em key={nextKey()}>{m[1]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function renderBold(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  BOLD_RE.lastIndex = 0;
  while ((m = BOLD_RE.exec(text))) {
    if (m.index > last) out.push(...renderItalic(text.slice(last, m.index)));
    out.push(<strong key={nextKey()} className="font-black text-[var(--text-primary)]">{m[1]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(...renderItalic(text.slice(last)));
  return out;
}

function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  CODE_RE.lastIndex = 0;
  while ((m = CODE_RE.exec(text))) {
    if (m.index > last) out.push(...renderBold(text.slice(last, m.index)));
    out.push(
      <code key={nextKey()} className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-1.5 py-0.5 font-code text-[0.9em]">
        {m[1]}
      </code>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(...renderBold(text.slice(last)));
  return out;
}

/**
 * Renders a subset of Markdown (bold **x**, italic *x*, inline code `x`,
 * line breaks + paragraphs) — đủ cho đề bài mà không cần lib bên ngoài.
 */
export default function Markdown({ content, className }: { content: string; className?: string }) {
  const paragraphs = String(content || '').split(/\n{2,}/);
  return (
    <div className={className ?? 'text-[var(--text-secondary)] leading-relaxed'}>
      {paragraphs.map((para, i) => (
        <p key={i} className={i > 0 ? 'mt-2.5' : undefined}>
          {para.split('\n').map((line, j, arr) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {renderInline(line)}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}