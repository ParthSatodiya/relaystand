import { checkEnv } from '@/lib/env';

/**
 * The side-effecting half of the boot check. Kept out of instrumentation.ts so
 * that file stays edge-safe: Next compiles instrumentation for both runtimes,
 * and a bare `process.exit` in it is a build warning even when a guard means it
 * never runs there. Reached only through a dynamic import under NEXT_RUNTIME.
 */
export function runBootChecks() {
  const { fatal, warn } = checkEnv();
  for (const line of warn) console.warn(`[relaystand] ${line}`);
  for (const line of fatal) console.error(`[relaystand] ${line}`);

  if (fatal.length) {
    console.error('[relaystand] Refusing to start. Fix the above, then restart.');
    process.exit(1);
  }
}
