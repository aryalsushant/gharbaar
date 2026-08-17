import { useEffect, useRef, useState } from 'react';

import { Avatar } from './Avatar';

const RUN_MS = 5200;

/** When the drop meets the surface. Everything else hangs off this. */
const IMPACT_MS = 1500;

/**
 * One drop, and what it does to still water.
 *
 * The previous version flooded the screen with a rising body, two sliding
 * waves, eight bubbles and a heavy backdrop blur. Every part was plausible and
 * together they read as artificial, because nothing in water moves to that many
 * clocks at once and blur at that strength bands on a dark background.
 *
 * This is one event with consequences. A drop falls, it lands, and rings spread
 * from where it hit while the house surfaces through them. Three rings on the
 * same easing, no blur, no compositing tricks: the calm comes from restraint
 * rather than from adding a calm-looking effect.
 *
 * Sound is tried immediately and falls back to the first touch, because a
 * browser that refuses autoplay would otherwise leave it silent forever. The
 * touch no longer skips the splash, which is why it used to be silent even when
 * somebody tapped: the tap played a sound and dismissed the screen playing it.
 */
type Person = {
  display_name: string;
  roster_key: string | null;
  avatar_url: string | null;
};

export function Splash({ onDone, person }: { onDone: () => void; person?: Person }) {
  const [leaving, setLeaving] = useState(false);
  const played = useRef(false);

  useEffect(() => {
    const fade = window.setTimeout(() => setLeaving(true), RUN_MS);
    const done = window.setTimeout(onDone, RUN_MS + 600);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(done);
    };
  }, [onDone]);

  useEffect(() => {
    /**
     * A drop landing, then the ring of it.
     *
     * Built rather than sampled: a sine falling in pitch is the shape an ear
     * reads as something entering water, and a short resonant tail is the
     * surface answering.
     *
     * The awkward part is permission. A browser suspends a fresh AudioContext
     * until the page has been touched, and the previous version marked the
     * sound as played the moment it tried, so the fallback on first touch never
     * ran and it was silent forever. Nothing counts as played until the context
     * is actually running.
     */
    let ctx: AudioContext | null = null;

    function schedule(context: AudioContext) {
      if (played.current) return;
      played.current = true;

      const at = context.currentTime + 0.05;

      // The impact.
      const drop = context.createOscillator();
      const dropGain = context.createGain();
      drop.type = 'sine';
      drop.frequency.setValueAtTime(900, at);
      drop.frequency.exponentialRampToValueAtTime(180, at + 0.18);
      dropGain.gain.setValueAtTime(0.0001, at);
      dropGain.gain.exponentialRampToValueAtTime(0.24, at + 0.012);
      dropGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);
      drop.connect(dropGain).connect(context.destination);
      drop.start(at);
      drop.stop(at + 0.5);

      // The surface ringing after it, quieter and slower.
      const ring = context.createOscillator();
      const ringGain = context.createGain();
      const shape = context.createBiquadFilter();
      shape.type = 'lowpass';
      shape.frequency.setValueAtTime(1300, at);
      shape.frequency.exponentialRampToValueAtTime(320, at + 1.7);
      ring.type = 'sine';
      ring.frequency.setValueAtTime(330, at + 0.05);
      ring.frequency.exponentialRampToValueAtTime(128, at + 1.6);
      ringGain.gain.setValueAtTime(0.0001, at + 0.05);
      ringGain.gain.exponentialRampToValueAtTime(0.085, at + 0.17);
      ringGain.gain.exponentialRampToValueAtTime(0.0001, at + 1.85);
      ring.connect(shape).connect(ringGain).connect(context.destination);
      ring.start(at + 0.05);
      ring.stop(at + 1.9);
    }

    /** Fires when the drop lands, or on first touch if audio was blocked. */
    function attempt() {
      try {
        const Ctx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctx = ctx ?? new Ctx();
        if (ctx.state === 'running') {
          schedule(ctx);
          return;
        }
        void ctx.resume().then(() => {
          if (ctx && ctx.state === 'running') schedule(ctx);
        });
      } catch {
        // No audio available. Not worth failing the splash over.
      }
    }

    // Timed to the moment the drop meets the surface.
    const landing = window.setTimeout(attempt, IMPACT_MS);
    const onTouch = () => attempt();
    window.addEventListener('pointerdown', onTouch);

    return () => {
      window.clearTimeout(landing);
      window.removeEventListener('pointerdown', onTouch);
      window.setTimeout(() => void ctx?.close(), 2600);
    };
  }, []);

  return (
    <div className={`splash${leaving ? ' is-leaving' : ''}`} role="presentation">
      <div className="drop" aria-hidden="true">
        <span className="drop-body" />
      </div>

      {/* What the impact throws up: a crown, then beads falling back. */}
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
            logo. The house is what greets a stranger; a housemate gets their
            own face. */}
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
