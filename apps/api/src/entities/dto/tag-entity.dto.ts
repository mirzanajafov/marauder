import { IsString, Matches, MaxLength } from 'class-validator';
import { SkipIfUndefined } from '../../common/skip-if-undefined';

export class TagEntityDto {
  @IsString()
  @Matches(/\S/, { message: '$property must not be blank' })
  @MaxLength(80)
  name!: string;

  @SkipIfUndefined()
  @IsString()
  @Matches(/\S/, { message: '$property must not be blank' })
  @MaxLength(40)
  kind?: string;
}
