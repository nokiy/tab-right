import { Suspense } from 'react';
import type { ComponentType, ReactNode } from 'react';

export const withSuspense = <P extends object>(ComponentToWrap: ComponentType<P>, fallback: ReactNode) => {
  return function WithSuspense(props: P) {
    return (
      <Suspense fallback={fallback}>
        <ComponentToWrap {...props} />
      </Suspense>
    );
  };
};
