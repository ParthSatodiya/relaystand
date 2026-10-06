import NextAuth, { type NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import GitHub from 'next-auth/providers/github';
import Credentials from 'next-auth/providers/credentials';
import prisma from '@/lib/db';
import { demoMode, signUpAllowed, signUpIsOpen } from '@/lib/signup';

// Only wire up providers that are actually configured, so a deployment that
// uses just Google (or just Microsoft) doesn't blow up on missing credentials.
const providers: NextAuthConfig['providers'] = [];
if (process.env.AUTH_GOOGLE_ID) providers.push(Google);
if (process.env.AUTH_MICROSOFT_ENTRA_ID_ID) {
  providers.push(MicrosoftEntraID({ issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER }));
}
if (process.env.AUTH_GITHUB_ID) {
  providers.push(
    GitHub({
      /**
       * Overridden for one word: `verified`.
       *
       * The stock provider takes `emails.find(e => e.primary) ?? emails[0]`
       * and never looks at `e.verified`, even though GitHub returns it. For
       * most apps that is harmless — the email is a display detail. Here the
       * email IS the identity (ADR-0001), matched straight against
       * TeamMember.email, so an unverified address is a claim on somebody
       * else's tasks. Take the verified primary, or a verified one, or none:
       * the signIn callback refuses an account with no email.
       */
      userinfo: {
        url: 'https://api.github.com/user',
        async request({ tokens }: { tokens: { access_token?: string } }) {
          const headers = {
            Authorization: `Bearer ${tokens.access_token}`,
            'User-Agent': 'relaystand',
          };
          const [profile, res] = await Promise.all([
            fetch('https://api.github.com/user', { headers }).then((r) => r.json()),
            fetch('https://api.github.com/user/emails', { headers }),
          ]);
          const emails: { email: string; primary: boolean; verified: boolean }[] = res.ok
            ? await res.json()
            : [];
          const verified = emails.filter((e) => e.verified);
          profile.email = (verified.find((e) => e.primary) ?? verified[0])?.email ?? null;
          return profile;
        },
      },
    })
  );
}

// `npm run demo`: one click into the seeded team, no OAuth app to register.
// demoMode() refuses outright under NODE_ENV=production, so this provider does
// not exist in the Docker image or any real build — there is nothing to
// misconfigure. It signs in as an existing row and creates nobody.
if (demoMode()) {
  providers.push(
    Credentials({
      id: 'demo',
      name: 'the demo team',
      credentials: {},
      authorize: async () => {
        const wanted = process.env.DEMO_EMAIL?.toLowerCase();
        const user = wanted
          ? await prisma.user.findUnique({ where: { email: wanted } })
          : await prisma.user.findFirst({ orderBy: { id: 'asc' } });
        if (!user?.isActive) return null;
        return { id: String(user.id), email: user.email, name: user.fullName };
      },
    })
  );
}

export const enabledProviders = providers.map((p) => {
  const raw = typeof p === 'function' ? p() : p;
  // Credentials() returns a fixed id and name and stashes the caller's config
  // under `options` for NextAuth to merge later, so the bare object claims to
  // be "credentials". Merge it here or the login page names the wrong thing.
  const cfg = { ...raw, ...((raw as { options?: Record<string, unknown> }).options ?? {}) };
  return { id: cfg.id as string, name: cfg.name as string };
});

if (demoMode()) {
  console.warn(
    '[relaystand] DEMO MODE: anyone who reaches /login can sign in as the demo ' +
      'lead, with no password. Local use only — it cannot be switched on in a ' +
      'production build.'
  );
}

// Said once per process, because the default is the dangerous one: an OAuth
// client in "any account" mode plus no list here means the whole internet can
// sign up on this server. The demo provider is not one of those — it authorises
// nobody new — so it does not trigger this on its own.
if (providers.length > (demoMode() ? 1 : 0) && signUpIsOpen()) {
  console.warn(
    '[relaystand] Sign-in is open to any account your provider authenticates. ' +
      'Set AUTH_ALLOWED_DOMAINS or AUTH_ALLOWED_EMAILS to restrict it.'
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  // ponytail: JWT sessions, no Prisma adapter. The adapter would add
  // Account/Session/VerificationToken tables we never read. We only need the
  // email, and signIn keeps our own User row in sync.
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  trustHost: true, // self-hosted behind a reverse proxy
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;
      const email = user.email.toLowerCase();
      // The demo provider already resolved an existing row; it never creates
      // one, so the allowlist has nothing to decide. Guarded by demoMode(),
      // which is why this cannot be reached in a production build.
      if (account?.provider === 'demo' && demoMode()) return true;
      // Before the upsert: a refused address must not leave a User row behind.
      if (!signUpAllowed(email)) return '/login?denied=1';
      const fullName = user.name || email;
      const avatarUrl = user.image || '';
      await prisma.user.upsert({
        where: { email },
        update: { fullName, avatarUrl },
        create: { email, fullName, avatarUrl },
      });
      return true;
    },
  },
});
