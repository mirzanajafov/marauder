import { parseNumber } from '../src/fields';

describe('parseNumber', () => {
  it.each([
    ['1.5', 1.5],
    [' -2 ', -2],
    ['0', 0],
  ])('reads %p as %p', (text, value) => {
    expect(parseNumber('x', text)).toBe(value);
  });

  it.each(['', '   ', 'abc', '1,5', 'Infinity', '0x10', '0b11', '1e3', '.5'])(
    'refuses %p and names the field',
    (text) => {
      expect(() => parseNumber('x', text)).toThrow('x must be a number');
    },
  );
});
