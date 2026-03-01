import {
    Injectable,
    Logger,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { LlmService } from '../llm/llm.service'
import { LlmInvoice } from './schemas/llm-invoice.schema'
import { File } from 'multer'
import { AppError } from '../common/errors/app.error'
import { Prisma } from '@prisma/client'

@Injectable()
export class InvoicesService {
    private readonly logger = new Logger(InvoicesService.name)

    constructor(
        private readonly prisma: PrismaService,
        private readonly llmService: LlmService,
    ) { }

    async processInvoice(file: File) {
        if (!file) {
            throw AppError.badRequest('Arquivo é obrigatório', 'FILE_REQUIRED')
        }

        if (file.mimetype !== 'application/pdf') {
            throw AppError.badRequest('Apenas arquivos PDF são permitidos', 'INVALID_FILE_TYPE')
        }

        // 1️⃣ Extrair dados via LLM
        const extracted = await this.llmService.extractDataFromPdf(
            file.buffer,
            file.originalname,
        )

        // 2️⃣ Calcular métricas
        const calculated = this.calculateMetrics(extracted)

        // 3️⃣ Persistir no banco
        try {
            const saved = await this.prisma.invoice.create({
                data: {
                    numeroCliente: extracted.numero_cliente,
                    mesReferencia: extracted.mes_referencia,

                    energiaEletricaKwh: extracted.energia_eletrica.kwh,
                    energiaEletricaValor: extracted.energia_eletrica.valor,

                    energiaSceeeKwh: extracted.energia_sceee.kwh,
                    energiaSceeeValor: extracted.energia_sceee.valor,

                    energiaCompensadaKwh: extracted.energia_compensada_gdi.kwh,
                    energiaCompensadaValor: extracted.energia_compensada_gdi.valor,

                    contribuicaoIlumPublica: extracted.contrib_ilum_publica,

                    consumoEnergiaKwh: calculated.consumoEnergiaKwh,
                    energiaCompensadaFinalKwh: calculated.energiaCompensadaFinalKwh,
                    valorTotalSemGD: calculated.valorTotalSemGD,
                    economiaGD: calculated.economiaGD,
                },
            })

            return saved
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                // P2002 = unique constraint — fatura duplicada
                if (error.code === 'P2002') {
                    throw AppError.conflict(
                        'Já existe uma fatura cadastrada para este cliente e mês de referência',
                        'INVOICE_ALREADY_EXISTS',
                    )
                }
            }

            this.logger.error('Failed to save invoice', error)
            throw AppError.internal(
                'Erro ao salvar a fatura no banco de dados',
                'INVOICE_SAVE_FAILED',
            )
        }
    }

    calculateMetrics(data: LlmInvoice) {
        const consumoEnergiaKwh =
            data.energia_eletrica.kwh +
            data.energia_sceee.kwh

        const energiaCompensadaFinalKwh =
            data.energia_compensada_gdi.kwh

        const valorTotalSemGD =
            data.energia_eletrica.valor +
            data.energia_sceee.valor +
            data.contrib_ilum_publica

        const economiaGD =
            data.energia_compensada_gdi.valor

        return {
            consumoEnergiaKwh,
            energiaCompensadaFinalKwh,
            valorTotalSemGD,
            economiaGD,
        }
    }

    async findAll(filters?: {
        numeroCliente?: string
        mesReferencia?: string
    }) {
        return this.prisma.invoice.findMany({
            where: {
                numeroCliente: filters?.numeroCliente,
                mesReferencia: filters?.mesReferencia,
            },
            orderBy: {
                createdAt: 'desc',
            },
        })
    }
}