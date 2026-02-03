import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-[40px] p-12 border border-slate-200 shadow-2xl text-center space-y-6">
            <div className="text-6xl">⚠️</div>
            <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">
              Something Went Wrong
            </h1>
            <p className="text-slate-600">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="w-full py-4 bg-blue-600 text-white rounded-3xl font-black text-lg uppercase italic tracking-tighter hover:bg-blue-700 transition-all"
            >
              Reload App
            </button>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="w-full py-3 bg-slate-200 text-slate-700 rounded-2xl font-bold text-sm uppercase tracking-tighter hover:bg-slate-300 transition-all"
            >
              Clear Data & Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
