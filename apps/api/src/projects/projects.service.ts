import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const projects = await this.prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { documents: true, iotDevices: true } },
      },
    });

    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      discipline: p.discipline,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      documentCount: p._count.documents,
      iotDeviceCount: p._count.iotDevices,
    }));
  }

  async getById(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        documents: {
          orderBy: { title: 'asc' },
          select: {
            id: true,
            title: true,
            docType: true,
            processingStatus: true,
            securityLevel: true,
            approvalStatus: true,
          },
        },
        iotDevices: {
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            deviceType: true,
            location: true,
          },
        },
        _count: { select: { documents: true, iotDevices: true } },
      },
    });

    if (!project) throw new NotFoundException('Project not found');

    const readyDocs = project.documents.filter((d) => d.processingStatus === 'ready').length;

    return {
      id: project.id,
      name: project.name,
      discipline: project.discipline,
      status: project.status,
      createdAt: project.createdAt.toISOString(),
      documentCount: project._count.documents,
      iotDeviceCount: project._count.iotDevices,
      readyDocumentCount: readyDocs,
      documents: project.documents,
      iotDevices: project.iotDevices,
    };
  }
}
