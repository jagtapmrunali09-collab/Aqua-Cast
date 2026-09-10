import { Component } from 'react';
import { TriangleAlert } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('AQUA-CAST runtime error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-canvas dark:bg-slate-950 px-6 text-center">
          <TriangleAlert className="h-8 w-8 text-risk-critical" />
          <p className="text-sm font-semibold text-ink dark:text-slate-100">AQUA-CAST hit an unexpected error</p>
          <p className="max-w-md text-xs text-ink-muted dark:text-slate-400">
            {this.state.error?.message ?? 'The dashboard could not render with the current data.'}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-2 rounded border border-water-500 px-3 py-1.5 text-xs font-medium text-water-600 dark:text-water-300 hover:bg-water-50 dark:bg-water-500/10"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
