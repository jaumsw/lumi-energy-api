# Lumi Energy API


REST API para upload, extração e análise de faturas de energia elétrica utilizando LLM (Gemini) e agregações no banco de dados.

---

## Sumário

- [Arquitetura](#arquitetura)
- [Stack Tecnológica](#stack-tecnológica)
- [Decisões Técnicas](#decisões-técnicas)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Pré-requisitos](#pré-requisitos)
- [Configuração](#configuração)
- [Executando o Projeto](#executando-o-projeto)
- [Documentação da API](#documentação-da-api)
- [Testes](#testes)
- [Coleção Postman](#coleção-postman)
- [Melhorias Futuras](#melhorias-futuras)

---

## Arquitetura

```
┌──────────────────────────────────────────────────────────────────┐
│                         HTTP Client                              │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│                     NestJS Application                           │
│                                                                  │
│  ┌─────────────┐  ┌──────────────────┐  ┌──────────────────┐    │
│  │  Invoices   │  │    Dashboard     │  │  AllExceptions   │    │
│  │  Controller │  │    Controller    │  │      Filter      │    │
│  └──────┬──────┘  └────────┬─────────┘  └──────────────────┘    │
│         │                  │                                     │
│  ┌──────▼──────┐  ┌────────▼─────────┐                          │
│  │  Invoices   │  │    Dashboard     │                          │
│  │   Service   │  │     Service      │                          │
│  └──────┬──────┘  └────────┬─────────┘                          │
│         │                  │                                     │
│  ┌──────▼──────┐  ┌────────▼─────────┐                          │
│  │ LlmService  │  │  PrismaService   │                          │
│  │  (Gemini)   │  │  (PostgreSQL)    │                          │
│  └─────────────┘  └──────────────────┘                          │
└──────────────────────────────────────────────────────────────────┘
```

**Fluxo de upload de fatura:**
1. `POST /invoices/upload` recebe o PDF via multipart/form-data
2. `InvoicesService` encaminha o buffer ao `LlmService`
3. `LlmService` envia o PDF em base64 ao Gemini 2.0 Flash e extrai os dados estruturados
4. `InvoicesService` calcula as métricas derivadas e persiste no PostgreSQL via Prisma
5. Retorna a fatura salva com todos os campos calculados

**Fluxo do dashboard:**
1. `GET /dashboard/energia` e `GET /dashboard/financeiro` recebem filtros opcionais (`cliente`, `dataInicio`, `dataFim`)
2. `DashboardService` valida o intervalo de datas e constrói o predicado `WHERE` dinamicamente
3. Prisma executa `aggregate` (`_sum`) diretamente no banco — sem processamento em memória

---

## Stack Tecnológica

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | NestJS | 11 |
| ORM | Prisma | 7.4.1 |
| Banco de Dados | PostgreSQL | 14+ |
| LLM | Google Gemini 2.0 Flash | @google/genai 1.42 |
| Validação | Zod | 4.x |
| Documentação | @nestjs/swagger | 11.2 |
| Upload | Multer (memory storage) | 2.x |
| Testes E2E | Jest + Supertest | 30.x |

---

## Decisões Técnicas

### 1. Gemini em vez de OpenAI
A API da Gemini aceita conteúdo inline em base64 diretamente no request, dispensando a etapa de upload de arquivo separado que a OpenAI exige. Isso simplifica o fluxo e reduz latência.

### 2. Agregação no banco de dados (`aggregate._sum`)
As queries do dashboard usam `prisma.invoice.aggregate` em vez de buscar todos os registros e somar em memória. Isso garante performance constante independente do volume de dados.

### 3. Validação em duas camadas
- **Zod (entrada HTTP)**: valida formato dos parâmetros antes de chegar ao service — regex de datas, formato `MMM/YYYY`, comprimento do número de cliente, schema `.strict()` para rejeitar campos desconhecidos.
- **Service layer**: valida regras de negócio (`dataFim < dataInicio`) mesmo que o dado já tenha passado pelo Zod, garantindo que o service seja portável e testável isoladamente.

### 4. `AppError` centralizado
Em vez de `throw new HttpException(...)` espalhado pelo código, um `AppError` com factory methods (`badRequest`, `conflict`, `tooManyRequests`, etc.) fornece:
- Erros tipados com `code` semântico além do `statusCode` HTTP
- Ponto único de logging no `AllExceptionsFilter`
- Response shape consistente: `{ statusCode, code, message, path, timestamp }`

### 5. Índices no banco
```sql
@@unique([numeroCliente, mesReferencia])   -- evita faturas duplicadas por cliente/mês
@@index([numeroCliente])                   -- listagem/filtro por cliente
@@index([createdAt])                       -- filtro de período no dashboard
@@index([numeroCliente, createdAt])        -- filtro combinado (cliente + período)
```

### 6. Mock baseado em filename
Quando `USE_REAL_LLM=false`, o `LlmService` extrai mês/ano do padrão `XXXXXXX-MM-AAAA.pdf` e retorna um mock correspondente. Isso permite demonstrar diferentes faturas sem consumir quota da API.

---

## Estrutura do Projeto

```
src/
├── app.module.ts
├── main.ts                          # Bootstrap: Swagger + AllExceptionsFilter
├── common/
│   ├── errors/app.error.ts          # AppError com factory methods
│   ├── filters/
│   │   └── all-exceptions.filter.ts # Captura AppError, Prisma, Http e unknowns
│   ├── pipes/zod-validation.pipe.ts  # Pipe genérico para validação Zod
│   └── schemas/validation.schemas.ts # Schemas Zod de query params
├── dashboard/
│   ├── dashboard.controller.ts      # GET /dashboard/energia|financeiro
│   └── dashboard.service.ts         # Agregações + validação de negócio + Logger
├── invoices/
│   ├── invoices.controller.ts       # POST /invoices/upload, GET /invoices
│   ├── invoices.service.ts          # Orquestração LLM → cálculo → persistência
│   └── schemas/
│       ├── llm-invoice.schema.ts    # Zod schema da resposta do LLM
│       └── calculated-invoice.schema.ts
├── llm/
│   └── llm.service.ts               # Gemini 2.0 Flash + mock dinâmico
└── prisma/
    └── prisma.service.ts            # PrismaClient singleton
prisma/
├── schema.prisma                    # Modelo Invoice com índices e unique constraint
└── migrations/                      # Histórico de migrations
test/
├── dashboard.e2e-spec.ts            # 15 testes E2E do dashboard (seed + assertions)
└── app.e2e-spec.ts                  # Smoke test raiz
```

---

## Pré-requisitos

- Node.js 20+
- PostgreSQL 14+
- Conta Google AI Studio (opcional, para `USE_REAL_LLM=true`)

---

## Configuração

Crie um arquivo `.env` na raiz:

```env
# Banco de dados
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lumi_db?schema=public"

# LLM (Google Gemini)
GEMINI_API_KEY="sua-chave-aqui"

# Usar mock local (true = desabilita chamadas ao Gemini)
USE_REAL_LLM=false

# Porta (opcional, padrão 3000)
PORT=3000
```

---

## Executando o Projeto

```bash
# Instalar dependências
npm install

# Aplicar migrations (cria tabelas e índices)
npx prisma migrate deploy

# Modo desenvolvimento (hot-reload)
npm run start:dev

# Modo produção
npm run build
npm run start:prod
```

---

## Documentação da API

Após subir o servidor, a documentação interativa Swagger está disponível em:

```
http://localhost:3000/api
```

### Endpoints

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/invoices/upload` | Upload de fatura PDF para extração e persistência |
| `GET` | `/invoices` | Lista faturas com filtros opcionais |
| `GET` | `/dashboard/energia` | Resumo de consumo e compensação de energia |
| `GET` | `/dashboard/financeiro` | Resumo financeiro (valor sem GD e economia GD) |

### Parâmetros do Dashboard

| Parâmetro | Tipo | Exemplo | Descrição |
|---|---|---|---|
| `cliente` | `string` | `7005400387` | Número do cliente (5–20 dígitos) |
| `dataInicio` | `string` | `2025-01-01` | Data inicial do período (YYYY-MM-DD) |
| `dataFim` | `string` | `2025-12-31` | Data final do período (YYYY-MM-DD) |

### Formato de resposta de erro

```json
{
  "statusCode": 400,
  "code": "INVALID_DATE_RANGE",
  "message": "dataFim não pode ser anterior a dataInicio",
  "path": "/dashboard/energia",
  "timestamp": "2025-02-25T17:30:00.000Z"
}
```

---

## Testes

```bash
# Testes unitários
npm test

# Testes unitários em modo watch
npm run test:watch

# Testes E2E (requer banco de dados rodando)
npm run test:e2e

# Cobertura de código
npm run test:cov
```

Os testes E2E do dashboard (`test/dashboard.e2e-spec.ts`) fazem seed de dados reais no banco, verificam os somatórios calculados pelo Prisma e limpam os registros ao final.

---

## Coleção Postman

O arquivo `lumi-energy-api.postman_collection.json` contém todos os endpoints pré-configurados. Para importar:

1. Abra o Postman
2. Clique em **Import**
3. Selecione o arquivo `lumi-energy-api.postman_collection.json`

---

## Melhorias Futuras

| Área | Melhoria |
|---|---|
| **Autenticação** | JWT ou API Key para proteger os endpoints |
| **Cache** | Redis para cachear respostas do dashboard por filtro |
| **Background Jobs** | Processamento assíncrono de PDFs via BullMQ |
| **Storage** | Armazenar PDFs no S3/GCS em vez de processar em memória |
| **Paginação** | Cursor-based pagination no `GET /invoices` para grandes volumes |
| **Rate limiting** | Throttle no upload para evitar sobrecarga da API LLM |
| **Health checks** | Endpoint `/health` para monitoramento (Prisma + LLM ping) |
| **CI/CD** | Pipeline com testes E2E automatizados antes do deploy |
| **Observabilidade** | OpenTelemetry / Datadog para traces distribuídos |
