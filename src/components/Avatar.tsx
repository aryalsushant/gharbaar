import { useEffect, useState } from 'react';

type Props = {
  rosterKey: string | null;
  name: string;
  /** An uploaded photo, if this person ever gets one. Wins over the bundled file. */
  url?: string | null;
  size?: number;
};

/**
 * Three sources, in order: an uploaded photo, the file bundled at
 * public/people/<roster_key>.jpg, then initials.
 *
 * The fallback matters more than it looks. Photos arrive one at a time as
 * people send them, so every screen has to look deliberate with none, some or
 * all of them present. Initials on a tinted disc do that; a broken image icon
 * does not.
 *
 * jpg is tried before png because phone cameras produce jpg, but both work, so
 * nobody has to convert anything before dropping a file in.
 */
export function Avatar({ rosterKey, name, url, size = 34 }: Props) {
  const sources = [
    url,
    rosterKey ? `/people/${rosterKey}.jpg` : null,
    rosterKey ? `/people/${rosterKey}.png` : null,
  ].filter((s): s is string => !!s);

  const [attempt, setAttempt] = useState(0);

  // A newly uploaded photo should be tried again rather than staying failed.
  useEffect(() => setAttempt(0), [url, rosterKey]);

  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');

  // Tint the disc from the name so six people are six colours, consistently,
  // without anybody choosing them.
  const hue = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360;

  const style = { width: size, height: size, fontSize: size * 0.38 };

  if (attempt >= sources.length) {
    return (
      <span
        className="avatar avatar-initials"
        style={{ ...style, background: `hsl(${hue} 45% 26%)`, color: `hsl(${hue} 70% 78%)` }}
        aria-hidden="true"
      >
        {initials}
      </span>
    );
  }

  return (
    <img
      className="avatar"
      style={style}
      src={sources[attempt]}
      alt=""
      loading="lazy"
      onError={() => setAttempt((n) => n + 1)}
    />
  );
}
