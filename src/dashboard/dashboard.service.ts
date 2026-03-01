import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AppError } from '../common/errors/app.error'

export interface DashboardFilter {
  cliente?: string
  dataInicio?: string
  dataFim?: string
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validates business rules for the dashboard filter.
   * Throws AppError.badRequest if dataFim < dataInicio.
   */
  private validateFilter(filter: DashboardFilter): void {
    if (filter.dataInicio && filter.dataFim) {
      const inicio = new Date(filter.dataInicio)
      const fim = new Date(filter.dataFim)
      if (fim < inicio) {
        throw AppError.badRequest(
          'dataFim não pode ser anterior a dataInicio',
          'INVALID_DATE_RANGE',
        )
      }
    }
  }

  private buildWhere(filter: DashboardFilter) {
    const where: Record<string, any> = {}

    if (filter.cliente) {
      where.numeroCliente = filter.cliente
    }

    if (filter.dataInicio || filter.dataFim) {
      where.createdAt = {}

      if (filter.dataInicio) {
        where.createdAt.gte = new Date(filter.dataInicio)
      }

      if (filter.dataFim) {
        // Include the entire end day (up to 23:59:59.999)
        const fim = new Date(filter.dataFim)
        fim.setUTCHours(23, 59, 59, 999)
        where.createdAt.lte = fim
      }
    }

    return where
  }

  async getEnergiaResumo(filter: DashboardFilter) {
    this.validateFilter(filter)

    this.logger.log(
      `Gerando resumo de energia | cliente=${filter.cliente ?? 'todos'} | periodo=${filter.dataInicio ?? '*'} → ${filter.dataFim ?? '*'}`,
    )

    const result = await this.prisma.invoice.aggregate({
      where: this.buildWhere(filter),
      _sum: {
        consumoEnergiaKwh: true,
        energiaCompensadaFinalKwh: true,
      },
    })

    const resumo = {
      consumoEnergiaKwh: result._sum.consumoEnergiaKwh ?? 0,
      energiaCompensadaKwh: result._sum.energiaCompensadaFinalKwh ?? 0,
    }

    this.logger.log(
      `Resumo de energia calculado | consumo=${resumo.consumoEnergiaKwh} kWh | compensada=${resumo.energiaCompensadaKwh} kWh`,
    )

    return resumo
  }

  async getFinanceiroResumo(filter: DashboardFilter) {
    this.validateFilter(filter)

    this.logger.log(
      `Gerando resumo financeiro | cliente=${filter.cliente ?? 'todos'} | periodo=${filter.dataInicio ?? '*'} → ${filter.dataFim ?? '*'}`,
    )

    const result = await this.prisma.invoice.aggregate({
      where: this.buildWhere(filter),
      _sum: {
        valorTotalSemGD: true,
        economiaGD: true,
      },
    })

    const resumo = {
      valorTotalSemGD: result._sum.valorTotalSemGD ?? 0,
      economiaGD: result._sum.economiaGD ?? 0,
    }

    this.logger.log(
      `Resumo financeiro calculado | valorSemGD=R$${resumo.valorTotalSemGD} | economiaGD=R$${resumo.economiaGD}`,
    )

    return resumo
  }
}