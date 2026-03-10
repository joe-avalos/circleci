export type RunStatus = 'queued' | 'running' | 'success' | 'failed';

export interface Run {
  id: string;
  name: string;
  branch: string;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
}

export const NEXT_STATUSES: Record<RunStatus, RunStatus[]> = {
  queued: ['running'],
  running: ['success', 'failed'],
  success: [],
  failed: [],
};

export async function fetchRuns(): Promise<Run[]> {
  const res = await fetch('/api/runs');
  if (!res.ok) throw new Error(`Failed to load runs (${res.status})`);
  return res.json();
}

export async function createRun(name: string, branch: string): Promise<Run> {
  const res = await fetch('/api/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, branch }),
  });
  if (!res.ok) throw new Error(`Failed to create run (${res.status})`);
  return res.json();
}

export async function advanceRunStatus(id: string, status: RunStatus): Promise<Run> {
  const res = await fetch(`/api/runs/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Failed to update status (${res.status})`);
  return res.json();
}
