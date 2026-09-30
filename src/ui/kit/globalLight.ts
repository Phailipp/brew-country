/**
 * One "light source" for the whole UI: specular highlights on glass surfaces
 * lean towards the last pointer / touch position (CSS vars --lx / --ly).
 * rAF-throttled, passive listeners, no React re-renders.
 */
export function installGlobalLight(): () => void {
  const root = document.documentElement;
  let frame = 0;
  let x = 0.3;
  let y = 0;

  const apply = () => {
    frame = 0;
    root.style.setProperty('--lx', `${Math.round(x * 100)}%`);
    root.style.setProperty('--ly', `${Math.round(y * 100 - 20)}%`);
  };
  const onMove = (e: PointerEvent) => {
    x = e.clientX / Math.max(1, window.innerWidth);
    y = e.clientY / Math.max(1, window.innerHeight);
    if (!frame) frame = requestAnimationFrame(apply);
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onMove, { passive: true });
  return () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerdown', onMove);
    if (frame) cancelAnimationFrame(frame);
  };
}
