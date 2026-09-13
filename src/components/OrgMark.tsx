'use client';

import { useState } from 'react';
import { initials } from '@/lib/ui';

/** The org's logo, or its initials when it has none — or when the file is gone. */
export default function OrgMark({
  org,
  size = 8,
  url,
}: {
  org: { name: string; logoPath: string };
  size?: 5 | 8 | 12;
  /** Resolved by the server: storage().url(logoPath). */
  url?: string;
}) {
  const [broken, setBroken] = useState(false);
  const box = { 5: 'size-5 text-[9px]', 8: 'size-8 text-xs', 12: 'size-12 text-base' }[size];

  if (org.logoPath && url && !broken) {
    return (
      // Served by our own storage route, which a cloud backend can point
      // elsewhere later; next/image would want a loader per backend.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        onError={() => setBroken(true)}
        // A plate behind it: uploaded logos are drawn for white paper, and a
        // transparent or pale one disappears straight into the dark ground.
        className={`${box} shrink-0 rounded bg-chalk object-contain p-0.5`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${box} display grid shrink-0 place-items-center rounded bg-baton text-baton-ink`}
    >
      {initials(org.name)}
    </span>
  );
}
