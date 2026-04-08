import { onCLS, onINP, onLCP, onFCP, onTTFB, type Metric } from 'web-vitals';
import { logger } from '@/lib/logger';

function reportMetric(metric: Metric) {
  if (import.meta.env.DEV) {
    logger.info(`[WebVitals] ${metric.name}: ${metric.value.toFixed(1)}ms (${metric.rating})`);
  }

  if (import.meta.env.PROD) {
    void JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
      navigationType: metric.navigationType,
    });
  }
}

export function initWebVitals() {
  onCLS(reportMetric);
  onINP(reportMetric);
  onLCP(reportMetric);
  onFCP(reportMetric);
  onTTFB(reportMetric);

  if (typeof PerformanceObserver !== 'undefined') {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'resource' && entry.name.endsWith('.js')) {
            const duration = entry.duration;
            if (duration > 500 && import.meta.env.DEV) {
              logger.warn(`[ChunkLoad] Slow chunk: ${entry.name.split('/').pop()} took ${duration.toFixed(0)}ms`);
            }
          }
        }
      });
      observer.observe({ type: 'resource', buffered: false });
    } catch (err) {
      logger.error("PerformanceObserver failed:", err);
    }
  }
}
