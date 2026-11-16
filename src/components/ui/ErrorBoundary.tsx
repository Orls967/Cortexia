import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  title?: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[CORTEXIA ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="cx-card cx-banner-rose" role="alert" style={{ margin: 16 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{this.props.title ?? 'Component Runtime Error'}</h3>
          <p style={{ margin: '0 0 10px', fontSize: 13 }}>{this.state.error.message}</p>
          <button type="button" className="cx-btn" onClick={() => this.setState({ error: null })}>
            Reset View
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
