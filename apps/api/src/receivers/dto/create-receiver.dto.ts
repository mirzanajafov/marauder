import { IsNumber, IsString, MaxLength, MinLength } from 'class-validator';
import { IsFloor } from '../../common/is-floor';

export class CreateReceiverDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
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
