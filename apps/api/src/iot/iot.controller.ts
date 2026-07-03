import { Body, Controller, Get, NotFoundException, Param, Post, Req, UseGuards, UsePipes } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IotEventPayloadSchema, type IotEventPayload } from '@infraops/shared';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { IotService } from './iot.service';

interface AuthRequest {
  user: { id: string };
}

@ApiTags('iot')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('iot')
export class IotController {
  constructor(private readonly iotService: IotService) {}

  @Get('devices')
  @ApiOperation({ summary: 'List IoT devices' })
  listDevices() {
    return this.iotService.listDevices();
  }

  @Get('devices/:id/events')
  @ApiOperation({ summary: 'Recent IoT events and anomaly flags' })
  async getEvents(@Param('id') id: string) {
    const result = await this.iotService.getDeviceEvents(id);
    if (!result) throw new NotFoundException('Device not found');
    return result;
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Recent anomaly alerts' })
  alerts() {
    return this.iotService.getAlerts();
  }

  @Post('events')
  @ApiOperation({ summary: 'Ingest IoT event (simulator endpoint)' })
  @UsePipes(new ZodValidationPipe(IotEventPayloadSchema))
  ingest(@Req() req: AuthRequest, @Body() body: IotEventPayload) {
    return this.iotService.ingestEvent(body, req.user.id);
  }
}
