import { pageUser } from '@/lib/page';

export default async function OrgsLayout({ children }: { children: React.ReactNode }) {
  await pageUser();
  return <div className="min-h-full">{children}</div>;
}
