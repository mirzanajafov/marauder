import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateReceiverDto } from './create-receiver.dto';

export class UpdateReceiverDto extends PartialType(OmitType(CreateReceiverDto, ['id'] as const)) {}
