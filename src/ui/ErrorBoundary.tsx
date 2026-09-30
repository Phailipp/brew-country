import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '../i18n';

interface Props {
  children: ReactNode;
  /** 'app' = full screen with reload; 'panel' = inline, the rest keeps working */
  variant?: 'app' | 'panel';
  /** Changing the key clears a panel error (e.g. switching tabs) */
  resetKey?: string;
}

interface State {
  error: Error | null;
  resetKey?: string;
}

/**
 * Catches render errors so a single broken panel never leaves a white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.resetKey) return { error: null, resetKey: props.resetKey };
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ui] render error:', error, info.componentStack);
    window.dispatchEvent(new CustomEvent('bc:ui-error', { detail: { message: error.message, stack: info.componentStack } }));
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.variant === 'panel') {
      return (
        <div className="empty" role="alert">
          <span className="empty-icon" aria-hidden="true">🫗</span>
          <span className="empty-title">{t('errors.panelTitle')}</span>
          <span>{t('errors.panelText')}</span>
          <button className="btn btn-secondary" onClick={() => this.setState({ error: null })}>{t('common.retry')}</button>
        </div>
      );
    }
    return (
      <div className="boot-screen" role="alert">
        <p className="boot-title">{t('errors.appTitle')}</p>
        <p className="muted">{t('errors.appText')}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>{t('errors.reload')}</button>
      </div>
    );
  }
}
