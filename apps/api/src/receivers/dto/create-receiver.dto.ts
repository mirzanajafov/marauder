import { RECEIVER_ID_PATTERN } from '@marauder/shared';
import { IsNumber, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { IsFloor } from '../../common/is-floor';

export class CreateReceiverDto {
  @IsString()
  @Matches(RECEIVER_ID_PATTERN, {
    message:
      '$property must be 1 to 40 letters, digits, dots, colons, dashes or underscores, starting with a letter or digit',
  })
  id!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;

  @IsFloor()
  floor?: number;
}
