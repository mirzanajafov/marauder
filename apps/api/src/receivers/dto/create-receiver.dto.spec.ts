import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateReceiverDto } from './create-receiver.dto';

function invalidFields(body: Record<string, unknown>): string[] {
  const receiver = plainToInstance(CreateReceiverDto, { id: 'rx', name: 'Receiver', x: 1, y: 2, ...body });
  return validateSync(receiver).map((error) => error.property);
}

describe('CreateReceiverDto', () => {
  it.each([-10, 0, 200, undefined])('accepts floor %p', (floor) => {
    expect(invalidFields({ floor })).toEqual([]);
  });

  it.each([-11, 201, 1.5, null, true, '1'])('refuses floor %p', (floor) => {
    expect(invalidFields({ floor })).toEqual(['floor']);
  });

  it.each(['R1', 'hall-a.2', 'aa:bb:cc'])('accepts %p as an id', (id) => {
    expect(invalidFields({ id })).toEqual([]);
  });

  it.each(['', 'Hall A', 'R1/signals', 'R+', '.', '..', '-R1', 'R'.repeat(41)])(
    'refuses %p as an id, which has to work in a URL path and an MQTT topic',
    (id) => {
      expect(invalidFields({ id })).toEqual(['id']);
    },
  );
});
