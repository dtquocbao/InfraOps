import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.module';
import { QueueService } from '../queue/queue.service';
import { AgentsService } from '../agents/agents.service';
import { RuntimeConfigService } from '../settings/runtime-config.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly agents: AgentsService,
    private readonly runtime: RuntimeConfigService,
  ) {}

  @Get()
  async check() {
    let database = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = true;
    } catch {
      database = false;
    }

    const redis = await this.queue.ping();

    return {
      status: database && redis ? 'ok' : 'degraded',
      service: 'infraops-api',
      timestamp: new Date().toISOString(),
      retrievalBackend: this.agents.getRetrievalBackend(),
      databricksConfigured: this.runtime.isDatabricksConfigured(),
      checks: { database, redis },
    };
  }
}
