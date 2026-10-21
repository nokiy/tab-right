import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Where the dev build counter lives.
 *
 * It sits outside `src/` and is excluded from the dev server's file watcher: writing it
 * during a rebuild would otherwise trigger another rebuild, and so on forever.
 */
export const DEV_BUILD_NUMBER_FILE = resolve(import.meta.dirname, '..', '.dev-build-number');

function read(): number {
  try {
    const raw = readFileSync(DEV_BUILD_NUMBER_FILE, 'utf8').trim();
    const parsed = Number.parseInt(raw, 10);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    // First run on this machine, or the file was wiped — start over.
    return 0;
  }
}

/**
 * Returns the current dev build number, then stores the next one.
 *
 * The counter is per-machine and never committed: it answers "how many times has this
 * reloaded since I started working", not "which release is this".
 */
export function takeDevBuildNumber(): number {
  const current = read();
  writeFileSync(DEV_BUILD_NUMBER_FILE, String(current + 1), 'utf8');
  return current;
}
