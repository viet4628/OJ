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
    // Đọc dữ liệu từ tiêu chuẩn đầu vào
    long long a, b;
    if (cin >> a >> b) {
        // In ra kết quả
        cout << a + b << endl;
    }
    return 0;
}`,
  python: `import sys

def solve():
    # Đọc tất cả dữ liệu từ STDIN
    input_data = sys.stdin.read().split()
    if len(input_data) >= 2:
        a = int(input_data[0])
        b = int(input_data[1])
        print(a + b)

if __name__ == '__main__':
    solve()
`,
  rust: `use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let nums: Vec<i64> = input
        .split_whitespace()
        .map(|s| s.parse().unwrap())
        .collect();
    if nums.len() >= 2 {
        println!("{}", nums[0] + nums[1]);
    }
}`,
};

export const normOutput = (s: string): string =>
  String(s || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trimEnd();

