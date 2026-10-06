import { checkEnv } from '@/lib/env';

/**
 * Next calls this once per server instance, before the first request. The one
 * place this app has that is genuinely "boot".
 */
export function register() {
  // Also runs for the edge runtime, where process.exit does not exist and none
  // of these variables are read anyway.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { fatal, warn } = checkEnv();
  for (const line of warn) console.warn(`[relaystand] ${line}`);
  for (const line of fatal) console.error(`[relaystand] ${line}`);

  if (fatal.length) {
    console.error('[relaystand] Refusing to start. Fix the above, then restart.');
    process.exit(1);
  }
}
