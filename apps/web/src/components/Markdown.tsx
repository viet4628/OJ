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
    out.push(<strong key={nextKey()} className="font-bold text-[var(--text-primary)]">{m[1]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(...renderItalic(text.slice(last)));
  return out;
}

export function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  CODE_RE.lastIndex = 0;
  while ((m = CODE_RE.exec(text))) {
    if (m.index > last) out.push(...renderBold(text.slice(last, m.index)));
    out.push(
      <code key={nextKey()} className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-1.5 py-0.5 font-code text-[0.9em] text-[var(--text-primary)]">
        {m[1]}
      </code>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(...renderBold(text.slice(last)));
  return out;
}

/**
 * Renders lightweight Markdown (headings #/##/###, code blocks, lists, bold, italic, inline code).
 * Zero external libraries, clean and robust.
 */
export default function Markdown({ content, className }: { content: string; className?: string }) {
  const raw = String(content || '').trim();
  if (!raw) return null;

  const blocks = raw.split(/\n{2,}/);

  return (
    <div className={className ?? 'text-[var(--text-secondary)] leading-relaxed space-y-2'}>
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        // Code block
        if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
          const lines = trimmed.slice(3, -3).split('\n');
          const codeLines = lines[0].match(/^[a-zA-Z0-9_-]+$/) ? lines.slice(1) : lines;
          return (
            <pre
              key={i}
              className="p-3 my-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] font-code text-xs text-[var(--text-primary)] overflow-x-auto whitespace-pre"
            >
              <code>{codeLines.join('\n')}</code>
            </pre>
          );
        }

        // Heading 1
        if (trimmed.startsWith('# ')) {
          return (
            <h1 key={i} className="text-base font-extrabold text-[var(--text-primary)] pt-2 pb-0.5 border-b border-[var(--border)]">
              {renderInline(trimmed.slice(2))}
            </h1>
          );
        }

        // Heading 2
        if (trimmed.startsWith('## ')) {
          return (
            <h2 key={i} className="text-sm font-bold text-[var(--text-primary)] pt-1.5 pb-0.5">
              {renderInline(trimmed.slice(3))}
            </h2>
          );
        }

        // Heading 3
        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={i} className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider pt-1">
              {renderInline(trimmed.slice(4))}
            </h3>
          );
        }

        const lines = trimmed.split('\n');
        const isList = lines.every((l) => /^\s*[-*]\s+/.test(l));
        if (isList) {
          return (
            <ul key={i} className="list-disc list-inside space-y-1 my-1 pl-1 text-[var(--text-secondary)]">
              {lines.map((l, j) => (
                <li key={j} className="leading-relaxed">
                  {renderInline(l.replace(/^\s*[-*]\s+/, ''))}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={i} className="leading-relaxed">
            {lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {renderInline(line)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}