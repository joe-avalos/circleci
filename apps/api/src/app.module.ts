import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Run } from './runs/run.entity';
import { RunsModule } from './runs/runs.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: 'data/runs.db',
      entities: [Run],
      synchronize: true, // auto-creates/migrates tables in dev
    }),
    RunsModule,
  ],
})
export class AppModule {}
