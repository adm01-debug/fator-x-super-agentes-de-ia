import { useRef, useState, useEffect } from 'react';
import type { ChartMargin } from './types';

const DEFAULT_MARGIN: ChartMargin = { top: 8, right: 8, bottom: 24, left: 40 };

export function useChartDimensions(margin?: ChartMargin) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const m = { ...DEFAULT_MARGIN, ...margin };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const inner = {
    width: Math.max(0, size.width - (m.left ?? 0) - (m.right ?? 0)),
    height: Math.max(0, size.height - (m.top ?? 0) - (m.bottom ?? 0)),
  };

  return { ref, ...size, margin: m as Required<ChartMargin>, inner };
}
