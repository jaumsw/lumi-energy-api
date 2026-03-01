import { Controller, Get, Query } from '@nestjs/common'
import { DashboardService } from './dashboard.service'
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { dashboardQuerySchema } from '../common/schemas/validation.schemas'
import type { DashboardQuery } from '../common/schemas/validation.schemas'

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('energia')
  @ApiOperation({
    summary: 'Resumo de energia',
    description: 'Retorna totais de consumo e energia compensada. Suporta filtros por cliente e periodo.',
  })
  @ApiQuery({ name: 'cliente', required: false, description: 'Numero do cliente (ex: 7005400387)' })
  @ApiQuery({ name: 'dataInicio', required: false, description: 'Data de inicio do periodo (ex: 2025-01-01)' })
  @ApiQuery({ name: 'dataFim', required: false, description: 'Data de fim do periodo (ex: 2025-12-31)' })
  @ApiResponse({ status: 200, description: 'Resumo de energia retornado com sucesso.' })
  @ApiResponse({ status: 400, description: 'Parametros invalidos.' })
  async energiaResumo(
    @Query(new ZodValidationPipe(dashboardQuerySchema)) query: DashboardQuery,
  ) {
    return this.dashboardService.getEnergiaResumo(query)
  }

  @Get('financeiro')
  @ApiOperation({
    summary: 'Resumo financeiro',
    description: 'Retorna totais de valor sem GD e economia gerada. Suporta filtros por cliente e periodo.',
  })
  @ApiQuery({ name: 'cliente', required: false, description: 'Numero do cliente (ex: 7005400387)' })
  @ApiQuery({ name: 'dataInicio', required: false, description: 'Data de inicio do periodo (ex: 2025-01-01)' })
  @ApiQuery({ name: 'dataFim', required: false, description: 'Data de fim do periodo (ex: 2025-12-31)' })
  @ApiResponse({ status: 200, description: 'Resumo financeiro retornado com sucesso.' })
  @ApiResponse({ status: 400, description: 'Parametros invalidos.' })
  async financeiroResumo(
    @Query(new ZodValidationPipe(dashboardQuerySchema)) query: DashboardQuery,
  ) {
    return this.dashboardService.getFinanceiroResumo(query)
  }
}
