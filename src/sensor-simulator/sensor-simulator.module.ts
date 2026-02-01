import { Module } from '@nestjs/common';
import { SensorSimulatorService } from './sensor-simulator.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [EventsModule],
  providers: [SensorSimulatorService],
})
export class SensorSimulatorModule {}
