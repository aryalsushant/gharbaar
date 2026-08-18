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
  askedOn: (date: string) => boolean;
};

/**
 * The week ahead, with tonight and tomorrow given real estate.
 *
 * Those two are the only ones anybody acts on, so they get a face large enough
 * to recognise across a kitchen rather than a 26px disc you have to squint at.
 * The rest of the week is reference, and is laid out as such.
 *
 * Seven days, not fourteen. The strip is computed from today, so it rolls
 * forward by itself and never needs resetting; a fortnight was just five more
 * rows nobody read.
 *
 * Nothing here is clickable. Tapping a day used to open a panel underneath the
 * strip, which is below the fold on a phone: you tapped, something happened
 * somewhere you could not see, and it looked broken. A rota is for reading.
 */
export function DayStrip({
  days,
  todayKey,
  nameOf,
  seatOf,
  photoOf,
  doneOn,
  askedOn,
}: Props) {
  const flags = (day: DutyDay) => (
    <span className="strip-flags">
      {askedOn(day.date) && <span className="flag flag-ask">cover wanted</span>}
      {day.swapped && <span className="flag flag-swap">swapped</span>}
      {doneOn(day.date) && <span className="flag flag-done">done</span>}
    </span>
  );

  const [tonight, tomorrow, ...rest] = days;

  return (
    <>
      <div className="headline-days">
        {[tonight, tomorrow].filter(Boolean).map((day, i) => (
          <div
            key={day.date}
            className={`headline-day${day.date === todayKey ? ' is-today' : ''}`}
            style={{ animationDelay: `${0.2 + i * 0.08}s` }}
          >
            <Avatar
              rosterKey={seatOf(day.assignee)}
              name={nameOf(day.assignee)}
              url={photoOf(day.assignee)}
              size={76}
            />
            <span className="tag">{dayLabel(day.date, todayKey)}</span>
            <span className="headline-name">{nameOf(day.assignee)}</span>
            {flags(day)}
          </div>
        ))}
      </div>

      <ul className="strip">
        {rest.map((day, i) => (
          <li key={day.date}>
            <div className="strip-day" style={{ animationDelay: `${0.36 + i * 0.04}s` }}>
              <span className="strip-when tag">{dayLabel(day.date, todayKey)}</span>
              <span className="strip-who">
                <Avatar
                  rosterKey={seatOf(day.assignee)}
                  name={nameOf(day.assignee)}
                  url={photoOf(day.assignee)}
                  size={30}
                />
                {nameOf(day.assignee)}
              </span>
              {flags(day)}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
