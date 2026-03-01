import {
  Controller,
  Post,
  Get,
  UploadedFile,
  UseInterceptors,
  Query,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { InvoicesService } from './invoices.service'
import { File } from 'multer'
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { listInvoicesQuerySchema } from '../common/schemas/validation.schemas'
import type { ListInvoicesQuery } from '../common/schemas/validation.schemas'

@ApiTags('invoices')
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  // ===============================
  // 📤 UPLOAD DE FATURA
  // ===============================
  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          return cb(new BadRequestException('Only PDF files are allowed'), false)
        }
        cb(null, true)
      },
    }),
  )
  @ApiOperation({
    summary: 'Upload de fatura PDF',
    description:
      'Envia um arquivo PDF de fatura de energia para extracao de dados via LLM e persistencia no banco.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Arquivo PDF da fatura (max. 5MB)',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Fatura processada e salva com sucesso.' })
  @ApiResponse({ status: 400, description: 'Arquivo nao enviado ou formato invalido.' })
  async uploadInvoice(@UploadedFile() file: File) {
    if (!file) {
      throw new BadRequestException('File is required')
    }

    return this.invoicesService.processInvoice(file)
  }

  // ===============================
  // 📚 LISTAGEM DE FATURAS
  // ===============================
  @Get()
  @ApiOperation({
    summary: 'Listar faturas',
    description:
      'Retorna todas as faturas. Pode filtrar por numero do cliente e/ou mes de referencia.',
  })
  @ApiQuery({ name: 'numeroCliente', required: false, description: 'Numero do cliente (ex: 7005400387)' })
  @ApiQuery({ name: 'mesReferencia', required: false, description: 'Mes de referencia (ex: JAN/2025)' })
  @ApiResponse({ status: 200, description: 'Lista de faturas retornada com sucesso.' })
  @ApiResponse({ status: 400, description: 'Parametros de query invalidos.' })
  async listInvoices(
    @Query(new ZodValidationPipe(listInvoicesQuerySchema)) query: ListInvoicesQuery,
  ) {
    return this.invoicesService.findAll(query)
  }
}
