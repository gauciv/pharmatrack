import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './assets/index.css'

interface ErrorBoundaryState {
  error: Error | null
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render(): React.ReactNode {
    const { error } = this.state
    if (error) {
      return (
        <div
          style={{
            padding: '2rem',
            fontFamily: 'monospace',
            color: '#dc2626',
            background: '#fff',
            height: '100vh',
            overflow: 'auto',
          }}
        >
          <h2 style={{ marginBottom: '0.5rem' }}>Render error — check DevTools for details</h2>
          <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>{error.message}</p>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '12px', color: '#555' }}>
            {error.stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: '1rem', padding: '0.4rem 1rem', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
