import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { LlmModule } from 'src/llm/llm.module';

@Module({
  imports: [LlmModule],
  controllers: [InvoicesController],
  providers: [InvoicesService]
})
export class InvoicesModule {}
