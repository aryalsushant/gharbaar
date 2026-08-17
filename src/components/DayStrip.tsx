import { Avatar } from './Avatar';
import type { DutyDay } from '../lib/duty';
import { dayLabel } from '../lib/duty';

type Props = {
  days: DutyDay[];
  todayKey: string;
  nameOf: (userId: string | null) => string;
  seatOf: (userId: string | null) => string | null;
  photoOf: (userId: string | null) => string | null;
  doneOn: (date: string) => boolean;
  finedOn: (date: string) => boolean;
  onPick: (date: string) => void;
};

/**
 * The fortnight ahead. Past days are not shown: the rotation is computed, so
 * yesterday is always answerable, but nobody needs to relitigate it and a strip
 * that scrolls both ways buries tonight in the middle.
 */
export function DayStrip({ days, todayKey, nameOf, seatOf, photoOf, doneOn, finedOn, onPick }: Props) {
  return (
    <ul className="strip">
      {days.map((day, i) => {
        const done = doneOn(day.date);
        const fined = finedOn(day.date);

        return (
          <li key={day.date}>
            <button
              className={`strip-day${day.date === todayKey ? ' is-today' : ''}`}
              onClick={() => onPick(day.date)}
              style={{ animationDelay: `${0.24 + i * 0.035}s` }}
            >
              <span className="strip-when tag">{dayLabel(day.date, todayKey)}</span>
              <span className="strip-who">
                <Avatar
                  rosterKey={seatOf(day.assignee)}
                  name={nameOf(day.assignee)}
                  url={photoOf(day.assignee)}
                  size={26}
                />
                {nameOf(day.assignee)}
              </span>

              <span className="strip-flags">
                {day.swapped && <span className="flag flag-swap">swapped</span>}
                {done && <span className="flag flag-done">done</span>}
                {fined && <span className="flag flag-fined">$10</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
