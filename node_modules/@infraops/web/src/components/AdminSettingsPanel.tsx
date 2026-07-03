import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Save } from 'lucide-react';
import { fetchSettings, updateSettings, type SystemSettingView } from '../lib/api';
import { useAuth } from '../lib/auth';

const CATEGORY_LABELS: Record<SystemSettingView['category'], string> = {
  llm: 'LLM & Embeddings',
  retrieval: 'Retrieval',
  databricks: 'Databricks',
  mlflow: 'MLflow',
};

export function AdminSettingsPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = user?.role === 'admin';

  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: fetchSettings,
  });

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const grouped = useMemo(() => {
    if (!settings) return [];
    const map = new Map<SystemSettingView['category'], SystemSettingView[]>();
    for (const s of settings) {
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    }
    return Array.from(map.entries());
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, string> = {};
      for (const s of settings ?? []) {
        const next = draft[s.key];
        if (next !== undefined && next !== s.displayValue) {
          payload[s.key] = next;
        }
      }
      return updateSettings(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
      queryClient.invalidateQueries({ queryKey: ['health'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'executive'] });
      setDraft({});
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    saveMutation.mutate();
  }

  function fieldValue(setting: SystemSettingView) {
    if (draft[setting.key] !== undefined) return draft[setting.key];
    return setting.isSecret ? '' : setting.value;
  }

  function secretPlaceholder(setting: SystemSettingView) {
    return setting.value ? `${setting.displayValue} - enter new value to replace` : 'Not configured';
  }

  if (isLoading) return <p className="text-gray-500">Loading settings…</p>;

  return (
    <form onSubmit={handleSubmit} className="mb-8 rounded-xl border border-charcoal-700 bg-charcoal-900 p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-medium text-white">
            <KeyRound className="h-5 w-5 text-accent" />
            Application Settings
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            LLM keys, retrieval backend, and Databricks config - stored in the database, not .env
          </p>
        </div>
        {canEdit && (
          <button
            type="submit"
            disabled={saveMutation.isPending || Object.keys(draft).length === 0}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
          </button>
        )}
      </div>

      {!canEdit && (
        <p className="mb-4 rounded-lg bg-charcoal-800 px-3 py-2 text-sm text-yellow-400">
          Read-only view - log in as admin to edit settings.
        </p>
      )}

      {saved && (
        <p className="mb-4 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">
          Settings saved. Changes apply to new agent runs immediately.
        </p>
      )}

      {saveMutation.isError && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {(saveMutation.error as Error).message}
        </p>
      )}

      <div className="space-y-8">
        {grouped.map(([category, items]) => (
          <div key={category}>
            <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-accent">
              {CATEGORY_LABELS[category]}
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {items.map((setting) => (
                <label key={setting.key} className="block">
                  <span className="text-sm text-white">{setting.label}</span>
                  <span className="mt-0.5 block text-xs text-gray-500">{setting.description}</span>
                  {setting.options ? (
                    <select
                      value={fieldValue(setting)}
                      disabled={!canEdit}
                      onChange={(e) => setDraft((d) => ({ ...d, [setting.key]: e.target.value }))}
                      className="mt-2 w-full rounded-lg border border-charcoal-700 bg-charcoal-800 px-3 py-2 text-sm text-white disabled:opacity-60"
                    >
                      {setting.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={setting.isSecret ? 'password' : 'text'}
                      value={fieldValue(setting)}
                      disabled={!canEdit}
                      placeholder={setting.isSecret ? secretPlaceholder(setting) : ''}
                      onChange={(e) => setDraft((d) => ({ ...d, [setting.key]: e.target.value }))}
                      className="mt-2 w-full rounded-lg border border-charcoal-700 bg-charcoal-800 px-3 py-2 text-sm text-white disabled:opacity-60"
                    />
                  )}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </form>
  );
}
