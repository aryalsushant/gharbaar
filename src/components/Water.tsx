/**
 * The background. Three blurred caustic masses drifting on different clocks,
 * plus a grain layer that stops the gradients banding on OLED phones.
 *
 * Deliberately not a canvas: this is three divs and a CSS animation, so it
 * costs nothing on a phone and keeps running while React re-renders above it.
 */
export function Water() {
  return (
    <>
      <div className="water" aria-hidden="true">
        <div className="caustic caustic-a" />
        <div className="caustic caustic-b" />
        <div className="caustic caustic-c" />
      </div>
      <div className="grain" aria-hidden="true" />
    </>
  );
}
