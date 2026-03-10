import { useRuns } from './hooks/useRuns';
import { CreateRun } from './components/CreateRun';
import { RunsList } from './components/RunsList';

function RunsPage() {
  const { runs, loading, isPending, refresh, advance } = useRuns();

  if (loading) return <LoadingSkeleton />;

  return (
    <>
      <CreateRun onCreated={refresh} />
      <RunsList
        runs={runs}
        isPending={isPending}
        onAdvance={advance}
        onRefresh={refresh}
      />
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div style={skeletonStyles.card}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={skeletonStyles.row} />
      ))}
    </div>
  );
}

export default function App() {
  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h1 style={styles.title}>Pipeline Run Simulator</h1>
        <p style={styles.subtitle}>
          Create runs, advance their status, and watch traces flow to Honeycomb.
        </p>
      </header>

      <main style={styles.main}>
        <RunsPage />
      </main>
    </div>
  );
}

const styles = {
  app: { fontFamily: '"Inter", system-ui, sans-serif', minHeight: '100vh', background: '#0f0f0f', color: '#e5e5e5' },
  header: { padding: '2rem', borderBottom: '1px solid #2a2a2a', background: '#161616' },
  title: { margin: 0, fontSize: '1.5rem', fontWeight: 600, color: '#f5f5f5' },
  subtitle: { margin: '0.4rem 0 0', fontSize: '0.875rem', color: '#888' },
  main: { maxWidth: 860, margin: '2rem auto', padding: '0 1.5rem', display: 'flex', flexDirection: 'column' as const, gap: '2rem' },
} as const;

const skeletonStyles = {
  card: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '1.5rem', display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' },
  row: { height: 40, background: '#252525', borderRadius: 6 },
} as const;
