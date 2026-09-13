import { redirect } from 'next/navigation';
import { enabledProviders, signIn } from '@/auth';
import { currentUser } from '@/lib/page';
import { ui } from '@/lib/ui';

/** Brand glyphs. Google rides on the baton fill, so its mark is drawn in ink. */
function ProviderMark({ id }: { id: string }) {
  if (id === 'google') {
    return (
      <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true" fill="currentColor">
        <path d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.5h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.6z" />
        <path d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z" />
        <path d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8l3-2.3z" />
        <path d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="0" y="0" width="7.2" height="7.2" fill="#f25022" />
      <rect x="8.8" y="0" width="7.2" height="7.2" fill="#7fba00" />
      <rect x="0" y="8.8" width="7.2" height="7.2" fill="#00a4ef" />
      <rect x="8.8" y="8.8" width="7.2" height="7.2" fill="#ffb900" />
    </svg>
  );
}

/** What people call it, not what the provider calls itself. */
const label = (id: string, name: string) =>
  id === 'microsoft-entra-id' ? 'Microsoft' : name;

export default async function LoginPage() {
  if (await currentUser()) redirect('/teams');

  return (
    <main id="main" className="mx-auto flex min-h-full max-w-5xl items-center px-5 py-12">
      <div className="grid w-full items-center gap-10 md:grid-cols-[1.1fr_0.9fr] md:gap-14">
        <div>
          <h1 className="display text-5xl leading-[0.9] sm:text-6xl">
            Relay
            <span className="block text-baton">Stand</span>
          </h1>
          <p className="mt-5 max-w-[34ch] text-base leading-relaxed text-dim">
            The standup that remembers yesterday. Unfinished work carries itself to tomorrow&apos;s
            board, with the day it started still attached.
          </p>

          {/* The lane, once, so the idea is on screen before you sign in. */}
          <div aria-hidden="true" className="mt-7 flex max-w-80 flex-col gap-1.5">
            <div className="h-3 rounded-full bg-chalk/10">
              <div className="h-full w-[22%] rounded-full bg-baton" />
            </div>
            <div className="h-3 rounded-full bg-chalk/10">
              <div className="h-full w-[58%] rounded-full bg-chalk/30" />
            </div>
            <div className="h-3 rounded-full bg-chalk/10">
              <div className="hatch h-full w-[86%] rounded-full border border-stall" />
            </div>
          </div>
          <p className="mt-2.5 text-xs text-dim">
            Lane length is how long a task has been running.
          </p>
        </div>

        <div className={`${ui.card} p-6 sm:p-7`}>
          <h2 className={ui.h2}>Sign in</h2>
          <p className="mt-2 text-sm text-dim">
            Use the work account your team already has. We match you by email.
          </p>

          <div className="mt-5 space-y-2.5">
            {enabledProviders.map((provider, i) => (
              <form
                key={provider.id}
                action={async () => {
                  'use server';
                  await signIn(provider.id, { redirectTo: '/teams' });
                }}
              >
                <button
                  type="submit"
                  className={`${ui.btn} w-full py-3 ${
                    i === 0 ? ui.btnPrimary : `${ui.btnGhost} hover:text-chalk`
                  }`}
                >
                  <ProviderMark id={provider.id} />
                  Continue with {label(provider.id, provider.name)}
                </button>
              </form>
            ))}

            {enabledProviders.length === 0 && (
              <p role="alert" className={ui.error}>
                No sign-in provider is configured. Set <code>AUTH_GOOGLE_ID</code> or{' '}
                <code>AUTH_MICROSOFT_ENTRA_ID_ID</code> in <code>.env</code>, then restart the
                server.
              </p>
            )}
          </div>

          <p className="mt-4 text-xs leading-relaxed text-dim">
            First time here? Signing in creates your account. If your organisation uses a work
            domain, you land in it straight away — otherwise ask a lead for an invite.
          </p>
        </div>
      </div>
    </main>
  );
}
