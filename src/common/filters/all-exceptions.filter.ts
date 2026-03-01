import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { AppError } from '../errors/app.error'

interface ErrorResponse {
  statusCode: number
  code: string
  message: string | string[]
  messages?: { field: string; message: string }[]
  path: string
  timestamp: string
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    const errorResponse = this.buildResponse(exception, request)

    // Loga 5xx como error, 4xx como warn
    if (errorResponse.statusCode >= 500) {
      this.logger.error(
        `[${errorResponse.code}] ${errorResponse.statusCode} ${request.method} ${request.url} — ${JSON.stringify(errorResponse.message)}`,
        exception instanceof Error ? exception.stack : undefined,
      )
    } else {
      this.logger.warn(
        `[${errorResponse.code}] ${errorResponse.statusCode} ${request.method} ${request.url} — ${JSON.stringify(errorResponse.message)}`,
      )
    }

    response.status(errorResponse.statusCode).json(errorResponse)
  }

  private buildResponse(exception: unknown, request: Request): ErrorResponse {
    const base = {
      path: request.url,
      timestamp: new Date().toISOString(),
    }

    // ─── Erros de validação Zod (BadRequestException estruturado) ───────────
    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const body = exception.getResponse() as any

      // Vem do ZodValidationPipe: { statusCode, error, messages: [{field, message}] }
      if (body?.messages && Array.isArray(body.messages)) {
        return {
          ...base,
          statusCode: status,
          code: 'VALIDATION_ERROR',
          message: 'Dados de entrada inválidos',
          messages: body.messages,
        }
      }

      return {
        ...base,
        statusCode: status,
        code: this.httpStatusToCode(status),
        message: typeof body === 'string' ? body : body?.message ?? body?.error ?? 'Erro desconhecido',
      }
    }

    // ─── AppError (erros de domínio) ────────────────────────────────────────
    if (exception instanceof AppError) {
      return {
        ...base,
        statusCode: exception.statusCode,
        code: exception.code,
        message: exception.message,
      }
    }

    // ─── Erros do Prisma ─────────────────────────────────────────────────────
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.handlePrismaError(exception, base)
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        ...base,
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'DATABASE_VALIDATION_ERROR',
        message: 'Dados inválidos para operação no banco de dados',
      }
    }

    // ─── Erro genérico ───────────────────────────────────────────────────────
    return {
      ...base,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Ocorreu um erro interno. Tente novamente mais tarde.',
    }
  }

  private handlePrismaError(
    error: Prisma.PrismaClientKnownRequestError,
    base: Pick<ErrorResponse, 'path' | 'timestamp'>,
  ): ErrorResponse {
    switch (error.code) {
      case 'P2002': {
        const fields = (error.meta?.target as string[])?.join(', ') ?? 'campo'
        return {
          ...base,
          statusCode: HttpStatus.CONFLICT,
          code: 'DUPLICATE_ENTRY',
          message: `Já existe um registro com o mesmo ${fields}`,
        }
      }
      case 'P2025':
        return {
          ...base,
          statusCode: HttpStatus.NOT_FOUND,
          code: 'RECORD_NOT_FOUND',
          message: 'Registro não encontrado',
        }
      case 'P2003':
        return {
          ...base,
          statusCode: HttpStatus.BAD_REQUEST,
          code: 'FOREIGN_KEY_VIOLATION',
          message: 'Referência inválida: registro relacionado não encontrado',
        }
      default:
        return {
          ...base,
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          code: 'DATABASE_ERROR',
          message: 'Erro ao realizar operação no banco de dados',
        }
    }
  }

  private httpStatusToCode(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      429: 'RATE_LIMITED',
      500: 'INTERNAL_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
    }
    return map[status] ?? 'HTTP_ERROR'
  }
}
