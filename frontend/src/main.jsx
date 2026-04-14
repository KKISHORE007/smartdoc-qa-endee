import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

/**
 * Error Boundary — prevents black screen crashes.
 * Catches any React rendering or lifecycle errors and shows a recovery UI.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('SmartDoc AI crashed:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0f',
          color: '#f0f0f5',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          padding: '2rem',
          textAlign: 'center',
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #7c5cfc, #a855f7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '24px',
            boxShadow: '0 0 40px rgba(124, 92, 252, 0.3)',
          }}>
            <span style={{ fontSize: '28px' }}>🧠</span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#8888a0', fontSize: '14px', maxWidth: '400px', lineHeight: 1.6, marginBottom: '24px' }}>
            SmartDoc AI encountered an unexpected error. This can happen when switching between online and offline modes.
          </p>
          <div style={{
            background: '#16161f',
            border: '1px solid #2a2a3a',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '24px',
            maxWidth: '500px',
            width: '100%',
            textAlign: 'left',
          }}>
            <p style={{ fontSize: '10px', color: '#55556a', fontWeight: 700, letterSpacing: '0.1em', marginBottom: '6px', textTransform: 'uppercase' }}>
              Error Details
            </p>
            <p style={{ fontSize: '12px', color: '#f87171', fontFamily: '"Fira Code", monospace', wordBreak: 'break-all' }}>
              {this.state.error?.message || 'Unknown error'}
            </p>
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              padding: '12px 32px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #7c5cfc, #a855f7)',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(124, 92, 252, 0.4)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            Reload SmartDoc AI
          </button>
          <p style={{ color: '#55556a', fontSize: '11px', marginTop: '16px' }}>
            Your documents and chat history are safe.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
