import { useEffect, useRef } from "react";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

/**
 * Animated counter using direct DOM updates (no setState per frame).
 */
export function AnimatedCounter({
  value,
  duration = 0.6,
  prefix = "",
  suffix = "",
  decimals = 0,
  className,
}: AnimatedCounterProps) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const prevValue = useRef(0);

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;

    const start = prevValue.current;
    const end = value;
    const startTime = performance.now();
    const durationMs = duration * 1000;
    let frame: number;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * eased;

      const formatted = decimals > 0
        ? current.toFixed(decimals)
        : Math.round(current).toLocaleString("pt-BR");

      el.textContent = `${prefix}${formatted}${suffix}`;

      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      } else {
        prevValue.current = end;
      }
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, prefix, suffix, decimals]);

  const initial = decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString("pt-BR");

  return (
    <span ref={spanRef} className={className}>
      {prefix}{initial}{suffix}
    </span>
  );
}
