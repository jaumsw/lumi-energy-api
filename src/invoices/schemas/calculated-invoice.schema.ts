import { z } from 'zod'

export const calculatedInvoiceSchema = z.object({
  consumoEnergiaKwh: z.number(),
  energiaCompensadaFinalKwh: z.number(),
  valorTotalSemGD: z.number(),
  economiaGD: z.number(),
})

export type CalculatedInvoice = z.infer<typeof calculatedInvoiceSchema>