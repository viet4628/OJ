export type SupportedLanguage = 'cpp' | 'python' | 'rust';

export interface LanguageOption {
  value: SupportedLanguage;
  label: string;
  monaco: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { value: 'cpp', label: 'C++ (GCC 12.2)', monaco: 'cpp' },
  { value: 'python', label: 'Python 3', monaco: 'python' },
  { value: 'rust', label: 'Rust', monaco: 'rust' },
];

export const STARTER_CODES: Record<SupportedLanguage, string> = {
  cpp: `#include <iostream>
using namespace std;

int main() {
    // Tối ưu tốc độ cho cin và cout
    ios_base::sync_with_stdio(false);
    cin.tie(nullptr);

    // TODO: code here
    return 0;
}`,
  python: `import sys

def solve():
    # TODO: code here
    pass

if __name__ == '__main__':
    solve()
`,
  rust: `fn main() {
    // TODO: code here
}`,
};

export function getStarterCode(problem: { starter_codes?: Partial<Record<SupportedLanguage, string>> } | null, language: SupportedLanguage): string {
  return problem?.starter_codes?.[language]?.trim() ? problem.starter_codes[language]! : STARTER_CODES[language];
}

export const normOutput = (s: string): string =>
  String(s || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trimEnd();

