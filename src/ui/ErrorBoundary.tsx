import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  /** Optional custom fallback UI. Receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors in the subtree and shows a recovery UI instead of
 * crashing the entire app. Wrap top-level sections (GameApp, panels, etc.)
 * with this component.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production you'd send this to Sentry / Datadog here
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;

    if (error) {
      if (this.props.fallback) {
        return this.props.fallback(error, this.reset);
      }

      return (
        <div className="error-boundary-fallback" role="alert">
          <div className="error-boundary-card">
            <h2 className="error-boundary-title">Etwas ist schiefgelaufen</h2>
            <p className="error-boundary-message">{error.message}</p>
            <button className="error-boundary-btn" onClick={this.reset}>
              Neu laden
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
