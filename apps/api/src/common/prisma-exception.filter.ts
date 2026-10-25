import { ArgumentsHost, Catch, ConflictException, HttpException, NotFoundException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    super.catch(toHttpException(error) ?? error, host);
  }
}

function toHttpException(error: Prisma.PrismaClientKnownRequestError): HttpException | null {
  const model = typeof error.meta?.modelName === 'string' ? error.meta.modelName.toLowerCase() : 'record';
  switch (error.code) {
    case 'P2002': {
      const fields = Array.isArray(error.meta?.target) ? error.meta.target.join(', ') : 'key';
      return new ConflictException(`${model} with this ${fields} already exists`);
    }
    case 'P2025':
      return new NotFoundException(`${model} not found`);
    default:
      return null;
  }
}
