import { Module } from '@nestjs/common';
import { FeatureTestsController } from './feature-tests.controller';
import { FeatureTestsService } from './feature-tests.service';

@Module({
  controllers: [FeatureTestsController],
  providers: [FeatureTestsService],
  exports: [FeatureTestsService],
})
export class FeatureTestsModule {}
