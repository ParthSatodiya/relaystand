/**
 * Next calls this once per server instance, before the first request. The one
 * place this app has that is genuinely "boot".
 */
export async function register() {
  // Edge gets none of this: process.exit does not exist there, and none of the
  // variables are read. The import is dynamic so the edge bundle never sees it.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { runBootChecks } = await import('@/lib/boot');
  runBootChecks();
}
