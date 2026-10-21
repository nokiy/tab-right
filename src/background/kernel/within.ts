/**
 * [POS]: Bounded wait — caps any Promise with the injected clock, telling done, timeout and error apart
 */
import type { Clock } from './types';

export type Bounded<T> = { kind: 'ok'; value: T } | { kind: 'timeout' } | { kind: 'error'; error: unknown };

// Races `work` against `ms` on the injected clock. A late result after the timeout
// is simply dropped: the caller has already moved on.
export const within = <T>(clock: Clock, ms: number, work: Promise<T>): Promise<Bounded<T>> =>
  new Promise(resolve => {
    let done = false;
    const finish = (outcome: Bounded<T>) => {
      if (done) return;
      done = true;
      cancel();
      resolve(outcome);
    };
    const cancel = clock.schedule(Math.max(0, ms), () => finish({ kind: 'timeout' }));
    work.then(
      value => finish({ kind: 'ok', value }),
      error => finish({ kind: 'error', error }),
    );
  });

export const describeError = (error: unknown): string => (error instanceof Error ? error.message : String(error));
