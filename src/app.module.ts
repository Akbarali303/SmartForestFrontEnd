import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { EventsModule } from './events/events.module';
import { MqttModule } from './mqtt/mqtt.module';
import { SensorSimulatorModule } from './sensor-simulator/sensor-simulator.module';
import { TelegramModule } from './telegram/telegram.module';
import { LandParcelsModule } from './land-parcels/land-parcels.module';
import { ForestAreasModule } from './forest-areas/forest-areas.module';

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TelegramModule,
    LandParcelsModule,
    ForestAreasModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/smart_forest',
      autoLoadEntities: true,
      synchronize: false, // Use migrations only
    }),
    EventsModule,
    MqttModule,
    SensorSimulatorModule,
  ],
})
export class AppModule {}
