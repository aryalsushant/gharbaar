import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

const FLOOD_MS = 2200;

/**
 * Bubble seeds: position, size, delay, sideways drift.
 *
 * Fixed rather than random, so the composition is identical every time and can
 * be judged and adjusted rather than hoped for.
 */
const BUBBLES = [
  { left: 12, size: 9, delay: 0.15, drift: 14 },
  { left: 26, size: 5, delay: 0.9, drift: -10 },
  { left: 38, size: 13, delay: 0.45, drift: 8 },
  { left: 52, size: 7, delay: 1.35, drift: -16 },
  { left: 63, size: 4, delay: 0.7, drift: 12 },
  { left: 74, size: 11, delay: 1.1, drift: -8 },
  { left: 86, size: 6, delay: 0.3, drift: 10 },
  { left: 94, size: 8, delay: 1.6, drift: -12 },
];

/**
 * The room floods.
 *
 * Water climbs the whole screen rather than filling the icon, and it is real
 * glass: the body carries a backdrop-filter, so the mark and the wordmark are
 * refracted as it passes over them rather than hidden behind it. That is the
 * difference between a loading bar shaped like water and something that looks
 * wet.
 *
 * Three layers on separate clocks. The body rises once, two surface waves slide
 * sideways at different speeds so the top edge never reads as one repeating
 * shape, and bubbles drift up through it.
 *
 * Sound is synthesised, so there is no asset to load and no licence to worry
 * about, and it plays only on a tap because browsers refuse audio that starts
 * by itself.
 */
export function Splash({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const played = useRef(false);

  useEffect(() => {
    const fade = window.setTimeout(() => setLeaving(true), FLOOD_MS);
    const done = window.setTimeout(onDone, FLOOD_MS + 700);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(done);
    };
  }, [onDone]);

  function playWater() {
    if (played.current) return;
    played.current = true;

    try {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const now = ctx.currentTime;

      // A sine falling in pitch is the shape an ear reads as something
      // entering water.
      const drop = ctx.createOscillator();
      const dropGain = ctx.createGain();
      drop.type = 'sine';
      drop.frequency.setValueAtTime(820, now);
      drop.frequency.exponentialRampToValueAtTime(170, now + 0.24);
      dropGain.gain.setValueAtTime(0.0001, now);
      dropGain.gain.exponentialRampToValueAtTime(0.17, now + 0.02);
      dropGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
      drop.connect(dropGain).connect(ctx.destination);
      drop.start(now);
      drop.stop(now + 0.42);

      // Noise through a bandpass that opens as the level climbs, which is most
      // of what rising water actually sounds like.
      const frames = ctx.sampleRate * 2.4;
      const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < frames; i++) channel[i] = Math.random() * 2 - 1;

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.setValueAtTime(260, now);
      band.frequency.exponentialRampToValueAtTime(1900, now + 2.1);
      band.Q.value = 1.15;

      const swell = ctx.createGain();
      swell.gain.setValueAtTime(0.0001, now);
      swell.gain.exponentialRampToValueAtTime(0.06, now + 0.7);
      swell.gain.exponentialRampToValueAtTime(0.0001, now + 2.35);

      noise.connect(band).connect(swell).connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 2.4);

      // One low swell as it closes over the top.
      const close = ctx.createOscillator();
      const closeGain = ctx.createGain();
      close.type = 'sine';
      close.frequency.setValueAtTime(120, now + 1.7);
      close.frequency.exponentialRampToValueAtTime(58, now + 2.5);
      closeGain.gain.setValueAtTime(0.0001, now + 1.7);
      closeGain.gain.exponentialRampToValueAtTime(0.09, now + 1.95);
      closeGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.55);
      close.connect(closeGain).connect(ctx.destination);
      close.start(now + 1.7);
      close.stop(now + 2.6);

      window.setTimeout(() => void ctx.close(), 3000);
    } catch {
      // No audio available. Not worth failing the splash over.
    }
  }

  return (
    <div
      className={`splash${leaving ? ' is-leaving' : ''}`}
      onPointerDown={() => {
        playWater();
        setLeaving(true);
      }}
      role="presentation"
    >
      <div className="splash-core">
        <div className="splash-mark">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <defs>
              <linearGradient id="sp-house" x1="0.2" y1="0" x2="0.8" y2="1">
                <stop offset="0" stopColor="#ffffff" />
                <stop offset="0.5" stopColor="#cdfdf0" />
                <stop offset="1" stopColor="#9ff5df" />
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
      </div>

      {/* The flood. Its own stacking context so the surface, the glass and the
          bubbles keep their order as it climbs. */}
      <div className="flood" aria-hidden="true">
        <svg className="flood-surface" viewBox="0 0 128 12" preserveAspectRatio="none">
          <path
            className="flood-wave flood-wave-back"
            d="M0 7 q 16 -6 32 0 t 32 0 t 32 0 t 32 0 t 32 0 L192 12 L0 12 Z"
          />
          <path
            className="flood-wave flood-wave-front"
            d="M0 6 q 16 -5 32 0 t 32 0 t 32 0 t 32 0 t 32 0 L192 12 L0 12 Z"
          />
        </svg>

        <div className="flood-body">
          {BUBBLES.map((bubble, i) => (
            <span
              key={i}
              className="flood-bubble"
              style={
                {
                  left: `${bubble.left}%`,
                  width: bubble.size,
                  height: bubble.size,
                  animationDelay: `${bubble.delay}s`,
                  '--drift': `${bubble.drift}px`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
