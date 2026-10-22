import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log to your error service in production (optional).
    console.error('ErrorBoundary caught:', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) return this.props.fallback;
      return (
        <div className="my-3 p-4 rounded-sm border border-maple-rust/30 bg-maple-rust/5">
          <p className="font-label text-xs uppercase tracking-wider text-maple-rust mb-1">
            This block could not be displayed
          </p>
          <p className="font-body text-sm text-coffee-cream italic">
            The content is safe — only the formatted view failed. Try reloading the page.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}