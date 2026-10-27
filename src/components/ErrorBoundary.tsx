import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
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
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
              ⚠️
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              কিছু একটা সমস্যা হয়েছে
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">
              ওয়েবসাইটটি লোড করতে একটি ত্রুটি ঘটেছে। অনুগ্রহ করে পৃষ্ঠাটি রিফ্রেশ করুন।
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition shadow-md shadow-emerald-600/20"
            >
              পৃষ্ঠা রিফ্রেশ করুন
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
