import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DocumentManifestEntrySchema, SETTING_DEFINITIONS } from '@infraops/shared';
import { processDocument } from '@infraops/ai-tools';

const prisma = new PrismaClient();

async function seedDefaultSettings() {
  for (const def of SETTING_DEFINITIONS) {
    await prisma.systemSetting.upsert({
      where: { key: def.key },
      update: {},
      create: { key: def.key, value: def.defaultValue },
    });
  }
}

async function getOpenAiKey() {
  const row = await prisma.systemSetting.findUnique({ where: { key: 'OPENAI_API_KEY' } });
  return row?.value || undefined;
}

async function main() {
  await seedDefaultSettings();
  const password = await bcrypt.hash('password123', 10);

  const users = [
    { email: 'engineer@meridiangrid.com', name: 'Alex Chen', role: UserRole.engineer },
    { email: 'pm@meridiangrid.com', name: 'Jordan Lee', role: UserRole.pm },
    { email: 'safety@meridiangrid.com', name: 'Sam Rivera', role: UserRole.safety },
    { email: 'exec@meridiangrid.com', name: 'Morgan Blake', role: UserRole.executive },
    { email: 'admin@meridiangrid.com', name: 'Admin User', role: UserRole.admin },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, password },
    });
  }

  await prisma.project.upsert({
    where: { id: 'proj-substation-alpha' },
    update: {},
    create: {
      id: 'proj-substation-alpha',
      name: 'Substation Alpha Upgrade',
      discipline: 'electrical',
      status: 'active',
    },
  });

  const iotDevices = [
    { id: 'TXF-014', deviceType: 'transformer', name: 'Transformer TXF-014', location: 'Substation Alpha - Bay 1' },
    { id: 'GEN-003', deviceType: 'generator', name: 'Backup Generator GEN-003', location: 'Substation Alpha - Gen Room' },
    { id: 'TMP-201', deviceType: 'temperature_sensor', name: 'Ambient Temp TMP-201', location: 'Substation Alpha - Control Building' },
    { id: 'WX-001', deviceType: 'weather_station', name: 'Weather Station WX-001', location: 'Substation Alpha - Perimeter' },
  ];

  for (const d of iotDevices) {
    await prisma.iotDevice.upsert({
      where: { id: d.id },
      update: {},
      create: { ...d, projectId: 'proj-substation-alpha' },
    });
  }
  console.log(`Seeded ${iotDevices.length} IoT devices`);

  const seedDirs = [
    path.join(process.cwd(), 'seed', 'documents'),
    path.join(process.cwd(), '..', '..', 'seed', 'documents'),
  ];
  let seedDir: string | null = null;
  for (const dir of seedDirs) {
    try {
      await fs.access(path.join(dir, 'manifest.json'));
      seedDir = dir;
      break;
    } catch {
      /* try next */
    }
  }

  if (seedDir) {
    const manifestRaw = await fs.readFile(path.join(seedDir, 'manifest.json'), 'utf-8');
    const manifest = JSON.parse(manifestRaw) as unknown[];
    console.log(`Seeding ${manifest.length} documents from ${seedDir}...`);

    for (const entry of manifest) {
      const parsed = DocumentManifestEntrySchema.parse(entry);
      const filePath = path.join(seedDir, parsed.filename);

      await prisma.document.upsert({
        where: { id: parsed.id },
        update: {
          title: parsed.title,
          docType: parsed.doc_type,
          projectId: parsed.project_id,
          department: parsed.department,
          securityLevel: parsed.security_level,
          revision: parsed.revision,
          approvalStatus: parsed.approval_status,
          storageUri: filePath,
          processingStatus: 'queued',
        },
        create: {
          id: parsed.id,
          title: parsed.title,
          docType: parsed.doc_type,
          projectId: parsed.project_id,
          department: parsed.department,
          securityLevel: parsed.security_level,
          revision: parsed.revision,
          approvalStatus: parsed.approval_status,
          storageUri: filePath,
          processingStatus: 'queued',
        },
      });

      await processDocument(prisma, parsed.id, await getOpenAiKey());
      console.log(`  ✓ ${parsed.title}`);
    }
  } else {
    console.warn('Seed documents directory not found - skipping document ingest');
  }

  console.log('Seed complete - demo users password: password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
