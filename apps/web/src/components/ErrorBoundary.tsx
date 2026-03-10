import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Required class component — React still needs a class-based ErrorBoundary
 * to catch errors thrown by use() when a promise rejects.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={styles.container}>
          <p style={styles.title}>Failed to load runs</p>
          <p style={styles.message}>{this.state.error.message}</p>
          <button
            style={styles.button}
            onClick={() => this.setState({ error: null })}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const styles = {
  container: {
    background: '#1a1a1a',
    border: '1px solid #3f1515',
    borderRadius: 8,
    padding: '2rem',
    textAlign: 'center' as const,
  },
  title: { color: '#f87171', fontWeight: 600, margin: '0 0 0.5rem' },
  message: { color: '#888', fontSize: '0.875rem', margin: '0 0 1rem' },
  button: {
    padding: '0.4rem 1rem',
    borderRadius: 6,
    border: '1px solid #555',
    background: 'transparent',
    color: '#ccc',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
} as const;
