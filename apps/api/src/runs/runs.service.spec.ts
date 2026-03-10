import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Run } from './run.entity';
import { RunsService } from './runs.service';

async function buildModule(): Promise<TestingModule> {
  return Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot({
        type: 'better-sqlite3',
        database: ':memory:',
        entities: [Run],
        synchronize: true,
        dropSchema: true,
      }),
      TypeOrmModule.forFeature([Run]),
    ],
    providers: [RunsService],
  }).compile();
}

describe('RunsService', () => {
  let service: RunsService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await buildModule();
    service = module.get<RunsService>(RunsService);
  });

  afterEach(async () => {
    await module.close();
  });

  it('creates a run with queued status', async () => {
    const run = await service.create('build-main', 'main');
    expect(run.id).toBeDefined();
    expect(run.status).toBe('queued');
    expect(run.name).toBe('build-main');
    expect(run.branch).toBe('main');
  });

  it('lists runs (newest first)', async () => {
    await service.create('run-1', 'main');
    await service.create('run-2', 'feat/login');
    const runs = await service.findAll();
    expect(runs).toHaveLength(2);
    expect(runs.map((r) => r.name)).toContain('run-1');
    expect(runs.map((r) => r.name)).toContain('run-2');
  });

  it('finds a run by id', async () => {
    const created = await service.create('run-x', 'main');
    const found = await service.findOne(created.id);
    expect(found.id).toBe(created.id);
    expect(found.name).toBe('run-x');
  });

  it('throws NotFoundException for unknown id', async () => {
    await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
  });

  describe('updateStatus', () => {
    it('transitions queued → running', async () => {
      const run = await service.create('test', 'main');
      const updated = await service.updateStatus(run.id, 'running');
      expect(updated.status).toBe('running');
    });

    it('transitions running → success', async () => {
      const run = await service.create('test', 'main');
      await service.updateStatus(run.id, 'running');
      const updated = await service.updateStatus(run.id, 'success');
      expect(updated.status).toBe('success');
    });

    it('transitions running → failed', async () => {
      const run = await service.create('test', 'main');
      await service.updateStatus(run.id, 'running');
      const updated = await service.updateStatus(run.id, 'failed');
      expect(updated.status).toBe('failed');
    });

    it('rejects invalid transition queued → success', async () => {
      const run = await service.create('test', 'main');
      await expect(service.updateStatus(run.id, 'success')).rejects.toThrow(BadRequestException);
    });

    it('rejects transition out of terminal state', async () => {
      const run = await service.create('test', 'main');
      await service.updateStatus(run.id, 'running');
      await service.updateStatus(run.id, 'success');
      await expect(service.updateStatus(run.id, 'failed')).rejects.toThrow(BadRequestException);
    });
  });
});
