import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
} from 'typeorm';
import { randomUUID } from 'crypto';

export type RunStatus = 'queued' | 'running' | 'success' | 'failed';

// Valid status transitions: queued → running → success | failed
export const NEXT_STATUSES: Record<RunStatus, RunStatus[]> = {
  queued: ['running'],
  running: ['success', 'failed'],
  success: [],
  failed: [],
};

@Entity('runs')
export class Run {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  branch: string;

  @Column({ default: 'queued' })
  status: RunStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = randomUUID();
  }
}
