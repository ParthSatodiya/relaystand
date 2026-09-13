import NextAuth, { type NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import prisma from '@/lib/db';

// Only wire up providers that are actually configured, so a deployment that
// uses just Google (or just Microsoft) doesn't blow up on missing credentials.
const providers: NextAuthConfig['providers'] = [];
if (process.env.AUTH_GOOGLE_ID) providers.push(Google);
if (process.env.AUTH_MICROSOFT_ENTRA_ID_ID) {
  providers.push(MicrosoftEntraID({ issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER }));
}

export const enabledProviders = providers.map((p) => {
  const cfg = typeof p === 'function' ? p() : p;
  return { id: cfg.id as string, name: cfg.name as string };
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  // ponytail: JWT sessions, no Prisma adapter. The adapter would add
  // Account/Session/VerificationToken tables we never read. We only need the
  // email, and signIn keeps our own User row in sync.
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  trustHost: true, // self-hosted behind a reverse proxy
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const email = user.email.toLowerCase();
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
