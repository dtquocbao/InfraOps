import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { AuditService } from './audit.service';

@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
