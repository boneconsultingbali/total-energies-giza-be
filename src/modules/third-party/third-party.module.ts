import { Module } from '@nestjs/common';
import { ThirdPartyService } from './third-party.service';
import { ThirdPartyController } from './third-party.controller';

@Module({
  controllers: [ThirdPartyController],
  providers: [ThirdPartyService],
})
export class ThirdPartyModule {}
