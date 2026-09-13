import { pageUser } from '@/lib/page';

/**
 * The auth gate for every team screen. The header lives one level down in
 * [teamId]/layout.tsx, which knows the team and so can name its org.
 */
export default async function TeamsLayout({ children }: { children: React.ReactNode }) {
  await pageUser();
  return <div className="min-h-full">{children}</div>;
}
