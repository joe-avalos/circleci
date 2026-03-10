import { useActionState, useRef } from 'react';
import { createRun } from '../api/runs';

interface Props {
  onCreated: () => void;
}

/**
 * useActionState (React 19) replaces the manual useState + loading flag pattern:
 *  - state  → the action's return value (error message or null)
 *  - action → pass directly to <form action={...}>
 *  - isPending → true while the async action is in flight
 *
 * No more onSubmit handlers, e.preventDefault(), or separate loading state.
 */
export function CreateRun({ onCreated }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  const [error, action, isPending] = useActionState(
    async (_prev: string | null, formData: FormData) => {
      const name = (formData.get('name') as string).trim();
      const branch = (formData.get('branch') as string).trim();

      if (!name) return 'Run name is required';

      try {
        await createRun(name, branch);
        formRef.current?.reset();
        onCreated();
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : 'Failed to create run';
      }
    },
    null,
  );

  return (
    <section style={styles.card}>
      <h2 style={styles.cardTitle}>New Pipeline Run</h2>
      <form ref={formRef} action={action} style={styles.form}>
        <div style={styles.field}>
          <label htmlFor="run-name" style={styles.label}>Run name</label>
          <input
            id="run-name"
            name="name"
            placeholder="e.g. build-main"
            style={styles.input}
            disabled={isPending}
            required
          />
        </div>

        <div style={styles.field}>
          <label htmlFor="run-branch" style={styles.label}>Branch</label>
          <input
            id="run-branch"
            name="branch"
            placeholder="e.g. main"
            defaultValue="main"
            style={styles.input}
            disabled={isPending}
            required
          />
        </div>

        <button type="submit" style={styles.button} disabled={isPending}>
          {isPending ? 'Creating…' : 'Create Run'}
        </button>
      </form>

      {error && <p style={styles.error}>{error}</p>}
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
  cardTitle: {
    margin: '0 0 1rem',
    fontSize: '1rem',
    fontWeight: 600,
    color: '#f0f0f0',
  },
  form: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'flex-end',
    flexWrap: 'wrap' as const,
  },
  field: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.4rem',
    flex: 1,
    minWidth: 180,
  },
  label: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: '#999',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  input: {
    padding: '0.5rem 0.75rem',
    borderRadius: 6,
    border: '1px solid #333',
    background: '#111',
    color: '#e5e5e5',
    fontSize: '0.875rem',
    outline: 'none',
  },
  button: {
    padding: '0.5rem 1.25rem',
    borderRadius: 6,
    border: 'none',
    background: '#4f46e5',
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.875rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  error: {
    marginTop: '0.75rem',
    fontSize: '0.875rem',
    color: '#f87171',
  },
} as const;
