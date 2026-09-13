'use client';

import { useEffect } from 'react';

const ALERT_ICON = '/icon-alert.svg';

/**
 * Swaps the tab icon to the coral mark while the board on screen needs someone.
 * Two states only: needs you, or fine. It follows the date being viewed, so an
 * old day never raises a false alarm.
 *
 * A client swap rather than a per-route `icon.tsx`: the board already knows the
 * answer, so this costs no server render and no extra query.
 */
export default function TabMark({ alert }: { alert: boolean }) {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) return;
    const original = link.href;
    link.href = alert ? ALERT_ICON : original;
    return () => {
      link.href = original;
    };
  }, [alert]);

  return null;
}
