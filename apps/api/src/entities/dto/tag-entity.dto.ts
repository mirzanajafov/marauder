import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class TagEntityDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  kind?: string;
}
