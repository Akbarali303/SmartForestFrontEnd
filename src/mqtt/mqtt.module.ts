import { Module } from '@nestjs/common';
import { MqttConsumerService } from './mqtt-consumer.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [EventsModule],
  providers: [MqttConsumerService],
})
export class MqttModule {}
