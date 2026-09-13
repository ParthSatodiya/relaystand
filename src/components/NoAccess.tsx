import Link from 'next/link';
import { ui } from '@/lib/ui';

export default function NoAccess() {
  return (
    <div className={ui.empty}>
      <p className="font-medium">You are not on this team</p>
      <p className="mt-1 text-sm text-dim">
        Ask its lead to add you by your work email.
      </p>
      <Link href="/teams" className={`${ui.btn} ${ui.btnGhost} mt-5`}>
        Back to your teams
      </Link>
    </div>
  );
}
