/** Shared class strings so every screen looks like one app. See DESIGN.md. */
export const ui = {
  card: 'rounded-md border border-line bg-raised',
  input:
    // text-base below sm: iOS Safari zooms the page when a focused field is under 16px.
    'rounded border border-line bg-raised px-3 py-2 text-base text-chalk outline-none transition sm:text-sm placeholder:text-dim focus:border-baton focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-baton',
  btn: 'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded px-3.5 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-baton disabled:cursor-not-allowed',
  // Dimming the baton fill turns it olive, so a disabled primary drops the fill
  // entirely rather than fading it.
  btnPrimary:
    'bg-baton text-baton-ink font-semibold hover:brightness-105 disabled:bg-chalk/12 disabled:text-dim disabled:hover:brightness-100',
  btnGhost: 'border border-line text-chalk hover:border-baton hover:text-baton disabled:opacity-40',
  btnSubtle: 'text-dim hover:bg-chalk/8 hover:text-chalk disabled:opacity-40',
  btnDanger: 'border border-line text-dim hover:border-stall hover:text-stall disabled:opacity-40',
  // block: an inline label flows onto the same line as a narrow input
  label: 'block text-[11px] font-medium uppercase tracking-[0.13em] text-dim',
  error: 'rounded border border-stall border-l-4 bg-stall/10 px-3 py-2 text-sm text-chalk',
  empty: 'rounded-md border border-dashed border-line p-10 text-center',
  /** Page and section headings. Anton, uppercase — never for running text. */
  h1: 'display text-3xl sm:text-4xl',
  h2: 'display text-sm tracking-[0.11em]',
  /**
   * A control that lives inside a row and gets out of the way on hover-capable
   * screens. Stays put below `sm`, where there is no hover to reveal it.
   * Put it on the control itself; the row needs `group`.
   */
  rowAction:
    'opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 sm:focus-visible:opacity-100',
} as const;

// text-dim is 4.9:1 on the track ground — the lightest text colour allowed.
// Anything fainter is decoration (rules, lane grounds), never words.

export const statusPill: Record<string, string> = {
  open: 'border-line text-dim',
  done: 'border-baton bg-baton text-baton-ink font-semibold',
  blocked: 'border-stall text-stall hatch',
};

/** What each status is called on screen — never the raw database word. */
export const statusLabel: Record<string, string> = {
  open: 'running',
  done: 'finished',
  blocked: 'blocked',
};

/** Shape of a status pill; `statusPill[status]` supplies the colours. */
export const pill =
  'rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-[0.09em] whitespace-nowrap';

/** A task goes amber once it has dragged this long — one threshold, one place. */
export const DRAGGING_DAYS = 3;

/** Over five days it is red: the same line the reports draw. */
export const STALLED_DAYS = 5;

export const daysTone = (days: number) =>
  days >= STALLED_DAYS
    ? 'text-stall font-semibold'
    : days >= DRAGGING_DAYS
      ? 'text-warn'
      : 'text-dim';

/**
 * Lane bar width: days running, capped so one ancient task does not flatten the
 * rest. Ten days fills the track.
 */
export const laneWidth = (days: number) => `${Math.min(100, Math.max(8, days * 10))}%`;

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}
