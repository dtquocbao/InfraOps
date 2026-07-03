import { Global, Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { RuntimeConfigService } from './runtime-config.service';

@Global()
@Module({
  providers: [SettingsService, RuntimeConfigService],
  exports: [SettingsService, RuntimeConfigService],
})
export class SettingsModule {}
