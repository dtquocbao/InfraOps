import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { validateBootstrapEnv } from '@infraops/shared';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { DocumentsModule } from './documents/documents.module';
import { AgentsModule } from './agents/agents.module';
import { ReviewModule } from './review/review.module';
import { IotModule } from './iot/iot.module';
import { EvaluationModule } from './evaluation/evaluation.module';
import { AuditModule } from './audit/audit.module';
import { AdminModule } from './admin/admin.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ProjectsModule } from './projects/projects.module';
import { SettingsModule } from './settings/settings.module';
import { FeatureTestsModule } from './feature-tests/feature-tests.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => validateBootstrapEnv(config),
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        autoLogging: true,
        customProps: () => ({ service: 'infraops-api' }),
      },
    }),
    PrismaModule,
    QueueModule,
    SettingsModule,
    AuthModule,
    HealthModule,
    DocumentsModule,
    AgentsModule,
    ReviewModule,
    IotModule,
    EvaluationModule,
    AuditModule,
    AdminModule,
    DashboardModule,
    ProjectsModule,
    FeatureTestsModule,
  ],
})
export class AppModule {}
