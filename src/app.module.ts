import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { InvoicesModule } from './invoices/invoices.module'
import { DashboardModule } from './dashboard/dashboard.module'
import { LlmModule } from './llm/llm.module'
import { PrismaModule } from './prisma/prisma.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    InvoicesModule,
    DashboardModule,
    LlmModule,
    PrismaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}