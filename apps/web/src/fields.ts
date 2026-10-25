const DECIMAL = /^\s*-?\d+(\.\d+)?\s*$/;

export function parseNumber(label: string, text: string): number {
  if (!DECIMAL.test(text)) {
    throw new Error(`${label} must be a number`);
  }
  return Number(text);
}
