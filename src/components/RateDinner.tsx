import { useState } from 'react';

type Stars = { cooking: number; cleaning: number };

/**
 * One to five stars for the cooking and one to five for the cleaning.
 *
 * Two rows rather than one score, because they are two jobs and they go wrong
 * separately. Nothing is sent until both have stars, so a half answer never
 * lands as a one.
 *
 * Holds its own choice until it is sent. The board keys it on what was last
 * saved, so a rating that arrives from the server resets it rather than being
 * shadowed by a stale tap.
 */
export function RateDinner({
  question,
  given,
  pending,
  onRate,
}: {
  question: string;
  /** The stars you already gave this night, if any. */
  given: Stars | undefined;
  pending: boolean;
  onRate: (stars: Stars) => void;
}) {
  const [cooking, setCooking] = useState(given?.cooking ?? 0);
  const [cleaning, setCleaning] = useState(given?.cleaning ?? 0);

  const complete = cooking > 0 && cleaning > 0;
  const changed = !given || given.cooking !== cooking || given.cleaning !== cleaning;

  return (
    <>
      <p className="tag">{question}</p>

      <StarRow label="Cooking" value={cooking} disabled={pending} onPick={setCooking} />
      <StarRow label="Cleaning" value={cleaning} disabled={pending} onPick={setCleaning} />

      {given && !changed ? (
        <p className="tag rate-hint">Rated. Tap the stars to change it.</p>
      ) : (
        <button
          className="btn btn-small"
          style={{ marginTop: 16 }}
          disabled={!complete || pending}
          onClick={() => onRate({ cooking, cleaning })}
        >
          {given ? 'Change rating' : 'Rate'}
        </button>
      )}
    </>
  );
}

function StarRow({
  label,
  value,
  disabled,
  onPick,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onPick: (stars: number) => void;
}) {
  return (
    <div className="rate-row" role="radiogroup" aria-label={label}>
      <span className="rate-label">{label}</span>
      <span className="stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
            className={`star${n <= value ? ' is-on' : ''}`}
            disabled={disabled}
            onClick={() => onPick(n)}
          >
            <StarMark />
          </button>
        ))}
      </span>
    </div>
  );
}

/** Also used by the stats screen, so a star means the same shape everywhere. */
export function StarMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
