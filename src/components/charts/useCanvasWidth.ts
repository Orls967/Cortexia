import { useEffect, useState, type RefObject } from 'react';

/** Tracks a canvas element's CSS width via ResizeObserver so charts redraw crisply on layout/drawer changes. */
export function useCanvasWidth(ref: RefObject<HTMLCanvasElement | null>, fallback = 520): number {
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const next = el.clientWidth;
      if (next > 0) setWidth((prev) => (prev === next ? prev : next));
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return width;
}
