import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { EvaluationModule } from '../evaluation/evaluation.module';
import { IotModule } from '../iot/iot.module';
import { ReviewModule } from '../review/review.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [AgentsModule, EvaluationModule, ReviewModule, IotModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
