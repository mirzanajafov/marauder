import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateIf } from 'class-validator';

export class UpdateFloorPlanDto {
  @IsOptional()
  @ValidateIf((o) => o.imageUrl !== null)
  @IsString()
  @MaxLength(2000)
  imageUrl?: string | null;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  width!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  height!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  floor?: number;
}
