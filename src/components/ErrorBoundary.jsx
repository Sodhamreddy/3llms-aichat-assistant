import { Component } from 'react';

// Catches render/runtime errors anywhere below it so a single failing component
// shows a message instead of blanking the whole app.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // Full detail for debugging; visible in the browser console.
    console.error('[ErrorBoundary] Uncaught error:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const { error } = this.state;
    return (
      <div style={{ minHeight: '100vh', background: '#f5f4f0', display: 'grid', placeItems: 'center', padding: '2rem', fontFamily: 'Inter, system-ui, sans-serif', color: '#0f172a' }}>
        <div style={{ maxWidth: 460, textAlign: 'center' }}>
          <h1 style={{ color: '#b91c1c', margin: '0 0 0.5rem' }}>Something went wrong</h1>
          <p style={{ color: '#64748b', lineHeight: 1.6 }}>
            {String(error?.message || 'An unexpected error occurred.')}
          </p>
          <p style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
            Check the browser console for details, then reload the page.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ marginTop: '1rem', border: 'none', borderRadius: 999, background: '#0d46d8', color: '#fff', padding: '0.7rem 1.4rem', fontWeight: 800, cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
