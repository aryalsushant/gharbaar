import { useCallback, useEffect, useRef, useState } from 'react';

import { Avatar } from './Avatar';

const RUN_MS = 4800;

type Person = {
  display_name: string;
  roster_key: string | null;
  avatar_url: string | null;
};

/**
 * One drop, and what it does to still water.
 *
 * The sound is fired by the fall animation ending rather than by a timer set
 * when the component mounted. A timer drifts: the animation does not start
 * until the browser paints, and on a cold load that is tens of milliseconds
 * after the effect runs, which is enough for the splash to be heard before it
 * is seen. animationend is the only thing that knows exactly when the drop
 * lands.
 *
 * Nothing counts as played until the AudioContext is actually running, because
 * browsers suspend a fresh one until the page has been touched, and an earlier
 * version marked it played on the attempt and stayed silent forever.
 */
export function Splash({ onDone, person }: { onDone: () => void; person?: Person }) {
  const [leaving, setLeaving] = useState(false);
  const played = useRef(false);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const fade = window.setTimeout(() => setLeaving(true), RUN_MS);
    const done = window.setTimeout(onDone, RUN_MS + 600);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(done);
    };
  }, [onDone]);

  const impact = useCallback(() => {
    if (played.current) return;

    try {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = ctxRef.current ?? new Ctx();
      ctxRef.current = ctx;

      const fire = () => {
        if (played.current || ctx.state !== 'running') return;
        played.current = true;

        const at = ctx.currentTime;

        // The impact. A sine falling in pitch is the shape an ear reads as
        // something entering water.
        const drop = ctx.createOscillator();
        const dropGain = ctx.createGain();
        drop.type = 'sine';
        drop.frequency.setValueAtTime(920, at);
        drop.frequency.exponentialRampToValueAtTime(175, at + 0.17);
        dropGain.gain.setValueAtTime(0.0001, at);
        dropGain.gain.exponentialRampToValueAtTime(0.25, at + 0.01);
        dropGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);
        drop.connect(dropGain).connect(ctx.destination);
        drop.start(at);
        drop.stop(at + 0.5);

        // The surface ringing after it, quieter and slower.
        const ring = ctx.createOscillator();
        const ringGain = ctx.createGain();
        const shape = ctx.createBiquadFilter();
        shape.type = 'lowpass';
        shape.frequency.setValueAtTime(1300, at);
        shape.frequency.exponentialRampToValueAtTime(320, at + 1.7);
        ring.type = 'sine';
        ring.frequency.setValueAtTime(330, at + 0.04);
        ring.frequency.exponentialRampToValueAtTime(128, at + 1.6);
        ringGain.gain.setValueAtTime(0.0001, at + 0.04);
        ringGain.gain.exponentialRampToValueAtTime(0.085, at + 0.16);
        ringGain.gain.exponentialRampToValueAtTime(0.0001, at + 1.85);
        ring.connect(shape).connect(ringGain).connect(ctx.destination);
        ring.start(at + 0.04);
        ring.stop(at + 1.9);
      };

      if (ctx.state === 'running') fire();
      else void ctx.resume().then(fire);
    } catch {
      // No audio available. Not worth failing the splash over.
    }
  }, []);

  // A browser that blocked audio gets one more chance on the first touch,
  // which does not dismiss anything.
  useEffect(() => {
    const onTouch = () => impact();
    window.addEventListener('pointerdown', onTouch);
    return () => {
      window.removeEventListener('pointerdown', onTouch);
      const ctx = ctxRef.current;
      window.setTimeout(() => void ctx?.close(), 2600);
    };
  }, [impact]);

  return (
    <div className={`splash${leaving ? ' is-leaving' : ''}`} role="presentation">
      <div
        className="drop"
        aria-hidden="true"
        onAnimationEnd={(event) => {
          if (event.animationName === 'fall') impact();
        }}
      >
        <span className="drop-body" />
      </div>

      {/* What the impact throws up: a crown, a rebound, and beads falling back. */}
      <div className="impact" aria-hidden="true">
        <span className="crown" />
        <span className="rebound" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={`bead bead-${i + 1}`} />
        ))}
      </div>

      <div className="ripples" aria-hidden="true">
        <span className="ripple ripple-1" />
        <span className="ripple ripple-2" />
        <span className="ripple ripple-3" />
      </div>

      <div className="splash-core">
        {/* Once somebody is signed in the drop lands on them rather than on a
            logo. The house is what greets a stranger. */}
        {person ? (
          <>
            <div className="splash-face">
              <Avatar
                rosterKey={person.roster_key}
                name={person.display_name}
                url={person.avatar_url}
                size={122}
              />
            </div>
            <p className="splash-name">{person.display_name}</p>
            <p className="splash-sub tag">Welcome home</p>
          </>
        ) : (
          <>
            <div className="splash-mark">
              <svg viewBox="0 0 64 64" aria-hidden="true">
                <defs>
                  <linearGradient id="sp-house" x1="0.2" y1="0" x2="0.8" y2="1">
                    <stop offset="0" stopColor="#ffffff" />
                    <stop offset="0.5" stopColor="#cdfdf0" />
                    <stop offset="1" stopColor="#63e6c8" />
                  </linearGradient>
                </defs>
                <path
                  d="M32 12 L53 30.6 a2.2 2.2 0 0 1 -1.5 3.9 L49.5 34.5 L49.5 52 a3 3 0 0 1 -3 3 L17.5 55 a3 3 0 0 1 -3 -3 L14.5 34.5 L12.5 34.5 a2.2 2.2 0 0 1 -1.5 -3.9 Z"
                  fill="url(#sp-house)"
                />
              </svg>
            </div>

            <p className="splash-name">Gharbaar</p>
            <p className="splash-sub tag">घरबार</p>
          </>
        )}
      </div>
    </div>
  );
}
