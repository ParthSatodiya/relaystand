'use client';

import { useEffect, useRef, useState } from 'react';
import { format, isSameMonth, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { monthGrid, shiftDays } from '@/lib/days';
import { ui } from '@/lib/ui';

export interface StandupDay {
  date: string;
  blocked: boolean;
}

/**
 * The board's day picker. The native control cannot say which days the team
 * actually stood up on, which is the only thing worth knowing when you are
 * looking for a day — so this one marks them.
 */
export default function DayPicker({
  date,
  today,
  days,
  onPick,
  onClose,
}: {
  date: string;
  today: string;
  days: StandupDay[];
  onPick: (date: string) => void;
  onClose: () => void;
}) {
  const [month, setMonth] = useState(date);
  const box = useRef<HTMLDivElement>(null);

  // Escape and a click outside both close it, like the switchers in the header.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  const held = new Map(days.map((d) => [d.date, d.blocked]));
  const lastStandup = days.find((d) => d.date <= today)?.date;

  return (
    <div
      ref={box}
      role="dialog"
      aria-label="Pick a standup day"
      className="absolute left-0 top-full z-20 mt-2 w-72 rounded-md border border-line bg-raised p-3 shadow-[0_18px_40px_rgba(0,0,0,.5)]"
    >
      <div className="flex items-center justify-between">
        <button
          onClick={() => setMonth(shiftDays(month, -28))}
          aria-label="Previous month"
          className={`${ui.btn} ${ui.btnSubtle} px-1.5 py-1`}
        >
          <ChevronLeft size={15} />
        </button>
        <p className="display text-xs tracking-[0.09em]">{format(parseISO(month), 'MMMM yyyy')}</p>
        <button
          onClick={() => setMonth(shiftDays(month, 28))}
          aria-label="Next month"
          className={`${ui.btn} ${ui.btnSubtle} px-1.5 py-1`}
        >
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-0.5 text-center">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className="pb-1 text-[10px] uppercase tracking-[0.08em] text-dim">
            {d}
          </span>
        ))}
        {monthGrid(month).map((day) => {
          const blocked = held.get(day);
          const isHeld = held.has(day);
          const outside = !isSameMonth(parseISO(day), parseISO(month));
          const ahead = day > today;
          return (
            <button
              key={day}
              disabled={ahead}
              onClick={() => onPick(day)}
              aria-current={day === date ? 'date' : undefined}
              title={isHeld ? `Standup held${blocked ? ' — something blocked' : ''}` : undefined}
              className={`relative rounded py-1.5 pb-2.5 text-[13px] tabular-nums transition disabled:opacity-25 ${
                day === date
                  ? 'bg-baton font-semibold text-baton-ink'
                  : `${outside ? 'text-dim/50' : 'text-chalk'} enabled:hover:bg-chalk/8`
              } ${day === today && day !== date ? 'ring-1 ring-baton ring-inset' : ''}`}
            >
              {format(parseISO(day), 'd')}
              {isHeld && (
                <span
                  aria-hidden="true"
                  className={`absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full ${
                    day === date ? 'bg-baton-ink' : blocked ? 'bg-stall' : 'bg-baton'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-dim">
        <span>
          <span className="mr-1 inline-block size-1 rounded-full bg-baton align-middle" />
          standup held
        </span>
        <span>
          <span className="mr-1 inline-block size-1 rounded-full bg-stall align-middle" />
          something blocked
        </span>
        <span>ring = today</span>
      </p>

      {lastStandup && lastStandup !== date && (
        <div className="mt-2.5 flex items-center justify-between border-t border-line-soft pt-2.5 text-xs text-dim">
          <span>Last standup {format(parseISO(lastStandup), 'd MMM')}</span>
          <button onClick={() => onPick(lastStandup)} className="text-baton hover:underline">
            Jump to it
          </button>
        </div>
      )}
    </div>
  );
}
