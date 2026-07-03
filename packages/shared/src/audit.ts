import { maskSecretValue, SETTING_DEFINITIONS } from './schemas/settings';

export interface AuditChange {
  field: string;
  label: string;
  before: string;
  after: string;
  isSecret?: boolean;
}

export interface AuditMetadata {
  summary?: string;
  method?: string;
  changes?: AuditChange[];
  [key: string]: unknown;
}

export interface AuditLogEntryView {
  id: string;
  action: string;
  actionLabel: string;
  resourceType: string;
  resourceId: string | null;
  createdAt: string;
  actor: {
    id: string | null;
    name: string;
    email: string | null;
    role: string;
  };
  summary: string;
  method: string;
  methodLabel: string;
  changes: AuditChange[];
  metadata: AuditMetadata;
}

const ACTION_LABELS: Record<string, string> = {
  settings_updated: 'Settings updated',
  review_created: 'Review queued',
  review_approved: 'Review approved',
  review_rejected: 'Review rejected',
};

const METHOD_LABELS: Record<string, string> = {
  'admin.settings_form': 'Admin → Settings form',
  'system.review_rules': 'Automatic review rules',
  'human_review.decide': 'Human Review decision',
};

export function settingLabel(key: string): string {
  return SETTING_DEFINITIONS.find((d) => d.key === key)?.label ?? key;
}

export function settingIsSecret(key: string): boolean {
  return SETTING_DEFINITIONS.find((d) => d.key === key)?.isSecret ?? false;
}

export function buildSettingsAuditChanges(
  before: Record<string, string>,
  after: Record<string, string>,
): AuditChange[] {
  const changes: AuditChange[] = [];
  for (const key of Object.keys(after)) {
    const prev = before[key] ?? '';
    const next = after[key] ?? '';
    if (prev === next) continue;
    const isSecret = settingIsSecret(key);
    changes.push({
      field: key,
      label: settingLabel(key),
      before: isSecret ? maskSecretValue(prev, true) : prev || '(empty)',
      after: isSecret ? maskSecretValue(next, true) : next || '(empty)',
      isSecret,
    });
  }
  return changes;
}

export function formatAuditEntry(entry: {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: unknown;
  createdAt: string;
  user: { id: string; name: string; email: string; role: string } | null;
}): AuditLogEntryView {
  const metadata = (entry.metadata ?? {}) as AuditMetadata;
  const actionLabel =
    metadata.summary?.split(' - ')[0] ??
    ACTION_LABELS[entry.action.replace('.', '_')] ??
    entry.action.replace(/[._]/g, ' ');

  const actorName = entry.user?.name ?? 'System';
  const summary =
    metadata.summary ??
    defaultSummary(entry.action, actorName, metadata);

  const method = metadata.method ?? inferMethod(entry.action);
  const methodLabel = METHOD_LABELS[method] ?? method.replace(/[._]/g, ' ');

  return {
    id: entry.id,
    action: entry.action,
    actionLabel,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    createdAt: entry.createdAt,
    actor: {
      id: entry.user?.id ?? null,
      name: actorName,
      email: entry.user?.email ?? null,
      role: entry.user?.role ?? 'system',
    },
    summary,
    method,
    methodLabel,
    changes: metadata.changes ?? [],
    metadata,
  };
}

function defaultSummary(action: string, actor: string, metadata: AuditMetadata): string {
  if (action === 'settings.updated') {
    const keys = (metadata.keys as string[] | undefined) ?? [];
    return `${actor} updated ${keys.length} setting(s)`;
  }
  if (action === 'review_created') {
    const reasons = (metadata.reasons as string[] | undefined) ?? [];
    return `System queued a response for human review (${reasons.join(', ') || 'trigger matched'})`;
  }
  if (action === 'review_approved') {
    return `${actor} approved a flagged agent response`;
  }
  if (action === 'review_rejected') {
    return `${actor} rejected a flagged agent response`;
  }
  return `${actor} performed ${action.replace(/[._]/g, ' ')}`;
}

function inferMethod(action: string): string {
  if (action.startsWith('settings')) return 'admin.settings_form';
  if (action === 'review_created') return 'system.review_rules';
  if (action.startsWith('review_')) return 'human_review.decide';
  return 'system';
}
