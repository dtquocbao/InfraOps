import { z } from 'zod';

export const IotReadingSchema = z.record(z.number());

export const IotEventPayloadSchema = z.object({
  device_id: z.string(),
  device_type: z.enum(['transformer', 'generator', 'temperature_sensor', 'weather_station']),
  reading: IotReadingSchema,
  timestamp: z.string().datetime().optional(),
});

export type IotEventPayload = z.infer<typeof IotEventPayloadSchema>;

export const IOT_ANOMALY_THRESHOLD = 0.75;
export const IOT_ALERT_SEVERITY_THRESHOLD = 0.85;

/** Baseline ranges per device type for anomaly scoring */
export const IOT_BASELINES: Record<
  string,
  { fields: Record<string, { min: number; max: number; weight: number }> }
> = {
  transformer: {
    fields: {
      temperature_c: { min: 40, max: 75, weight: 0.4 },
      load_pct: { min: 20, max: 90, weight: 0.35 },
      vibration_hz: { min: 5, max: 18, weight: 0.25 },
    },
  },
  generator: {
    fields: {
      rpm: { min: 1750, max: 1850, weight: 0.3 },
      fuel_pressure_psi: { min: 45, max: 65, weight: 0.35 },
      exhaust_temp_c: { min: 350, max: 480, weight: 0.35 },
    },
  },
  temperature_sensor: {
    fields: {
      temperature_c: { min: -10, max: 45, weight: 1.0 },
    },
  },
  weather_station: {
    fields: {
      wind_speed_kmh: { min: 0, max: 80, weight: 0.5 },
      humidity_pct: { min: 10, max: 95, weight: 0.5 },
    },
  },
};
