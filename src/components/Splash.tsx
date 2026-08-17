import { useEffect, useRef, useState } from 'react';

/**
 * The way in. A waterline rises through the mark, the name surfaces, and the
 * app is behind it.
 *
 * Shown once per session rather than on every navigation. A splash you see
 * fifteen times a day stops being an entrance and becomes a toll.
 *
 * The sound is synthesised rather than shipped as a file: a hundred lines of
 * Web Audio weighs nothing, loads instantly, and never needs a licence. It also
 * only plays on a tap, because every browser blocks audio that starts on its
 * own, and a splash that demands sound before showing you anything is worse
 * than a silent one.
 */
export function Splash({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const played = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setLeaving(true), 1900);
    const done = window.setTimeout(onDone, 2600);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(done);
    };
  }, [onDone]);

  /** A drop, then the swell after it. Filtered noise, no samples. */
  function playWater() {
    if (played.current) return;
    played.current = true;

    try {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const now = ctx.currentTime;

      // The drop: a sine falling in pitch is the shape your ear reads as
      // something entering water.
      const drop = ctx.createOscillator();
      const dropGain = ctx.createGain();
      drop.type = 'sine';
      drop.frequency.setValueAtTime(760, now);
      drop.frequency.exponentialRampToValueAtTime(180, now + 0.22);
      dropGain.gain.setValueAtTime(0.0001, now);
      dropGain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
      dropGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      drop.connect(dropGain).connect(ctx.destination);
      drop.start(now);
      drop.stop(now + 0.4);

      // The swell: two seconds of noise through a sweeping band pass, which is
      // most of what moving water actually sounds like.
      const frames = ctx.sampleRate * 1.6;
      const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < frames; i++) channel[i] = Math.random() * 2 - 1;

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.setValueAtTime(340, now);
      band.frequency.exponentialRampToValueAtTime(1500, now + 1.2);
      band.Q.value = 1.1;

      const swell = ctx.createGain();
      swell.gain.setValueAtTime(0.0001, now);
      swell.gain.exponentialRampToValueAtTime(0.05, now + 0.5);
      swell.gain.exponentialRampToValueAtTime(0.0001, now + 1.55);

      noise.connect(band).connect(swell).connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 1.6);

      window.setTimeout(() => void ctx.close(), 2200);
    } catch {
      // No audio available. The splash is not worth failing over.
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
      <div className="splash-mark">
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <defs>
            <linearGradient id="splash-dry" x1="0.2" y1="0" x2="0.8" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.45" stopColor="#9ff5df" />
              <stop offset="1" stopColor="#63e6c8" />
            </linearGradient>
            <linearGradient id="splash-wet" x1="0" y1="0" x2="0.6" y2="1">
              <stop offset="0" stopColor="#3ec9c4" />
              <stop offset="1" stopColor="#1c7f96" />
            </linearGradient>
            <clipPath id="splash-house">
              <path d="M32 12 L53 30.6 a2.2 2.2 0 0 1 -1.5 3.9 L49.5 34.5 L49.5 52 a3 3 0 0 1 -3 3 L17.5 55 a3 3 0 0 1 -3 -3 L14.5 34.5 L12.5 34.5 a2.2 2.2 0 0 1 -1.5 -3.9 Z" />
            </clipPath>
          </defs>

          <g clipPath="url(#splash-house)">
            <rect x="0" y="0" width="64" height="64" fill="url(#splash-dry)" />
            <g className="splash-tide">
              <path
                d="M-64 40 q 8 -4.6 16 0 t 16 0 t 16 0 t 16 0 t 16 0 t 16 0 t 16 0 t 16 0 L128 70 L-64 70 Z"
                fill="url(#splash-wet)"
              />
            </g>
          </g>

          <g className="splash-tide">
            <path
              d="M-64 40 q 8 -4.6 16 0 t 16 0 t 16 0 t 16 0 t 16 0 t 16 0 t 16 0 t 16 0"
              fill="none"
              stroke="#63e6c8"
              strokeWidth="2.1"
              strokeLinecap="round"
              opacity="0.85"
            />
          </g>
        </svg>
      </div>

      <p className="splash-name">Gharbaar</p>
      <p className="splash-sub tag">घरबार</p>
    </div>
  );
}
