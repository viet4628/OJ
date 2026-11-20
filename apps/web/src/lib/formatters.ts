/**
 * Lightweight, robust multi-language code formatters for Online Judge.
 * Formats C++, Python, Rust and Java directly in the browser,
 * and registers DocumentFormattingEditProviders in Monaco Editor.
 */

export interface FormatOptions {
  tabSize?: number;
  insertSpaces?: boolean;
}

/**
 * Counts unquoted and uncommented braces on a single line.
 */
function countBraces(line: string) {
  let opens = 0;
  let closes = 0;
  let inString: string | null = null;
  let escaped = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (inString) {
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = ch;
      continue;
    }
    // Single line comment
    if (ch === '/' && line[i + 1] === '/') {
      break;
    }
    if (ch === '{') opens++;
    if (ch === '}') closes++;
  }

  return { opens, closes };
}

/**
 * Normalizes common spacing patterns in C++ / C / Java / Rust expressions,
 * while preserving string literals.
 */
function normalizeLineSpacing(line: string): string {
  // If it's a preprocessor directive or comment, return as-is
  const trimmed = line.trim();
  if (trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
    return trimmed;
  }

  // Split line into code parts and string literal parts
  const parts: string[] = [];
  let inString: string | null = null;
  let escaped = false;
  let current = '';

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (escaped) {
      escaped = false;
      current += ch;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      current += ch;
      continue;
    }
    if (inString) {
      current += ch;
      if (ch === inString) {
        parts.push(current);
        current = '';
        inString = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      if (current) parts.push(current);
      current = ch;
      inString = ch;
      continue;
    }
    if (ch === '/' && line[i + 1] === '/') {
      if (current) parts.push(current);
      parts.push(line.slice(i));
      current = '';
      break;
    }
    current += ch;
  }
  if (current) parts.push(current);

  // Clean code portions only (not strings/comments)
  const formattedParts = parts.map((part) => {
    if (part.startsWith('"') || part.startsWith("'") || part.startsWith('//') || part.startsWith('/*')) {
      return part;
    }
    let p = part;
    // Normalize spaces around commas
    p = p.replace(/\s*,\s*/g, ', ');
    // Normalize semicolons
    p = p.replace(/\s*;\s*/g, '; ');
    p = p.replace(/;\s+$/g, ';');
    // Normalize for loop header: for (int i = 0; i < n; i++)
    p = p.replace(/\b(for|while|if|switch)\s*\(/g, '$1 (');
    // Normalize space before opening brace
    p = p.replace(/([^\s])\{/g, '$1 {');
    return p;
  });

  return formattedParts.join('').trimEnd();
}

/**
 * C++ / C / Java Beautifier
 */
export function formatCpp(code: string, tabSize = 4): string {
  const lines = code.split(/\r?\n/);
  const indentStr = ' '.repeat(tabSize);
  let indent = 0;
  const result: string[] = [];
  let lastWasBlank = false;

  for (let rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      if (!lastWasBlank && result.length > 0) {
        result.push('');
        lastWasBlank = true;
      }
      continue;
    }
    lastWasBlank = false;

    // Preprocessor directives always at column 0
    if (trimmed.startsWith('#')) {
      result.push(trimmed);
      continue;
    }

    const { opens, closes } = countBraces(trimmed);

    // If line starts with a closing brace (e.g. `}` or `} else {`), deduct 1 level for this line
    const startsWithClose = trimmed.startsWith('}');
    const isCaseOrDefault = trimmed.startsWith('case ') || trimmed.startsWith('default:');

    let currentIndent = indent;
    if (startsWithClose) {
      currentIndent = Math.max(0, indent - 1);
    } else if (isCaseOrDefault) {
      currentIndent = Math.max(0, indent - 1);
    }

    const cleanLine = normalizeLineSpacing(trimmed);
    result.push(indentStr.repeat(currentIndent) + cleanLine);

    // Next line indent level
    indent += opens - closes;
    if (indent < 0) indent = 0;
  }

  return result.join('\n').trim() + '\n';
}

/**
 * Python Beautifier (PEP 8 Indentation)
 */
export function formatPython(code: string, tabSize = 4): string {
  const lines = code.split(/\r?\n/);
  const indentStr = ' '.repeat(tabSize);
  let indent = 0;
  const result: string[] = [];
  let lastWasBlank = false;

  const dedentKeywords = /^(elif\b|else\s*:|except\b|finally\s*:)/;
  const blockStarters = /^(def\b|class\b|if\b|elif\b|else\s*:|for\b|while\b|try\s*:|except\b|finally\s*:|with\b)/;

  for (let rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      if (!lastWasBlank && result.length > 0) {
        result.push('');
        lastWasBlank = true;
      }
      continue;
    }
    lastWasBlank = false;

    // Check if current line dedents (e.g. elif, else, except, finally)
    let currentIndent = indent;
    if (dedentKeywords.test(trimmed)) {
      currentIndent = Math.max(0, indent - 1);
    }

    // Clean comma spacing: [1, 2, 3], foo(a, b)
    let cleanLine = trimmed.replace(/\s*,\s*/g, ', ');
    // Normalize colon spacing
    cleanLine = cleanLine.replace(/\s*:\s*$/, ':');

    result.push(indentStr.repeat(currentIndent) + cleanLine);

    // Check if this line opens a new block (ends with :)
    if (trimmed.endsWith(':') && blockStarters.test(trimmed)) {
      indent = currentIndent + 1;
    } else if (trimmed === 'return' || trimmed.startsWith('return ') || trimmed === 'pass' || trimmed === 'break' || trimmed === 'continue') {
      // Keep indent or let user handle nesting
    }
  }

  return result.join('\n').trim() + '\n';
}

/**
 * Rust Beautifier
 */
export function formatRust(code: string, tabSize = 4): string {
  return formatCpp(code, tabSize);
}

/**
 * Generic format dispatcher
 */
export function formatCode(code: string, language: string, tabSize = 4): string {
  const lang = language.toLowerCase();
  if (lang === 'cpp' || lang === 'c' || lang === 'java') {
    return formatCpp(code, tabSize);
  }
  if (lang === 'python' || lang === 'py') {
    return formatPython(code, tabSize);
  }
  if (lang === 'rust' || lang === 'rs') {
    return formatRust(code, tabSize);
  }
  // Generic indent/trim
  return formatCpp(code, tabSize);
}

/**
 * Register Monaco document formatting edit providers for OJ languages.
 */
export function registerFormatters(monacoInstance: any) {
  if (!monacoInstance || !monacoInstance.languages) return;

  const registeredLanguages = ['cpp', 'c', 'python', 'rust', 'java'];

  registeredLanguages.forEach((lang) => {
    try {
      monacoInstance.languages.registerDocumentFormattingEditProvider(lang, {
        provideDocumentFormattingEdits(model: any, options: any) {
          const text = model.getValue();
          const tabSize = options.tabSize || (lang === 'python' ? 4 : 4);
          const formatted = formatCode(text, lang, tabSize);

          if (formatted === text) return [];

          return [
            {
              range: model.getFullModelRange(),
              text: formatted,
            },
          ];
        },
      });
    } catch (err) {
      // Ignore if already registered
      console.warn(`[Formatters] Could not register formatting provider for ${lang}:`, err);
    }
  });
}
