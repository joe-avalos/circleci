import { useState, useEffect, useOptimistic, useTransition, useCallback } from 'react';
import { fetchRuns, advanceRunStatus, Run, RunStatus } from '../api/runs';

export function useRuns() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Initial fetch — plain useEffect, no Suspense involved.
  useEffect(() => {
    fetchRuns()
      .then((data) => {
        setRuns(data);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  // useOptimistic works here because its passthrough (runs) is plain useState,
  // and applyOptimistic is only ever called inside startTransition below.
  const [optimisticRuns, applyOptimistic] = useOptimistic(
    runs,
    (current: Run[], { id, status }: { id: string; status: RunStatus }) =>
      current.map((r) => (r.id === id ? { ...r, status } : r)),
  );

  const refresh = useCallback(() => {
    startTransition(async () => {
      const data = await fetchRuns();
      setRuns(data);
    });
  }, []);

  const advance = useCallback(
    (id: string, status: RunStatus) => {
      startTransition(async () => {
        applyOptimistic({ id, status });
        await advanceRunStatus(id, status);
        const data = await fetchRuns();
        setRuns(data);
      });
    },
    [applyOptimistic],
  );

  return { runs: optimisticRuns, loading, isPending, refresh, advance };
}
