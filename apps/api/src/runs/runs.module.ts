import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Run } from './run.entity';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';

@Module({
  imports: [TypeOrmModule.forFeature([Run])],
  controllers: [RunsController],
  providers: [RunsService],
})
export class RunsModule {}
