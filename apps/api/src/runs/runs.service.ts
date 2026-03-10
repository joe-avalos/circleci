import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Run, RunStatus, NEXT_STATUSES } from './run.entity';

@Injectable()
export class RunsService {
  constructor(
    @InjectRepository(Run)
    private readonly runsRepo: Repository<Run>,
  ) {}

  findAll(): Promise<Run[]> {
    return this.runsRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Run> {
    const run = await this.runsRepo.findOneBy({ id });
    if (!run) throw new NotFoundException(`Run ${id} not found`);
    return run;
  }

  async create(name: string, branch: string): Promise<Run> {
    const run = this.runsRepo.create({ name, branch, status: 'queued' });
    return this.runsRepo.save(run);
  }

  async updateStatus(id: string, status: RunStatus): Promise<Run> {
    const run = await this.findOne(id);

    const allowed = NEXT_STATUSES[run.status];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Cannot transition from "${run.status}" to "${status}". Allowed: ${allowed.join(', ') || 'none'}`,
      );
    }

    run.status = status;
    return this.runsRepo.save(run);
  }
}
