import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common'
import { Response } from 'express'

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const status = exception.getStatus()
    const body = exception.getResponse()

    // Erros de validação Zod já vêm estruturados como { statusCode, error, messages }
    if (exception instanceof BadRequestException && typeof body === 'object') {
      return response.status(status).json(body)
    }

    // Outros HttpExceptions
    return response.status(status).json({
      statusCode: status,
      error: typeof body === 'string' ? body : (body as any).error ?? 'Error',
      message: typeof body === 'string' ? body : (body as any).message,
    })
  }
}
