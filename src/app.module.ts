import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { EventsModule } from './events/events.module';
import { ForestAreasModule } from './forest-areas/forest-areas.module';
import { MqttModule } from './mqtt/mqtt.module';
import { SensorSimulatorModule } from './sensor-simulator/sensor-simulator.module';
import { TelegramModule } from './telegram/telegram.module';

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TelegramModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/smart_forest',
      autoLoadEntities: true,
      synchronize: false, // Use migrations only
    }),
    EventsModule,
    ForestAreasModule,
    MqttModule,
    SensorSimulatorModule,
  ],
})
export class AppModule {}
