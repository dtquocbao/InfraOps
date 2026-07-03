import { useState } from 'react';
import { ChevronDown, ChevronRight, List } from 'lucide-react';
import type { AuditLogEntry } from '../lib/api';

function ChangeDiff({ changes }: { changes: AuditLogEntry['changes'] }) {
  if (!changes.length) return null;

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-charcoal-700">
      <table className="w-full text-left text-xs">
        <thead className="bg-charcoal-800 text-gray-400">
          <tr>
            <th className="px-3 py-2 font-medium">Field</th>
            <th className="px-3 py-2 font-medium">Previous</th>
            <th className="px-3 py-2 font-medium">New</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-charcoal-700">
          {changes.map((c) => (
            <tr key={c.field}>
              <td className="px-3 py-2 text-gray-300">{c.label}</td>
              <td className="px-3 py-2 font-mono text-red-300/90">{c.before}</td>
              <td className="px-3 py-2 font-mono text-green-300/90">{c.after}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditLogRow({ entry }: { entry: AuditLogEntry }) {
  const [open, setOpen] = useState(false);
  const hasDetail = entry.changes.length > 0 || entry.metadata.comments;

  return (
    <div className="px-6 py-4">
      <button
        type="button"
        onClick={() => hasDetail && setOpen(!open)}
        className={`flex w-full items-start gap-3 text-left ${hasDetail ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <span className="mt-0.5 text-gray-500">
          {hasDetail ? (
            open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          ) : (
            <span className="inline-block w-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-medium text-white">{entry.summary}</span>
            <span className="rounded-full bg-charcoal-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-accent">
              {entry.actionLabel}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            <span>
              <span className="text-gray-400">Who:</span> {entry.actor.name}
              {entry.actor.role !== 'system' && ` (${entry.actor.role})`}
            </span>
            <span>
              <span className="text-gray-400">How:</span> {entry.methodLabel}
            </span>
            <span>
              <span className="text-gray-400">Resource:</span> {entry.resourceType}
              {entry.resourceId ? ` · ${entry.resourceId.slice(0, 8)}…` : ''}
            </span>
            <span>{new Date(entry.createdAt).toLocaleString()}</span>
          </div>
        </div>
      </button>

      {open && (
        <div className="ml-7 mt-2">
          {typeof entry.metadata.comments === 'string' && entry.metadata.comments && (
            <p className="mb-2 text-xs text-gray-400">
              Comment: <span className="text-gray-300">{entry.metadata.comments}</span>
            </p>
          )}
          {Array.isArray(entry.metadata.reasons) && entry.metadata.reasons.length > 0 && (
            <p className="mb-2 text-xs text-gray-400">
              Triggers:{' '}
              <span className="text-gray-300">{(entry.metadata.reasons as string[]).join(', ')}</span>
            </p>
          )}
          <ChangeDiff changes={entry.changes} />
        </div>
      )}
    </div>
  );
}

export function AuditLogPanel({ entries }: { entries?: AuditLogEntry[] }) {
  return (
    <div className="rounded-xl border border-charcoal-700 bg-charcoal-900">
      <div className="border-b border-charcoal-700 px-6 py-4">
        <h2 className="flex items-center gap-2 font-medium text-white">
          <List className="h-5 w-5 text-accent" />
          Audit Log
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Who changed what, how, and before/after values - expand rows for diffs
        </p>
      </div>
      <div className="max-h-[32rem] divide-y divide-charcoal-700 overflow-y-auto">
        {entries?.length ? (
          entries.map((entry) => <AuditLogRow key={entry.id} entry={entry} />)
        ) : (
          <p className="p-6 text-gray-500">No audit entries yet</p>
        )}
      </div>
    </div>
  );
}
