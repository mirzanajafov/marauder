import { parseNumber } from './fields';

describe('parseNumber', () => {
  it.each([
    ['1.5', 1.5],
    [' -2 ', -2],
    ['0', 0],
    ['12,5', 12.5],
    ['.5', 0.5],
    ['5.', 5],
    ['1e-7', 1e-7],
    ['-.5', -0.5],
    [',5', 0.5],
    ['5,', 5],
    ['12,50', 12.5],
  ])('reads %p as %p', (text, value) => {
    expect(parseNumber('x', text)).toBe(value);
  });

  it.each(['', '   ', '-', '.', 'abc', '1.2.3', '1,2,3', 'Infinity', '0x10', '0b11', '1e999', '1,000', '-12,500'])(
    'refuses %p and names the field',
    (text) => {
      expect(() => parseNumber('x', text)).toThrow('x must be a number');
    },
  );
});
