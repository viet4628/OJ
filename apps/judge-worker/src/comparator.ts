/**
 * Compares actual output string with expected output string.
 * Strips trailing spaces per line and trailing newlines.
 */
export function compareOutput(actual: string, expected: string): boolean {
  const normActual = normalizeString(actual);
  const normExpected = normalizeString(expected);

  return normActual === normExpected;
}

function normalizeString(str: string): string {
  return str
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trimEnd();
}
