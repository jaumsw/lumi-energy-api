import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common'
import type { ZodSchema } from 'zod'

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata) {
    const result = this.schema.safeParse(value)

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'root',
        message: issue.message,
      }))

      throw new BadRequestException({
        statusCode: 400,
        error: 'Validation Error',
        messages: errors,
      })
    }

    return result.data
  }
}
