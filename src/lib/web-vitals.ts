/**
 * Lightweight Core Web Vitals monitoring using the Performance API directly.
 * Reports LCP, CLS, and FID metrics via the application logger.
 */

import { logger } from './logger';

const CONTEXT = 'WebVitals';

interface WebVitalMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

function rateMetric(name: string, value: number): WebVitalMetric['rating'] {
  switch (name) {
    case 'LCP':
      return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
    case 'CLS':
      return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor';
    case 'FID':
      return value <= 100 ? 'good' : value <= 300 ? 'needs-improvement' : 'poor';
    default:
      return 'good';
  }
}

function reportMetric(metric: WebVitalMetric) {
  logger.info(`${metric.name}: ${metric.value.toFixed(2)} (${metric.rating})`, CONTEXT, {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
  });
}

function observeLCP() {
  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        const value = lastEntry.startTime;
        reportMetric({ name: 'LCP', value, rating: rateMetric('LCP', value) });
      }
    });
    observer.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    // PerformanceObserver not supported for this entry type
  }
}

function observeCLS() {
  try {
    let clsValue = 0;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // Only count layout shifts without recent user input
        if (!(entry as PerformanceEntry & { hadRecentInput: boolean }).hadRecentInput) {
          clsValue += (entry as PerformanceEntry & { value: number }).value;
        }
      }
    });
    observer.observe({ type: 'layout-shift', buffered: true });

    // Report CLS when the page is hidden (user navigates away or switches tabs)
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.visibilityState === 'hidden') {
          reportMetric({ name: 'CLS', value: clsValue, rating: rateMetric('CLS', clsValue) });
        }
      },
      { once: true },
    );
  } catch {
    // PerformanceObserver not supported for this entry type
  }
}

function observeFID() {
  try {
    const observer = new PerformanceObserver((list) => {
      const firstEntry = list.getEntries()[0];
      if (firstEntry) {
        const value = (firstEntry as PerformanceEventTiming).processingStart - firstEntry.startTime;
        reportMetric({ name: 'FID', value, rating: rateMetric('FID', value) });
      }
    });
    observer.observe({ type: 'first-input', buffered: true });
  } catch {
    // PerformanceObserver not supported for this entry type
  }
}

/**
 * Initialize Core Web Vitals monitoring.
 * Observes LCP, CLS, and FID using PerformanceObserver and reports via logger.
 */
export function initWebVitals() {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
    return;
  }

  observeLCP();
  observeCLS();
  observeFID();

  logger.info('Web Vitals monitoring initialized', CONTEXT);
}
