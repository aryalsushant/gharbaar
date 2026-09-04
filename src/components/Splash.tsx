import { useCallback, useEffect, useRef, useState } from 'react';

import { Avatar } from './Avatar';

/**
 * How long the splash stays before it starts to fade.
 *
 * The drop lands at 1.15s and the name has fully surfaced by about 2.7s, so
 * this is the first moment nothing is still arriving. It used to be 4.8s, which
 * was two more seconds of a finished picture that people sat through on every
 * open.
 */
const RUN_MS = 2700;
const FADE_MS = 450;

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

  // Read through a ref so the clock starts once, on mount. Keying the effect
  // on the callback restarted it every time the parent re-rendered, and the
  // parent re-renders as the session and then the profile arrive, which on a
  // cold open pushed the whole thing out well past its own length.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const fade = window.setTimeout(() => setLeaving(true), RUN_MS);
    const done = window.setTimeout(() => onDoneRef.current(), RUN_MS + FADE_MS);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(done);
    };
  }, []);

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
      {/*
        The gooey part. A source blob at the top, a drop that necks away from it
        and falls, and a pool that swells to meet it.

        The merging is done by a filter, not by drawing: blur everything, then
        push the alpha through a steep curve so soft edges snap back to hard
        ones. Shapes that overlap after the blur come out as one surface, which
        is why the drop appears to stretch away and later melt in rather than
        sliding over the top.
      */}
      <svg className="goo" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <filter id="goo-filter">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.4" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 26 -12"
              result="goo"
            />
          </filter>

          <linearGradient id="goo-fill" gradientUnits="userSpaceOnUse" x1="30" y1="0" x2="70" y2="100">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.4" stopColor="#9ff5df" />
            <stop offset="1" stopColor="#3ec9c4" />
          </linearGradient>
        </defs>

        <g filter="url(#goo-filter)" fill="url(#goo-fill)">
          <circle className="blob-source" cx="50" cy="6" r="7" />
          <circle
            className="blob-drop"
            cx="50"
            cy="6"
            r="5.4"
            onAnimationEnd={(event) => {
              if (event.animationName === 'blob-fall') impact();
            }}
          />
          <circle className="blob-pool" cx="50" cy="88" r="6" />
        </g>

        {/* The splash: the same drop, broken into smaller ones.
            No rings and no crown. Water that lands throws water, so what leaves
            the surface is the material that arrived, in its own gooey group so
            the pieces merge with each other while still being thrown clear of
            the pool. */}
        <g className="splashes" filter="url(#goo-filter)" fill="url(#goo-fill)">
          <circle className="spray spray-1" cx="50" cy="88" r="2.2" />
          <circle className="spray spray-2" cx="50" cy="88" r="2.8" />
          <circle className="spray spray-3" cx="50" cy="88" r="1.7" />
          <circle className="spray spray-4" cx="50" cy="88" r="2.5" />
          <circle className="spray spray-5" cx="50" cy="88" r="1.5" />
          <circle className="spray spray-6" cx="50" cy="88" r="2" />
          <circle className="spray spray-7" cx="50" cy="88" r="1.3" />
          <circle className="spray spray-8" cx="50" cy="88" r="1.9" />
        </g>

      </svg>

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
