import 'dotenv/config';
import { DataSource } from 'typeorm';

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/smart_forest',
  entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
  migrations: [
    __dirname + '/migrations/1738281600000-CreateEventsTable.ts',
    __dirname + '/migrations/1738281700000-AddSpatialIndexEvents.ts',
    __dirname + '/migrations/1738281800000-CreateUzbekistanBoundary.ts',
  ],
  synchronize: false,
});

export default AppDataSource;
