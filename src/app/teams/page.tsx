import { redirect } from 'next/navigation';

/** Teams live inside an org now; keep old links working. */
export default function TeamsIndex() {
  redirect('/orgs');
}
