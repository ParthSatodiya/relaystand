/**
 * Pure day helpers — no Prisma import, so client components can pull from here
 * without dragging the database client into the browser bundle.
 *
 * Dates are `YYYY-MM-DD` strings at every boundary; the Date objects live and
 * die inside these functions.
 */
import { addDays, format, getDay, parseISO, subDays } from 'date-fns';

/** A plain calendar step, in and out as `YYYY-MM-DD`. */
export function shiftDays(date: string, days: number) {
  return format(addDays(parseISO(date), days), 'yyyy-MM-dd');
}

/** Saturday and Sunday never take a column of their own. */
export function isWeekend(date: string) {
  const day = getDay(parseISO(date));
  return day === 0 || day === 6;
}

/**
 * One press of the board's arrows. The team does not work weekends, so a step
 * walks over them — unless they actually stood up on one, in which case that day
 * has work on it and is worth stopping at.
 */
export function stepDay(date: string, dir: -1 | 1, standupDates: Iterable<string>) {
  const held = new Set(standupDates);
  let at = date;
  // Saturday and Sunday together, so a single step never walks more than this.
  for (let hops = 0; hops < 3; hops++) {
    at = format(addDays(parseISO(at), dir), 'yyyy-MM-dd');
    if (!isWeekend(at) || held.has(at)) return at;
  }
  return at;
}

/**
 * The columns of the week grid: the last `count` working days ending at
 * `endDate`, plus any weekend that actually held a standup — a team that stood
 * up on a Saturday should still see it. Pure, so the test can pin it.
 */
export function weekColumns(endDate: string, standupDates: Iterable<string>, count = 5) {
  const held = new Set(standupDates);
  const columns: string[] = [];
  // A run of five working days spans at most seven days; twenty is slack for a
  // long holiday without turning this into an unbounded walk.
  for (let back = 0; back < 20 && columns.length < count; back++) {
    const date = format(subDays(parseISO(endDate), back), 'yyyy-MM-dd');
    // The day being viewed always earns its column: picking a Saturday from the
    // date field is how you start a weekend standup, so it has to be on screen.
    if (back === 0 || !isWeekend(date) || held.has(date)) columns.push(date);
  }
  return columns.reverse();
}

