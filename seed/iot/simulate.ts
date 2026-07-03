/**
 * IoT event simulator - streams synthetic sensor readings with occasional anomalies.
 * Usage: npx ts-node seed/iot/simulate.ts [--interval 3000] [--anomaly-rate 0.15]
 */
import 'dotenv/config';

const API_BASE = process.env.API_BASE ?? 'http://localhost:3000';
const INTERVAL_MS = Number(process.argv.find((a) => a.startsWith('--interval='))?.split('=')[1] ?? 3000);
const ANOMALY_RATE = Number(process.argv.find((a) => a.startsWith('--anomaly-rate='))?.split('=')[1] ?? 0.15);

const DEVICES = [
  { id: 'TXF-014', type: 'transformer' as const },
  { id: 'GEN-003', type: 'generator' as const },
  { id: 'TMP-201', type: 'temperature_sensor' as const },
  { id: 'WX-001', type: 'weather_station' as const },
];

function normalReading(type: string, anomaly: boolean): Record<string, number> {
  switch (type) {
    case 'transformer':
      return anomaly
        ? { temperature_c: 95 + Math.random() * 10, load_pct: 98, vibration_hz: 28 }
        : { temperature_c: 55 + Math.random() * 15, load_pct: 60 + Math.random() * 25, vibration_hz: 10 + Math.random() * 5 };
    case 'generator':
      return anomaly
        ? { rpm: 1920, fuel_pressure_psi: 80, exhaust_temp_c: 550 }
        : { rpm: 1800 + Math.random() * 30, fuel_pressure_psi: 50 + Math.random() * 10, exhaust_temp_c: 380 + Math.random() * 60 };
    case 'temperature_sensor':
      return anomaly
        ? { temperature_c: 55 + Math.random() * 20 }
        : { temperature_c: 10 + Math.random() * 25 };
    case 'weather_station':
      return anomaly
        ? { wind_speed_kmh: 110, humidity_pct: 98 }
        : { wind_speed_kmh: Math.random() * 40, humidity_pct: 30 + Math.random() * 50 };
    default:
      return {};
  }
}

async function login(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@meridiangrid.com', password: 'password123' }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const data = (await res.json()) as { accessToken: string };
  return data.accessToken;
}

async function sendEvent(token: string, deviceId: string, deviceType: string, reading: Record<string, number>) {
  const res = await fetch(`${API_BASE}/api/iot/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      device_id: deviceId,
      device_type: deviceType,
      reading,
      timestamp: new Date().toISOString(),
    }),
  });
  if (!res.ok) console.error(`Event failed for ${deviceId}:`, await res.text());
}

async function main() {
  console.log(`IoT Simulator - interval ${INTERVAL_MS}ms, anomaly rate ${ANOMALY_RATE}`);
  const token = await login();
  console.log('Authenticated. Streaming events…\n');

  setInterval(() => {
    const device = DEVICES[Math.floor(Math.random() * DEVICES.length)];
    const anomaly = Math.random() < ANOMALY_RATE;
    const reading = normalReading(device.type, anomaly);
    const label = anomaly ? '⚠ ANOMALY' : '  normal';
    console.log(`${label} ${device.id} (${device.type}):`, JSON.stringify(reading));
    sendEvent(token, device.id, device.type, reading).catch(console.error);
  }, INTERVAL_MS);
}

main().catch(console.error);
