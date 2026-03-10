import { Run, RunStatus, NEXT_STATUSES } from '../api/runs';

const STATUS_COLORS: Record<RunStatus, string> = {
  queued: '#a78bfa',
  running: '#60a5fa',
  success: '#34d399',
  failed: '#f87171',
};

function StatusBadge({ status }: { status: RunStatus }) {
  return (
    <span
      style={{
        ...styles.badge,
        color: STATUS_COLORS[status],
        border: `1px solid ${STATUS_COLORS[status]}33`,
        background: `${STATUS_COLORS[status]}11`,
      }}
    >
      {status.toUpperCase()}
    </span>
  );
}

interface RunRowProps {
  run: Run;
  isPending: boolean;
  onAdvance: (id: string, status: RunStatus) => void;
}

function RunRow({ run, isPending, onAdvance }: RunRowProps) {
  const nextStatuses = NEXT_STATUSES[run.status];

  return (
    <tr style={styles.row}>
      <td style={styles.cell}>
        <span style={styles.runName}>{run.name}</span>
      </td>
      <td style={styles.cell}>
        <code style={styles.branch}>{run.branch}</code>
      </td>
      <td style={styles.cell}>
        <StatusBadge status={run.status} />
      </td>
      <td style={styles.cell}>
        <span style={styles.timestamp}>{new Date(run.createdAt).toLocaleTimeString()}</span>
      </td>
      <td style={{ ...styles.cell, textAlign: 'right' }}>
        {nextStatuses.length > 0 && (
          <div style={styles.actions}>
            {nextStatuses.map((s) => (
              <button
                key={s}
                onClick={() => onAdvance(run.id, s)}
                disabled={isPending}
                style={{
                  ...styles.actionBtn,
                  color: STATUS_COLORS[s],
                  borderColor: `${STATUS_COLORS[s]}55`,
                  opacity: isPending ? 0.5 : 1,
                }}
              >
                {`→ ${s}`}
              </button>
            ))}
          </div>
        )}
      </td>
    </tr>
  );
}

interface Props {
  runs: Run[];
  isPending: boolean;
  onAdvance: (id: string, status: RunStatus) => void;
  onRefresh: () => void;
}

export function RunsList({ runs, isPending, onAdvance, onRefresh }: Props) {
  return (
    <section style={{ ...styles.card, opacity: isPending ? 0.65 : 1, transition: 'opacity 0.15s' }}>
      <div style={styles.cardHeader}>
        <h2 style={styles.cardTitle}>Pipeline Runs</h2>
        <button onClick={onRefresh} style={styles.refreshBtn} disabled={isPending}>
          {isPending ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {runs.length === 0 ? (
        <p style={styles.empty}>No runs yet — create one above.</p>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Name', 'Branch', 'Status', 'Created', 'Actions'].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <RunRow key={run.id} run={run} isPending={isPending} onAdvance={onAdvance} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const styles = {
  card: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 8,
    padding: '1.5rem',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  cardTitle: { margin: 0, fontSize: '1rem', fontWeight: 600, color: '#f0f0f0' },
  refreshBtn: {
    padding: '0.3rem 0.75rem',
    borderRadius: 6,
    border: '1px solid #333',
    background: 'transparent',
    color: '#999',
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
  tableWrapper: { overflowX: 'auto' as const },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.875rem' },
  th: {
    padding: '0.5rem 0.75rem',
    textAlign: 'left' as const,
    fontSize: '0.75rem',
    fontWeight: 500,
    color: '#666',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    borderBottom: '1px solid #2a2a2a',
  },
  row: { borderBottom: '1px solid #222' },
  cell: { padding: '0.75rem', verticalAlign: 'middle' as const },
  runName: { fontWeight: 500, color: '#e5e5e5' },
  branch: {
    fontSize: '0.8rem',
    color: '#a78bfa',
    background: '#1e1a2e',
    padding: '0.15rem 0.4rem',
    borderRadius: 4,
  },
  badge: {
    display: 'inline-block',
    padding: '0.2rem 0.5rem',
    borderRadius: 4,
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
  },
  timestamp: { color: '#666', fontSize: '0.8rem' },
  actions: { display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' },
  actionBtn: {
    padding: '0.3rem 0.75rem',
    borderRadius: 6,
    border: '1px solid',
    background: 'transparent',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  empty: { color: '#555', fontSize: '0.875rem', textAlign: 'center' as const, padding: '2rem 0' },
} as const;
