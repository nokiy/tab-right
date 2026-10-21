/**
 * [POS]: Reads the macOS/Chrome system reduced-motion preference, live
 */
import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

// This reflects a system preference (System Settings > Accessibility on macOS), not an
// extension setting — it affects all of Chrome's and the web's animations, not just
// Tab_Right's. The options page only reports it; it has no control to change it.
export const useReducedMotionPreference = (
  matchMedia: (query: string) => MediaQueryList = window.matchMedia.bind(window),
): boolean => {
  const [reduced, setReduced] = useState(() => matchMedia(QUERY).matches);

  useEffect(() => {
    const mql = matchMedia(QUERY);
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    mql.addEventListener('change', listener);
    return () => mql.removeEventListener('change', listener);
  }, [matchMedia]);

  return reduced;
};
