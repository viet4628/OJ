import type { SupportedLanguage } from '../constants/languages';

const key = (scope: string, problemId: string, language: SupportedLanguage) =>
  `codejudge:draft:${scope}:${problemId}:${language}`;

export function readCodeDraft(scope: string, problemId: string, language: SupportedLanguage): string | null {
  try { return localStorage.getItem(key(scope, problemId, language)); }
  catch { return null; }
}

export function saveCodeDraft(scope: string, problemId: string, language: SupportedLanguage, code: string | null): void {
  try {
    if (code === null) localStorage.removeItem(key(scope, problemId, language));
    else localStorage.setItem(key(scope, problemId, language), code);
  } catch { /* Keep the editor usable when browser storage is unavailable. */ }
}
