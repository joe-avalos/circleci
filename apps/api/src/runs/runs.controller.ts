import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
} from '@nestjs/common';
import { RunsService } from './runs.service';
import { RunStatus } from './run.entity';

@Controller('runs')
export class RunsController {
  constructor(private readonly runsService: RunsService) {}

  @Get()
  findAll() {
    return this.runsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.runsService.findOne(id);
  }

  @Post()
  create(@Body() body: { name: string; branch: string }) {
    return this.runsService.create(body.name, body.branch);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: RunStatus },
  ) {
    return this.runsService.updateStatus(id, body.status);
  }
}
