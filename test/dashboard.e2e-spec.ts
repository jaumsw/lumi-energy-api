import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma/prisma.service'
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter'

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

function makeInvoice(
  numeroCliente: string,
  mesReferencia: string,
  values: {
    consumoEnergiaKwh: number
    energiaCompensadaFinalKwh: number
    valorTotalSemGD: number
    economiaGD: number
  },
) {
  return {
    numeroCliente,
    mesReferencia,
    energiaEletricaKwh: values.consumoEnergiaKwh * 0.6,
    energiaEletricaValor: values.valorTotalSemGD * 0.5,
    energiaSceeeKwh: values.consumoEnergiaKwh * 0.4,
    energiaSceeeValor: values.valorTotalSemGD * 0.3,
    energiaCompensadaKwh: values.energiaCompensadaFinalKwh,
    energiaCompensadaValor: values.economiaGD,
    contribuicaoIlumPublica: values.valorTotalSemGD * 0.2,
    consumoEnergiaKwh: values.consumoEnergiaKwh,
    energiaCompensadaFinalKwh: values.energiaCompensadaFinalKwh,
    valorTotalSemGD: values.valorTotalSemGD,
    economiaGD: values.economiaGD,
  }
}

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const CLIENT_A = '7001100001'
const CLIENT_B = '7001100002'

const SEEDS = [
  makeInvoice(CLIENT_A, 'JAN/2025', {
    consumoEnergiaKwh: 100,
    energiaCompensadaFinalKwh: 80,
    valorTotalSemGD: 200,
    economiaGD: 120,
  }),
  makeInvoice(CLIENT_A, 'FEV/2025', {
    consumoEnergiaKwh: 150,
    energiaCompensadaFinalKwh: 90,
    valorTotalSemGD: 250,
    economiaGD: 140,
  }),
  makeInvoice(CLIENT_B, 'JAN/2025', {
    consumoEnergiaKwh: 200,
    energiaCompensadaFinalKwh: 110,
    valorTotalSemGD: 300,
    economiaGD: 160,
  }),
]

// Pre-computed expected totals — scoped to CLIENT_A only (deterministic)
const CLIENT_A_CONSUMO = 100 + 150 // 250
const CLIENT_A_COMPENSADA = 80 + 90 // 170
const CLIENT_A_VALOR_SEM_GD = 200 + 250 // 450
const CLIENT_A_ECONOMIA_GD = 120 + 140 // 260

// Both test clients combined (used with a cliente filter over CLIENT_A + CLIENT_B)
const ALL_TEST_CONSUMO = 100 + 150 + 200 // 450
const ALL_TEST_COMPENSADA = 80 + 90 + 110 // 280
const ALL_TEST_VALOR_SEM_GD = 200 + 250 + 300 // 750
const ALL_TEST_ECONOMIA_GD = 120 + 140 + 160 // 420

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('DashboardController (e2e)', () => {
  let app: INestApplication<App>
  let prisma: PrismaService

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()

    // Apply the same global filter as main.ts so error shapes are consistent
    app.useGlobalFilters(new AllExceptionsFilter())

    await app.init()

    prisma = moduleFixture.get(PrismaService)

    // Clean up any leftover test data, then seed fresh records
    await prisma.invoice.deleteMany({
      where: { numeroCliente: { in: [CLIENT_A, CLIENT_B] } },
    })

    await prisma.invoice.createMany({ data: SEEDS })
  })

  afterAll(async () => {
    // Clean up seeded data so it doesn't affect other tests
    await prisma.invoice.deleteMany({
      where: { numeroCliente: { in: [CLIENT_A, CLIENT_B] } },
    })

    await app.close()
  })

  // =========================================================================
  // GET /dashboard/energia
  // =========================================================================

  describe('GET /dashboard/energia', () => {
    it('returns correct sums for CLIENT_A (2 invoices)', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`/dashboard/energia?cliente=${CLIENT_A}`)
        .expect(200)

      expect(body.consumoEnergiaKwh).toBeCloseTo(CLIENT_A_CONSUMO, 2)
      expect(body.energiaCompensadaKwh).toBeCloseTo(CLIENT_A_COMPENSADA, 2)
    })

    it('returns correct sums for CLIENT_B (1 invoice)', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`/dashboard/energia?cliente=${CLIENT_B}`)
        .expect(200)

      expect(body.consumoEnergiaKwh).toBeCloseTo(ALL_TEST_CONSUMO - CLIENT_A_CONSUMO, 2)
      expect(body.energiaCompensadaKwh).toBeCloseTo(ALL_TEST_COMPENSADA - CLIENT_A_COMPENSADA, 2)
    })

    it('filters by cliente and returns only that client sums', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`/dashboard/energia?cliente=${CLIENT_A}`)
        .expect(200)

      expect(body.consumoEnergiaKwh).toBeCloseTo(CLIENT_A_CONSUMO, 2)
      expect(body.energiaCompensadaKwh).toBeCloseTo(CLIENT_A_COMPENSADA, 2)
    })

    it('filters by dataInicio and dataFim (CLIENT_A, wide range)', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`/dashboard/energia?cliente=${CLIENT_A}&dataInicio=2020-01-01&dataFim=2099-12-31`)
        .expect(200)

      expect(body.consumoEnergiaKwh).toBeCloseTo(CLIENT_A_CONSUMO, 2)
    })

    it('returns zeros when no invoices match the filter', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/dashboard/energia?cliente=99999999999')
        .expect(200)

      expect(body.consumoEnergiaKwh).toBe(0)
      expect(body.energiaCompensadaKwh).toBe(0)
    })

    it('returns 400 when dataFim is before dataInicio (Zod refine)', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/dashboard/energia?dataInicio=2025-06-01&dataFim=2025-01-01')
        .expect(400)

      // Should contain validation error message
      expect(body.statusCode).toBe(400)
    })

    it('returns 400 for invalid date format', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/dashboard/energia?dataInicio=01-06-2025')
        .expect(400)

      expect(body.statusCode).toBe(400)
    })

    it('returns 400 for unknown query parameters (strict schema)', async () => {
      await request(app.getHttpServer())
        .get('/dashboard/energia?unknownParam=foo')
        .expect(400)
    })

    it('returns 400 for invalid cliente format (non-digits)', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/dashboard/energia?cliente=abc123')
        .expect(400)

      expect(body.statusCode).toBe(400)
    })
  })

  // =========================================================================
  // GET /dashboard/financeiro
  // =========================================================================

  describe('GET /dashboard/financeiro', () => {
    it('returns correct financial sums for CLIENT_A (2 invoices)', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`/dashboard/financeiro?cliente=${CLIENT_A}`)
        .expect(200)

      expect(body.valorTotalSemGD).toBeCloseTo(CLIENT_A_VALOR_SEM_GD, 2)
      expect(body.economiaGD).toBeCloseTo(CLIENT_A_ECONOMIA_GD, 2)
    })

    it('returns correct financial sums for CLIENT_B (1 invoice)', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`/dashboard/financeiro?cliente=${CLIENT_B}`)
        .expect(200)

      expect(body.valorTotalSemGD).toBeCloseTo(ALL_TEST_VALOR_SEM_GD - CLIENT_A_VALOR_SEM_GD, 2)
      expect(body.economiaGD).toBeCloseTo(ALL_TEST_ECONOMIA_GD - CLIENT_A_ECONOMIA_GD, 2)
    })

    it('filters by cliente and returns only that client sums', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`/dashboard/financeiro?cliente=${CLIENT_A}`)
        .expect(200)

      expect(body.valorTotalSemGD).toBeCloseTo(CLIENT_A_VALOR_SEM_GD, 2)
      expect(body.economiaGD).toBeCloseTo(CLIENT_A_ECONOMIA_GD, 2)
    })

    it('returns zeros when no invoices match the filter', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/dashboard/financeiro?cliente=99999999999')
        .expect(200)

      expect(body.valorTotalSemGD).toBe(0)
      expect(body.economiaGD).toBe(0)
    })

    it('returns 400 when dataFim is before dataInicio', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/dashboard/financeiro?dataInicio=2025-12-01&dataFim=2025-01-01')
        .expect(400)

      expect(body.statusCode).toBe(400)
    })

    it('returns 400 for unknown query parameters (strict schema)', async () => {
      await request(app.getHttpServer())
        .get('/dashboard/financeiro?unknownParam=foo')
        .expect(400)
    })
  })
})
