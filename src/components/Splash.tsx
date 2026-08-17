import { useEffect, useRef, useState } from 'react';

const FILL_MS = 2200;

/**
 * The house fills with water, and the filling is the loading.
 *
 * Two nested transforms do the work: an outer one lifts the waterline from
 * below the foundations to above the roof, an inner one slides the wave
 * sideways on its own loop. Nesting them keeps the surface moving while it
 * rises, which is what stops it reading as a bar chart growing.
 *
 * The wordmark fills at the same time, using a hard edged gradient behind
 * background-clip: text. The letters turn from white to aqua at exactly the
 * height the water has reached, so the type is a level gauge rather than a
 * caption.
 *
 * Shown once per session, not per navigation. A splash seen fifteen times a day
 * stops being an entrance and becomes a toll, and tapping skips it.
 *
 * The sound is synthesised rather than shipped: no asset, no licence, nothing
 * to cache. It only plays on a tap, since browsers block audio that starts on
 * its own, and a splash that demands sound before showing anything is worse
 * than a silent one.
 */
export function Splash({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const played = useRef(false);

  useEffect(() => {
    const fade = window.setTimeout(() => setLeaving(true), FILL_MS);
    const done = window.setTimeout(onDone, FILL_MS + 700);
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
      drop.frequency.setValueAtTime(760, now);
      drop.frequency.exponentialRampToValueAtTime(180, now + 0.22);
      dropGain.gain.setValueAtTime(0.0001, now);
      dropGain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
      dropGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      drop.connect(dropGain).connect(ctx.destination);
      drop.start(now);
      drop.stop(now + 0.4);

      // Noise through a bandpass that opens as the level climbs, which is most
      // of what filling actually sounds like.
      const frames = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < frames; i++) channel[i] = Math.random() * 2 - 1;

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.setValueAtTime(300, now);
      band.frequency.exponentialRampToValueAtTime(1700, now + 1.8);
      band.Q.value = 1.2;

      const swell = ctx.createGain();
      swell.gain.setValueAtTime(0.0001, now);
      swell.gain.exponentialRampToValueAtTime(0.055, now + 0.6);
      swell.gain.exponentialRampToValueAtTime(0.0001, now + 1.95);

      noise.connect(band).connect(swell).connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 2);

      window.setTimeout(() => void ctx.close(), 2600);
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
      <div className="splash-mark">
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <defs>
            <linearGradient id="sp-dry" x1="0.2" y1="0" x2="0.8" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.5" stopColor="#cdfdf0" />
              <stop offset="1" stopColor="#9ff5df" />
            </linearGradient>
            <linearGradient id="sp-wet" x1="0" y1="0" x2="0.5" y2="1">
              <stop offset="0" stopColor="#4fd8cf" />
              <stop offset="1" stopColor="#1a6f8c" />
            </linearGradient>
            <clipPath id="sp-house">
              <path d="M32 12 L53 30.6 a2.2 2.2 0 0 1 -1.5 3.9 L49.5 34.5 L49.5 52 a3 3 0 0 1 -3 3 L17.5 55 a3 3 0 0 1 -3 -3 L14.5 34.5 L12.5 34.5 a2.2 2.2 0 0 1 -1.5 -3.9 Z" />
            </clipPath>
          </defs>

          <g clipPath="url(#sp-house)">
            <rect x="0" y="0" width="64" height="64" fill="url(#sp-dry)" />

            {/* Bubbles rising inside the house while it fills. */}
            <g>
              <circle className="sp-bubble sp-bubble-1" cx="24" cy="58" r="1.5" />
              <circle className="sp-bubble sp-bubble-2" cx="35" cy="58" r="1.1" />
              <circle className="sp-bubble sp-bubble-3" cx="42" cy="58" r="1.7" />
              <circle className="sp-bubble sp-bubble-4" cx="29" cy="58" r="0.9" />
            </g>

            {/* Outer group lifts the level, inner group slides the surface. */}
            <g className="sp-level">
              <g className="sp-drift">
                <path
                  d="M-64 40 q 8 -3.6 16 0 t 16 0 t 16 0 t 16 0 t 16 0 t 16 0 t 16 0 t 16 0 L128 130 L-64 130 Z"
                  fill="url(#sp-wet)"
                  opacity="0.92"
                />
                <path
                  d="M-64 40 q 8 -3.6 16 0 t 16 0 t 16 0 t 16 0 t 16 0 t 16 0 t 16 0 t 16 0"
                  fill="none"
                  stroke="#9ff5df"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </g>
            </g>
          </g>

          {/* The surface carried past the house, so it stands in water rather
              than in front of it. */}
          <g className="sp-level">
            <g className="sp-drift">
              <path
                d="M-64 40 q 8 -3.6 16 0 t 16 0 t 16 0 t 16 0 t 16 0 t 16 0 t 16 0 t 16 0"
                fill="none"
                stroke="#63e6c8"
                strokeWidth="1.6"
                strokeLinecap="round"
                opacity="0.45"
              />
            </g>
          </g>
        </svg>
      </div>

      <p className="splash-name">Gharbaar</p>
      <p className="splash-sub tag">घरबार</p>
    </div>
  );
}
