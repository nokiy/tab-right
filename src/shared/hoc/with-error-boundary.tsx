import type { ComponentType, ReactNode } from 'react';
import { Component } from 'react';

export type FallbackProps = {
  error: Error | null;
  resetErrorBoundary: () => void;
};

type ErrorBoundaryState = {
  error: Error | null;
};

class ErrorBoundary extends Component<{
  children: ReactNode;
  fallback: ComponentType<FallbackProps>;
}> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  resetErrorBoundary = () => {
    this.setState({ error: null });
  };

  override render() {
    if (this.state.error) {
      const Fallback = this.props.fallback;
      return <Fallback error={this.state.error} resetErrorBoundary={this.resetErrorBoundary} />;
    }
    return this.props.children;
  }
}

export const withErrorBoundary = <P extends object>(
  ComponentToWrap: ComponentType<P>,
  Fallback: ComponentType<FallbackProps>,
) => {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary fallback={Fallback}>
        <ComponentToWrap {...props} />
      </ErrorBoundary>
    );
  };
};
