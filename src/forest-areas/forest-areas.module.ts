import { Module } from '@nestjs/common';
import { ForestAreasController } from './forest-areas.controller';
import { ForestAreasService } from './forest-areas.service';

@Module({
  controllers: [ForestAreasController],
  providers: [ForestAreasService],
  exports: [ForestAreasService],
})
export class ForestAreasModule {}
