import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle } from 'lucide-react';
import { fetchIotAlerts, fetchIotDevices } from '../lib/api';

export function IotMonitorPage() {
  const { data: devices } = useQuery({
    queryKey: ['iot', 'devices'],
    queryFn: fetchIotDevices,
    refetchInterval: 5_000,
  });

  const { data: alerts } = useQuery({
    queryKey: ['iot', 'alerts'],
    queryFn: fetchIotAlerts,
    refetchInterval: 5_000,
  });

  return (
    <div>
      <header className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-white">
          <Activity className="h-7 w-7 text-accent" />
          IoT Monitor
        </h1>
        <p className="mt-1 text-gray-400">
          Live device readings and anomaly alerts - run <code className="text-accent">npm run iot:simulate</code>
        </p>
      </header>

      {alerts && alerts.length > 0 && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <h2 className="flex items-center gap-2 font-medium text-red-400">
            <AlertTriangle className="h-5 w-5" />
            Active Alerts ({alerts.length})
          </h2>
          <div className="mt-3 space-y-3">
            {alerts.slice(0, 5).map((a) => (
              <div key={a.id} className="text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white">
                    {a.deviceName} - {a.location}
                  </span>
                  <span className="shrink-0 text-red-400">
                    score {(a.anomalyScore * 100).toFixed(0)}% · {a.scoringBackend ?? 'heuristic'} ·{' '}
                    {new Date(a.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                {a.explanation && (
                  <p className="mt-1 text-xs text-red-200/80">{a.explanation}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {devices?.map((device) => {
          const latest = device.events?.[0];
          const reading = latest?.reading as Record<string, number> | undefined;
          const isAnomaly = (latest?.anomalyScore ?? 0) >= 0.85;

          return (
            <div
              key={device.id}
              className={`rounded-xl border p-5 ${isAnomaly ? 'border-red-500/40 bg-red-500/5' : 'border-charcoal-700 bg-charcoal-900'}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">{device.name}</p>
                  <p className="text-xs text-gray-500">{device.deviceType} · {device.location}</p>
                </div>
                {isAnomaly && <AlertTriangle className="h-5 w-5 text-red-400" />}
              </div>
              {reading ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {Object.entries(reading).map(([k, v]) => (
                    <div key={k} className="rounded bg-charcoal-800 px-3 py-2">
                      <p className="text-xs text-gray-500">{k}</p>
                      <p className="text-lg font-semibold text-white">{typeof v === 'number' ? v.toFixed(1) : v}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-gray-500">No readings yet</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
