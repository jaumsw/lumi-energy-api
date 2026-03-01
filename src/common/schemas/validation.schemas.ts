import { z } from 'zod'

// ===================================
// 📎 HELPERS
// ===================================

/** Valida formato YYYY-MM-DD e que é uma data real */
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido. Use YYYY-MM-DD (ex: 2025-01-31)')
  .refine((v) => !isNaN(Date.parse(v)), { message: 'Data inválida' })

/** Número de cliente: somente dígitos, 5–20 chars */
const numeroCliente = z
  .string()
  .regex(/^\d{5,20}$/, 'numeroCliente deve conter apenas dígitos (5 a 20 caracteres)')

/** Mês de referência: MMM/YYYY (ex: JAN/2025) */
const mesReferencia = z
  .string()
  .regex(
    /^(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\/\d{4}$/,
    'mesReferencia deve seguir o formato MÊS/ANO (ex: JAN/2025)',
  )

// ===================================
// 📤 INVOICES
// ===================================

export const listInvoicesQuerySchema = z
  .object({
    numeroCliente: numeroCliente.optional(),
    mesReferencia: mesReferencia.optional(),
  })
  .strict()

export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>

// ===================================
// 📊 DASHBOARD
// ===================================

export const dashboardQuerySchema = z
  .object({
    cliente: numeroCliente.optional(),
    dataInicio: dateString.optional(),
    dataFim: dateString.optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.dataInicio && data.dataFim) {
        return new Date(data.dataInicio) <= new Date(data.dataFim)
      }
      return true
    },
    { message: 'dataInicio não pode ser posterior a dataFim', path: ['dataInicio'] },
  )

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>
