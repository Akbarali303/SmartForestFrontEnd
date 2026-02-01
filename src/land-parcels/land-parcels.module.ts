import { Module } from '@nestjs/common';
import { LandParcelsController } from './land-parcels.controller';
import { LandParcelsService } from './land-parcels.service';

@Module({
  controllers: [LandParcelsController],
  providers: [LandParcelsService],
  exports: [LandParcelsService],
})
export class LandParcelsModule {}
