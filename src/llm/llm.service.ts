import {
    Injectable,
    Logger,
} from '@nestjs/common'
import { createHash } from 'crypto'
import { GoogleGenAI } from '@google/genai'
import { llmInvoiceSchema, LlmInvoice } from '../invoices/schemas/llm-invoice.schema'
import { ConfigService } from '@nestjs/config'
import { AppError } from '../common/errors/app.error'

const MOCK_INVOICES: LlmInvoice[] = [
    {
        numero_cliente: '7005400387',
        mes_referencia: 'JAN/2025',
        energia_eletrica:       { kwh: 50,  valor: 44.93  },
        energia_sceee:          { kwh: 476, valor: 215.02 },
        energia_compensada_gdi: { kwh: 476, valor: -215.02 },
        contrib_ilum_publica: 49.43,
    },
    {
        numero_cliente: '7005400387',
        mes_referencia: 'FEV/2025',
        energia_eletrica:       { kwh: 50,  valor: 44.93  },
        energia_sceee:          { kwh: 502, valor: 226.78 },
        energia_compensada_gdi: { kwh: 502, valor: -226.78 },
        contrib_ilum_publica: 49.43,
    },
    {
        numero_cliente: '7005400387',
        mes_referencia: 'MAR/2025',
        energia_eletrica:       { kwh: 50,  valor: 44.93  },
        energia_sceee:          { kwh: 489, valor: 220.87 },
        energia_compensada_gdi: { kwh: 489, valor: -220.87 },
        contrib_ilum_publica: 49.43,
    },
    {
        numero_cliente: '7005400387',
        mes_referencia: 'ABR/2025',
        energia_eletrica:       { kwh: 50,  valor: 44.93  },
        energia_sceee:          { kwh: 460, valor: 207.63 },
        energia_compensada_gdi: { kwh: 460, valor: -207.63 },
        contrib_ilum_publica: 49.43,
    },
    {
        numero_cliente: '7005400387',
        mes_referencia: 'MAI/2025',
        energia_eletrica:       { kwh: 50,  valor: 44.93  },
        energia_sceee:          { kwh: 414, valor: 186.88 },
        energia_compensada_gdi: { kwh: 414, valor: -186.88 },
        contrib_ilum_publica: 49.43,
    },
    {
        numero_cliente: '7005400387',
        mes_referencia: 'JUN/2025',
        energia_eletrica:       { kwh: 50,  valor: 44.93  },
        energia_sceee:          { kwh: 388, valor: 175.13 },
        energia_compensada_gdi: { kwh: 388, valor: -175.13 },
        contrib_ilum_publica: 49.43,
    },
    {
        numero_cliente: '7005400387',
        mes_referencia: 'JUL/2025',
        energia_eletrica:       { kwh: 50,  valor: 44.93  },
        energia_sceee:          { kwh: 401, valor: 181.01 },
        energia_compensada_gdi: { kwh: 401, valor: -181.01 },
        contrib_ilum_publica: 49.43,
    },
    {
        numero_cliente: '7005400387',
        mes_referencia: 'AGO/2025',
        energia_eletrica:       { kwh: 50,  valor: 44.93  },
        energia_sceee:          { kwh: 423, valor: 190.94 },
        energia_compensada_gdi: { kwh: 423, valor: -190.94 },
        contrib_ilum_publica: 49.43,
    },
    {
        numero_cliente: '7005400387',
        mes_referencia: 'SET/2025',
        energia_eletrica:       { kwh: 50,  valor: 44.93  },
        energia_sceee:          { kwh: 445, valor: 200.87 },
        energia_compensada_gdi: { kwh: 445, valor: -200.87 },
        contrib_ilum_publica: 49.43,
    },
    {
        numero_cliente: '7005400387',
        mes_referencia: 'OUT/2025',
        energia_eletrica:       { kwh: 50,  valor: 44.93  },
        energia_sceee:          { kwh: 461, valor: 208.08 },
        energia_compensada_gdi: { kwh: 461, valor: -208.08 },
        contrib_ilum_publica: 49.43,
    },
    {
        numero_cliente: '7005400387',
        mes_referencia: 'NOV/2025',
        energia_eletrica:       { kwh: 50,  valor: 44.93  },
        energia_sceee:          { kwh: 478, valor: 215.72 },
        energia_compensada_gdi: { kwh: 478, valor: -215.72 },
        contrib_ilum_publica: 49.43,
    },
    {
        numero_cliente: '7005400387',
        mes_referencia: 'DEZ/2025',
        energia_eletrica:       { kwh: 50,  valor: 44.93  },
        energia_sceee:          { kwh: 492, valor: 221.97 },
        energia_compensada_gdi: { kwh: 492, valor: -221.97 },
        contrib_ilum_publica: 49.43,
    },
]

@Injectable()
export class LlmService {
    private readonly logger = new Logger(LlmService.name)
    private gemini: GoogleGenAI

    constructor(private configService: ConfigService) {
        const useRealLlm = this.configService.get<string>('USE_REAL_LLM') === 'true'

        if (useRealLlm) {
            const apiKey = this.configService.get<string>('GEMINI_API_KEY')

            if (!apiKey) {
                throw new Error('GEMINI_API_KEY not defined')
            }

            this.gemini = new GoogleGenAI({ apiKey })
        }
    }

    /**
     * Tenta extrair mês e ano do nome do arquivo no padrão XXXXXXX-MM-AAAA.pdf
     * Ex: 3001116735-04-2024.pdf → ABR/2024
     * Se não conseguir, cai no fallback por hash do conteúdo.
     */
    private selectMock(fileBuffer: Buffer, filename: string): LlmInvoice {
        const MONTH_MAP: Record<string, string> = {
            '01': 'JAN', '02': 'FEV', '03': 'MAR', '04': 'ABR',
            '05': 'MAI', '06': 'JUN', '07': 'JUL', '08': 'AGO',
            '09': 'SET', '10': 'OUT', '11': 'NOV', '12': 'DEZ',
        }

        // Padrão: qualquer-coisa-MM-AAAA.pdf (ignora tudo antes do último par MM-AAAA)
        const match = filename.match(/-(\d{2})-(\d{4})(?:\.pdf)?$/i)

        if (match) {
            const [, mm, yyyy] = match
            const mesAbrev = MONTH_MAP[mm]
            if (mesAbrev) {
                const mesReferencia = `${mesAbrev}/${yyyy}`
                const found = MOCK_INVOICES.find(m => m.mes_referencia === mesReferencia)
                if (found) return found

                // Mês/ano não está nos mocks — clona o mais próximo trocando o mes_referencia
                const fallback = { ...MOCK_INVOICES[0], mes_referencia: mesReferencia }
                return fallback
            }
        }

        // Fallback: hash do conteúdo
        const hash = createHash('md5').update(fileBuffer).digest('hex')
        const index = parseInt(hash.slice(0, 8), 16) % MOCK_INVOICES.length
        return MOCK_INVOICES[index]
    }

    async extractDataFromPdf(fileBuffer: Buffer, filename = ''): Promise<LlmInvoice> {
        const useRealLlm = this.configService.get<string>('USE_REAL_LLM') === 'true'

        if (!useRealLlm) {
            const mock = this.selectMock(fileBuffer, filename)
            this.logger.debug(`[MOCK] arquivo="${filename}" → ${mock.numero_cliente} ${mock.mes_referencia}`)
            return mock
        }

        try {
            // 1️⃣ Chamada multimodal com PDF inline
            const response = await this.gemini.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: [
                    {
                        role: 'user',
                        parts: [
                            {
                                inlineData: {
                                    mimeType: 'application/pdf',
                                    data: fileBuffer.toString('base64'),
                                },
                            },
                            {
                                text: `
Você é um extrator de dados de faturas de energia.
Retorne APENAS JSON válido, sem markdown, sem blocos de código, sem explicações.

Extraia exatamente os seguintes campos:

{
  "numero_cliente": string,
  "mes_referencia": string,
  "energia_eletrica": { "kwh": number, "valor": number },
  "energia_sceee": { "kwh": number, "valor": number },
  "energia_compensada_gdi": { "kwh": number, "valor": number },
  "contrib_ilum_publica": number
}

Se algum campo não existir, retorne null.
                                `,
                            },
                        ],
                    },
                ],
            })

            const rawText = response.text

            if (!rawText) {
                throw AppError.badGateway(
                    'O modelo LLM retornou uma resposta vazia',
                    'LLM_EMPTY_RESPONSE',
                )
            }

            // 2️⃣ Remover possível markdown residual (```json ... ```)
            const cleaned = rawText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()

            let parsedJson: unknown
            try {
                parsedJson = JSON.parse(cleaned)
            } catch {
                throw AppError.badGateway(
                    'O modelo LLM retornou um JSON inválido',
                    'LLM_INVALID_JSON',
                )
            }

            // 3️⃣ Validar com Zod
            const validated = llmInvoiceSchema.safeParse(parsedJson)

            if (!validated.success) {
                this.logger.error('LLM response failed Zod validation', validated.error)
                throw AppError.badGateway(
                    'O modelo LLM retornou dados com estrutura inválida',
                    'LLM_INVALID_STRUCTURE',
                )
            }

            return validated.data
        } catch (error) {
            // Re-lança AppError sem logar novamente
            if (error instanceof AppError) throw error

            // Erro de quota/rate limit do Gemini
            if ((error as any)?.status === 429) {
                const retryMatch = (error as any)?.message?.match(/retry in (\d+)s/i)
                const retryMsg = retryMatch ? ` Tente novamente em ${retryMatch[1]} segundos.` : ''
                throw AppError.tooManyRequests(
                    `Quota da API Gemini excedida.${retryMsg}`,
                    'LLM_QUOTA_EXCEEDED',
                )
            }

            this.logger.error('Unexpected LLM error', error)
            throw AppError.badGateway(
                'Falha na comunicação com o serviço de LLM',
                'LLM_UNAVAILABLE',
            )
        }
    }
}