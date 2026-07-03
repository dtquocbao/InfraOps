import { Global, Injectable, OnModuleInit } from '@nestjs/common';
import {
  SETTING_DEFINITIONS,
  type AppSettings,
  isMaskedSecretValue,
  settingsRecordToAppSettings,
  toSettingViews,
  type SettingView,
} from '@infraops/shared';
import { PrismaService } from '../prisma/prisma.module';

export interface SettingsUpdateResult {
  settings: SettingView[];
  before: Record<string, string>;
  after: Record<string, string>;
  changedKeys: string[];
}

@Global()
@Injectable()
export class SettingsService implements OnModuleInit {
  private cache = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureDefaults();
    await this.reload();
  }

  async ensureDefaults() {
    for (const def of SETTING_DEFINITIONS) {
      await this.prisma.systemSetting.upsert({
        where: { key: def.key },
        update: {},
        create: { key: def.key, value: def.defaultValue },
      });
    }
  }

  async reload() {
    const rows = await this.prisma.systemSetting.findMany();
    this.cache = new Map(rows.map((r) => [r.key, r.value]));
  }

  get(key: string): string {
    const def = SETTING_DEFINITIONS.find((d) => d.key === key);
    return this.cache.get(key) ?? def?.defaultValue ?? '';
  }

  getSnapshot(keys?: string[]): Record<string, string> {
    const target = keys ?? SETTING_DEFINITIONS.map((d) => d.key);
    const snap: Record<string, string> = {};
    for (const key of target) {
      snap[key] = this.get(key);
    }
    return snap;
  }

  getAppSettings(): AppSettings {
    const raw: Record<string, string> = {};
    for (const def of SETTING_DEFINITIONS) {
      raw[def.key] = this.get(def.key);
    }
    return settingsRecordToAppSettings(raw);
  }

  async listForAdmin(): Promise<SettingView[]> {
    const rows = await this.prisma.systemSetting.findMany();
    const map: Record<string, { value: string; updatedAt: Date | null }> = {};
    for (const row of rows) {
      map[row.key] = { value: row.value, updatedAt: row.updatedAt };
    }
    return toSettingViews(map);
  }

  async updateMany(
    updates: Record<string, string>,
    userId?: string,
  ): Promise<SettingsUpdateResult> {
    const allowed = new Set(SETTING_DEFINITIONS.map((d) => d.key));
    const changedKeys: string[] = [];
    const before: Record<string, string> = {};
    const after: Record<string, string> = {};

    for (const [key, value] of Object.entries(updates)) {
      if (!allowed.has(key)) continue;
      const def = SETTING_DEFINITIONS.find((d) => d.key === key);
      if (def?.isSecret && (value === '' || isMaskedSecretValue(value))) continue;

      const prev = this.get(key);
      before[key] = prev;
      if (prev === value) continue;

      await this.prisma.systemSetting.upsert({
        where: { key },
        update: { value, updatedBy: userId },
        create: { key, value, updatedBy: userId },
      });
      after[key] = value;
      changedKeys.push(key);
    }

    await this.reload();
    for (const key of changedKeys) {
      after[key] = this.get(key);
    }

    return {
      settings: await this.listForAdmin(),
      before,
      after,
      changedKeys,
    };
  }
}
