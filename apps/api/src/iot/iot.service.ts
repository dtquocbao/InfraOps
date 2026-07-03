import { Injectable } from '@nestjs/common';
import { IOT_ALERT_SEVERITY_THRESHOLD, type IotEventPayload } from '@infraops/shared';
import { PrismaService } from '../prisma/prisma.module';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class IotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  async listDevices() {
    return this.prisma.iotDevice.findMany({
      include: {
        _count: { select: { events: true } },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  async getDeviceEvents(deviceId: string, limit = 50) {
    const device = await this.prisma.iotDevice.findUnique({ where: { id: deviceId } });
    if (!device) return null;

    const events = await this.prisma.iotEvent.findMany({
      where: { deviceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return {
      device,
      events: events.map((e) => ({
        id: e.id,
        reading: e.reading,
        anomalyScore: e.anomalyScore,
        isAlert: (e.anomalyScore ?? 0) >= IOT_ALERT_SEVERITY_THRESHOLD,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }

  async getAlerts(limit = 20) {
    const events = await this.prisma.iotEvent.findMany({
      where: { anomalyScore: { gte: IOT_ALERT_SEVERITY_THRESHOLD } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { device: true },
    });

    return events.map((e) => ({
      id: e.id,
      deviceId: e.deviceId,
      deviceName: e.device.name,
      deviceType: e.device.deviceType,
      location: e.device.location,
      reading: e.reading,
      anomalyScore: e.anomalyScore,
      createdAt: e.createdAt.toISOString(),
    }));
  }

  async ingestEvent(payload: IotEventPayload, userId?: string) {
    const device = await this.prisma.iotDevice.findUnique({
      where: { id: payload.device_id },
    });
    if (!device) throw new Error(`Device ${payload.device_id} not found`);

    await this.queue.getIotQueue().add(
      'process_iot_event',
      { payload, userId },
      { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
    );

    return { queued: true, deviceId: payload.device_id };
  }
}
