import { Fragment, type ReactNode } from 'react';
import { Marked, type Token, type Tokens } from 'marked';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import './markdown.css';

const parser = new Marked({ gfm: true, breaks: true }, {
  extensions: [
    {
      name: 'scriptText', level: 'inline',
      start: source => source.search(/<(?:sup|sub)>/i),
      tokenizer(source) {
        const match = /^<(sup|sub)>([\s\S]*?)<\/\1>/i.exec(source);
        if (match) return { type: 'scriptText', raw: match[0], tag: match[1].toLowerCase(), tokens: this.lexer.inlineTokens(match[2]) };
      },
    },
    {
      name: 'blockMath', level: 'block',
      start: source => source.indexOf('$$'),
      tokenizer(source) {
        const match = /^\$\$([\s\S]+?)\$\$(?:\n|$)/.exec(source);
        if (match) return { type: 'blockMath', raw: match[0], text: match[1].trim() };
      },
    },
    {
      name: 'inlineMath', level: 'inline',
      start: source => source.indexOf('$'),
      tokenizer(source) {
        const match = /^\$([^$\n]+)\$(?!\$)/.exec(source);
        if (match) return { type: 'inlineMath', raw: match[0], text: match[1].trim() };
      },
    },
  ],
});

function math(text: string, displayMode: boolean) {
  // Only KaTeX-generated markup is inserted; raw author HTML is rendered as text.
  return <span className={displayMode ? 'block overflow-x-auto py-2 text-center' : 'inline-math'} dangerouslySetInnerHTML={{
    __html: katex.renderToString(text, { displayMode, throwOnError: false, trust: false, maxExpand: 1000 }),
  }} />;
}

function safeLink(href: string): string | undefined {
  try { return ['http:', 'https:', 'mailto:'].includes(new URL(href, window.location.origin).protocol) ? href : undefined; }
  catch { return undefined; }
}

function renderTokens(tokens: Token[] = []): ReactNode[] {
  return tokens.map((token, index) => {
    let node: ReactNode;
    switch (token.type) {
      case 'space': return null;
      case 'scriptText': node = token.tag === 'sup' ? <sup>{renderTokens(token.tokens)}</sup> : <sub>{renderTokens(token.tokens)}</sub>; break;
      case 'inlineMath': node = math(token.text, false); break;
      case 'blockMath': node = math(token.text, true); break;
      case 'paragraph': node = <p>{renderTokens(token.tokens || [])}</p>; break;
      case 'text': node = token.tokens ? renderTokens(token.tokens) : token.text; break;
      case 'strong': node = <strong>{renderTokens(token.tokens)}</strong>; break;
      case 'em': node = <em>{renderTokens(token.tokens)}</em>; break;
      case 'del': node = <del>{renderTokens(token.tokens)}</del>; break;
      case 'codespan': node = <code>{token.text}</code>; break;
      case 'br': node = <br />; break;
      case 'hr': node = <hr />; break;
      case 'heading': {
        const Tag = `h${Math.min(token.depth, 6)}` as 'h1' | 'h2' | 'h3';
        node = <Tag>{renderTokens(token.tokens)}</Tag>; break;
      }
      case 'blockquote': node = <blockquote>{renderTokens(token.tokens)}</blockquote>; break;
      case 'list': {
        const list = token as Tokens.List;
        const items = list.items.map((item, i) => <li key={i}>{item.task && <input type="checkbox" checked={!!item.checked} disabled aria-label="Mục đã chọn" />}{renderTokens(item.tokens)}</li>);
        node = list.ordered ? <ol start={list.start || 1}>{items}</ol> : <ul>{items}</ul>; break;
      }
      case 'link': node = <a href={safeLink(token.href)} title={token.title || undefined} rel="noopener noreferrer">{renderTokens(token.tokens)}</a>; break;
      case 'image': node = token.text; break;
      case 'table': {
        const table = token as Tokens.Table;
        node = <div className="overflow-x-auto"><table><thead><tr>{table.header.map((cell, i) => <th key={i} style={{ textAlign: table.align[i] || 'left' }}>{renderTokens(cell.tokens)}</th>)}</tr></thead>
          <tbody>{table.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} style={{ textAlign: table.align[j] || 'left' }}>{renderTokens(cell.tokens)}</td>)}</tr>)}</tbody></table></div>; break;
      }
      case 'code': node = <div className="my-3 rounded-md border border-[var(--border)] overflow-hidden">
        <div className="flex justify-between items-center bg-[var(--bg-secondary)] px-3 py-1 text-xs"><span>{token.lang || 'code'}</span><button type="button" onClick={() => navigator.clipboard?.writeText(token.text)}>Sao chép</button></div>
        <pre><code>{token.text}</code></pre>
      </div>; break;
      default: node = token.raw;
    }
    return <Fragment key={index}>{node}</Fragment>;
  });
}

export function renderInline(text: string): ReactNode[] {
  return renderTokens(parser.Lexer.lexInline(text, parser.defaults));
}

/** Render Markdown as React nodes; never trust author HTML or executable links. */
export default function Markdown({ content, className }: { content: string; className?: string }) {
  if (!content?.trim()) return null;
  return <div className={`markdown-content ${className ?? 'text-[var(--text-secondary)] leading-relaxed space-y-2'}`}>{renderTokens(parser.lexer(content))}</div>;
}
