const DECIMAL = /^-?(\d+[.,]?\d*|[.,]\d+)(e[-+]?\d+)?$/i;
const THOUSANDS = /^-?[1-9]\d{0,2},\d{3}$/;

export function parseNumber(label: string, text: string): number {
  const typed = text.trim();
  if (THOUSANDS.test(typed)) {
    throw new Error(`${label} could be read two ways: use a dot for decimals and no separator for thousands`);
  }
  const value = Number(typed.replace(',', '.'));
  if (!DECIMAL.test(typed) || !Number.isFinite(value)) {
    throw new Error(`${label} must be a number`);
  }
  return value;
}
