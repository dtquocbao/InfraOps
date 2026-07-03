import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { buildSettingsAuditChanges } from '@infraops/shared';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { AuditService } from '../audit/audit.service';
import { QueueService } from '../queue/queue.service';
import { EvaluationService } from '../evaluation/evaluation.service';
import { SettingsService } from '../settings/settings.service';
import { PrismaService } from '../prisma/prisma.module';

interface AuthRequest {
  user: { id: string; role: string; email: string };
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'executive')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly audit: AuditService,
    private readonly queue: QueueService,
    private readonly evaluation: EvaluationService,
    private readonly settings: SettingsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('audit-log')
  @ApiOperation({ summary: 'Audit trail with change diffs' })
  auditLog() {
    return this.audit.list();
  }

  @Get('queue-metrics')
  @ApiOperation({ summary: 'BullMQ queue metrics' })
  queueMetrics() {
    return this.queue.getMetrics();
  }

  @Get('evaluation-summary')
  @ApiOperation({ summary: 'Evaluation summary for admin dashboard' })
  evalSummary() {
    return this.evaluation.getSummary();
  }

  @Get('settings')
  @ApiOperation({ summary: 'List application settings (secrets masked)' })
  listSettings() {
    return this.settings.listForAdmin();
  }

  @Put('settings')
  @Roles('admin')
  @ApiOperation({ summary: 'Update application settings (admin only)' })
  async updateSettings(
    @Req() req: AuthRequest,
    @Body() body: Record<string, string>,
  ) {
    const result = await this.settings.updateMany(body, req.user.id);
    const changes = buildSettingsAuditChanges(result.before, result.after);

    if (changes.length > 0) {
      const actorUser = await this.prisma.user.findUnique({
        where: { id: req.user.id },
        select: { name: true },
      });
      const actor = actorUser?.name ?? req.user.email;
      await this.audit.log({
        userId: req.user.id,
        action: 'settings.updated',
        resourceType: 'system_settings',
        metadata: {
          summary: `${actor} updated ${changes.length} application setting(s)`,
          method: 'admin.settings_form',
          changes,
          changedKeys: result.changedKeys,
        },
      });
    }

    return result.settings;
  }
}
