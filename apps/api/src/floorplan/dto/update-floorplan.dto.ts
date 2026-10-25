import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { IsFloor } from '../../common/is-floor';

export class UpdateFloorPlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  imageUrl?: string | null;

  @IsNumber()
  @Min(1)
  width!: number;

  @IsNumber()
  @Min(1)
  height!: number;

  @IsFloor()
  floor?: number;
}
