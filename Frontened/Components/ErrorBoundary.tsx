import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white p-8 rounded-2xl border border-[#FECDCA] shadow-sm max-w-2xl mx-auto my-12 text-center space-y-4">
          <div className="w-14 h-14 bg-[#FEF3F2] border border-[#FECDCA] rounded-2xl flex items-center justify-center text-[#D92D20] mx-auto">
            <AlertOctagon className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#1F2937]">
              {this.props.fallbackTitle || 'View Rendering Error'}
            </h3>
            <p className="text-xs text-[#667085] mt-1 max-w-md mx-auto">
              An unexpected error occurred while rendering this view. The system recovered and preserved all other workspace data.
            </p>
          </div>

          {this.state.error && (
            <div className="bg-[#FAFAF9] p-3 rounded-xl border border-[#E6E6E6] text-left max-h-36 overflow-auto">
              <p className="text-[11px] font-mono text-[#D92D20] break-all">
                {this.state.error.message}
              </p>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#FF9933] hover:bg-[#E68A2E] text-white text-xs font-bold rounded-xl transition shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry / Reload View</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
