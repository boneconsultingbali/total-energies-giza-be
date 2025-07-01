import { Module } from '@nestjs/common';
import { PerformanceIndicatorController } from './performance-indicator.controller';
import { PerformanceIndicatorService } from './performance-indicator.service';

@Module({
  controllers: [PerformanceIndicatorController],
  providers: [PerformanceIndicatorService],
  exports: [PerformanceIndicatorService],
})
export class PerformanceIndicatorModule {}