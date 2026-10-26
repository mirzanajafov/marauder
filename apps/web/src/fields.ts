const DECIMAL = /^-?(\d+[.,]?\d*|[.,]\d+)(e[-+]?\d+)?$/i;

export function parseNumber(label: string, text: string): number {
  const typed = text.trim();
  const value = Number(typed.replace(',', '.'));
  if (!DECIMAL.test(typed) || !Number.isFinite(value)) {
    throw new Error(`${label} must be a number`);
  }
  return value;
}
