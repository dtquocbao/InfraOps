import { Injectable } from '@nestjs/common';
import { formatAuditEntry, type AuditMetadata } from '@infraops/shared';
import { PrismaService } from '../prisma/prisma.module';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    userId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    metadata?: AuditMetadata;
  }) {
    return this.prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        metadata: (params.metadata ?? {}) as object,
      },
    });
  }

  async list(limit = 50) {
    const logs = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });

    return logs.map((l) =>
      formatAuditEntry({
        id: l.id,
        action: l.action,
        resourceType: l.resourceType,
        resourceId: l.resourceId,
        metadata: l.metadata,
        createdAt: l.createdAt.toISOString(),
        user: l.user,
      }),
    );
  }
}
