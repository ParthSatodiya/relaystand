import { myOrgs, myPendingOrgs, pageUser } from '@/lib/page';
import { orgsForDomain } from '@/lib/orgs';
import AppHeader from '@/components/AppHeader';
import Onboarding from './Onboarding';

export default async function OnboardingPage() {
  const user = await pageUser();
  const [orgs, pending] = await Promise.all([myOrgs(user.email), myPendingOrgs(user.email)]);
  const suggestions = await orgsForDomain(
    user.email,
    [...orgs, ...pending].map((o) => o.id)
  );

  return (
    <>
      <AppHeader email={user.email} />
      <main className="mx-auto max-w-xl px-4 py-8">
        <Onboarding
          firstTime={orgs.length === 0}
          pending={pending.map((o) => ({ name: o.name, slug: o.slug }))}
          suggestions={suggestions.map((o) => ({ name: o.name, slug: o.slug }))}
        />
      </main>
    </>
  );
}
