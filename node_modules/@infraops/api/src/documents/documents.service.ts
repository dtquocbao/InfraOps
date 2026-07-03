import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { QueueService } from '../queue/queue.service';
import type { DocumentManifestEntry } from '@infraops/shared';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class DocumentsService {
  private readonly uploadDir = path.join(process.cwd(), 'uploads');

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  async ensureUploadDir() {
    await fs.mkdir(this.uploadDir, { recursive: true });
  }

  async list() {
    const docs = await this.prisma.document.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { chunks: true } } },
    });
    return docs.map((d) => ({
      id: d.id,
      title: d.title,
      docType: d.docType,
      revision: d.revision,
      approvalStatus: d.approvalStatus,
      department: d.department,
      securityLevel: d.securityLevel,
      processingStatus: d.processingStatus,
      projectId: d.projectId,
      createdAt: d.createdAt.toISOString(),
      chunkCount: d._count.chunks,
    }));
  }

  async getById(id: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: { _count: { select: { chunks: true } } },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return {
      id: doc.id,
      title: doc.title,
      docType: doc.docType,
      revision: doc.revision,
      approvalStatus: doc.approvalStatus,
      department: doc.department,
      securityLevel: doc.securityLevel,
      processingStatus: doc.processingStatus,
      projectId: doc.projectId,
      storageUri: doc.storageUri,
      createdAt: doc.createdAt.toISOString(),
      chunkCount: doc._count.chunks,
    };
  }

  async createFromUpload(
    file: Express.Multer.File,
    meta: {
      title: string;
      docType: string;
      projectId?: string;
      department: string;
      securityLevel: string;
      revision?: string;
      approvalStatus?: string;
    },
  ) {
    await this.ensureUploadDir();
    const filename = `${Date.now()}-${file.originalname}`;
    const dest = path.join(this.uploadDir, filename);
    await fs.writeFile(dest, file.buffer);

    const doc = await this.prisma.document.create({
      data: {
        title: meta.title,
        docType: meta.docType,
        projectId: meta.projectId,
        department: meta.department,
        securityLevel: meta.securityLevel,
        revision: meta.revision ?? '1.0',
        approvalStatus: meta.approvalStatus ?? 'pending',
        storageUri: dest,
        processingStatus: 'queued',
      },
    });

    await this.enqueueProcessing(doc.id);
    return this.getById(doc.id);
  }

  async createFromSeedEntry(entry: DocumentManifestEntry, filePath: string) {
    const existing = await this.prisma.document.findUnique({ where: { id: entry.id } });
    if (existing?.processingStatus === 'ready') return existing;

    const doc = await this.prisma.document.upsert({
      where: { id: entry.id },
      update: {
        title: entry.title,
        docType: entry.doc_type,
        projectId: entry.project_id,
        department: entry.department,
        securityLevel: entry.security_level,
        revision: entry.revision,
        approvalStatus: entry.approval_status,
        storageUri: filePath,
        processingStatus: 'queued',
      },
      create: {
        id: entry.id,
        title: entry.title,
        docType: entry.doc_type,
        projectId: entry.project_id,
        department: entry.department,
        securityLevel: entry.security_level,
        revision: entry.revision,
        approvalStatus: entry.approval_status,
        storageUri: filePath,
        processingStatus: 'queued',
      },
    });

    await this.enqueueProcessing(doc.id);
    return doc;
  }

  async enqueueProcessing(documentId: string) {
    const queue = this.queue.getDocumentQueue();
    await queue.add(
      'process_document',
      { documentId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
  }
}
