import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EvaluationModule } from '../evaluation/evaluation.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [AuditModule, EvaluationModule],
  controllers: [AdminController],
})
export class AdminModule {}
