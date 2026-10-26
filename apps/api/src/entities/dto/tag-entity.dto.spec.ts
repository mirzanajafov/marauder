import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { TagEntityDto } from './tag-entity.dto';

function invalidFields(body: Record<string, unknown>): string[] {
  return validateSync(plainToInstance(TagEntityDto, body)).map((error) => error.property);
}

describe('TagEntityDto', () => {
  it('takes a name with or without a kind', () => {
    expect(invalidFields({ name: 'Ada' })).toEqual([]);
    expect(invalidFields({ name: 'Ada', kind: 'person' })).toEqual([]);
  });

  it.each([null, '', '   '])('refuses %p as a kind instead of storing it', (kind) => {
    expect(invalidFields({ name: 'Ada', kind })).toEqual(['kind']);
  });

  it.each(['', '   '])('refuses %p as a name', (name) => {
    expect(invalidFields({ name })).toEqual(['name']);
  });
});
