import { HttpStatus } from '@nestjs/common'

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR,
    public readonly code: string = 'INTERNAL_ERROR',
  ) {
    super(message)
    this.name = 'AppError'
    Object.setPrototypeOf(this, new.target.prototype)
  }

  static badRequest(message: string, code = 'BAD_REQUEST') {
    return new AppError(message, HttpStatus.BAD_REQUEST, code)
  }

  static notFound(message: string, code = 'NOT_FOUND') {
    return new AppError(message, HttpStatus.NOT_FOUND, code)
  }

  static conflict(message: string, code = 'CONFLICT') {
    return new AppError(message, HttpStatus.CONFLICT, code)
  }

  static tooManyRequests(message: string, code = 'RATE_LIMITED') {
    return new AppError(message, HttpStatus.TOO_MANY_REQUESTS, code)
  }

  static badGateway(message: string, code = 'BAD_GATEWAY') {
    return new AppError(message, HttpStatus.BAD_GATEWAY, code)
  }

  static internal(message: string, code = 'INTERNAL_ERROR') {
    return new AppError(message, HttpStatus.INTERNAL_SERVER_ERROR, code)
  }
}
