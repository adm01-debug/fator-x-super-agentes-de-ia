import { onCLS, onINP, onLCP, onFCP, onTTFB, type Metric } from 'web-vitals';
import { logger } from '@/lib/logger';

function reportMetric(metric: Metric) {
  // Log in development, could be sent to analytics in production
  if (import.meta.env.DEV) {
    logger.debug(`[WebVitals] ${metric.name}: ${metric.value.toFixed(1)}ms (${metric.rating})`);
  }

  // Production: send to analytics endpoint
  if (import.meta.env.PROD) {
    // Beacon API for reliable delivery
    void JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
      navigationType: metric.navigationType,
    });
    
    // Could be configured to send to a real analytics endpoint
    // navigator.sendBeacon?.('/api/vitals', body);
  }
}

export function initWebVitals() {
  onCLS(reportMetric);
  onINP(reportMetric);
  onLCP(reportMetric);
  onFCP(reportMetric);
  onTTFB(reportMetric);

  // Track lazy chunk load performance
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
    } catch (err) { logger.error("PerformanceObserver not supported", { error: err });
      // PerformanceObserver not supported
    }
  }
}
