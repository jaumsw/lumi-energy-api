import { z } from 'zod'

export const energiaSchema = z.object({
  kwh: z.number(),
  valor: z.number(),
})

export const llmInvoiceSchema = z.object({
  numero_cliente: z.string(),
  mes_referencia: z.string(),

  energia_eletrica: energiaSchema,
  energia_sceee: energiaSchema,
  energia_compensada_gdi: energiaSchema,

  contrib_ilum_publica: z.number(),
})

export type LlmInvoice = z.infer<typeof llmInvoiceSchema>