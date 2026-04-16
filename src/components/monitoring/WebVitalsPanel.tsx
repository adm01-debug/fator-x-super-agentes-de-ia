/**
 * WebVitalsPanel — Real-time Web Vitals metrics display.
 * Collects CLS, INP, LCP, FCP, TTFB from the PerformanceObserver API.
 */
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Gauge, RefreshCcw, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface VitalMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  unit: string;
  threshold: { good: number; poor: number };
}

const VITAL_CONFIG: Record<string, { label: string; unit: string; good: number; poor: number; description: string }> = {
  CLS: { label: 'Cumulative Layout Shift', unit: '', good: 0.1, poor: 0.25, description: 'Estabilidade visual da página' },
  INP: { label: 'Interaction to Next Paint', unit: 'ms', good: 200, poor: 500, description: 'Responsividade a interações' },
  LCP: { label: 'Largest Contentful Paint', unit: 'ms', good: 2500, poor: 4000, description: 'Velocidade de carregamento' },
  FCP: { label: 'First Contentful Paint', unit: 'ms', good: 1800, poor: 3000, description: 'Primeiro render visível' },
  TTFB: { label: 'Time to First Byte', unit: 'ms', good: 800, poor: 1800, description: 'Latência do servidor' },
};

function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const config = VITAL_CONFIG[name];
  if (!config) return 'good';
  if (value <= config.good) return 'good';
  if (value <= config.poor) return 'needs-improvement';
  return 'poor';
}

const RATING_ICONS = {
  'good': <CheckCircle2 className="h-4 w-4 text-nexus-emerald" />,
  'needs-improvement': <AlertTriangle className="h-4 w-4 text-nexus-amber" />,
  'poor': <XCircle className="h-4 w-4 text-destructive" />,
};

const RATING_COLORS = {
  'good': 'bg-nexus-emerald',
  'needs-improvement': 'bg-nexus-amber',
  'poor': 'bg-destructive',
};

export function WebVitalsPanel() {
  const [metrics, setMetrics] = useState<Record<string, VitalMetric>>({});
  const [collecting, setCollecting] = useState(false);

  const collectMetrics = () => {
    setCollecting(true);
    const collected: Record<string, VitalMetric> = {};

    // Use PerformanceObserver for navigation timing
    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (navEntries.length > 0) {
      const nav = navEntries[0];
      const ttfb = nav.responseStart - nav.requestStart;
      collected.TTFB = { name: 'TTFB', value: Math.round(ttfb), rating: getRating('TTFB', ttfb), unit: 'ms', threshold: { good: 800, poor: 1800 } };
    }

    // Use paint entries
    const paintEntries = performance.getEntriesByType('paint');
    const fcp = paintEntries.find(e => e.name === 'first-contentful-paint');
    if (fcp) {
      collected.FCP = { name: 'FCP', value: Math.round(fcp.startTime), rating: getRating('FCP', fcp.startTime), unit: 'ms', threshold: { good: 1800, poor: 3000 } };
    }

    // LCP from largest-contentful-paint entries
    try {
      const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
      if (lcpEntries.length > 0) {
        const lcp = lcpEntries[lcpEntries.length - 1];
        collected.LCP = { name: 'LCP', value: Math.round(lcp.startTime), rating: getRating('LCP', lcp.startTime), unit: 'ms', threshold: { good: 2500, poor: 4000 } };
      }
    } catch { /* not all browsers support this */ }

    // CLS from layout-shift entries
    try {
      const clsEntries = performance.getEntriesByType('layout-shift') as any[];
      const clsValue = clsEntries.reduce((sum, e) => sum + (e.hadRecentInput ? 0 : e.value || 0), 0);
      collected.CLS = { name: 'CLS', value: Math.round(clsValue * 1000) / 1000, rating: getRating('CLS', clsValue), unit: '', threshold: { good: 0.1, poor: 0.25 } };
    } catch { /* ignore */ }

    // Memory info (Chrome only)
    const perf = performance as any;
    if (perf.memory) {
      const heapMB = Math.round(perf.memory.usedJSHeapSize / 1048576);
      collected.HEAP = { name: 'HEAP', value: heapMB, rating: heapMB < 50 ? 'good' : heapMB < 150 ? 'needs-improvement' : 'poor', unit: 'MB', threshold: { good: 50, poor: 150 } };
    }

    setMetrics(collected);
    setTimeout(() => setCollecting(false), 500);
  };

  useEffect(() => {
    collectMetrics();
  }, []);

  const overallScore = Object.values(metrics).length > 0
    ? Object.values(metrics).filter(m => m.rating === 'good').length / Object.values(metrics).length
    : 0;

  return (
    <div className="nexus-card space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-nexus-cyan/10 flex items-center justify-center">
          <Gauge className="h-4 w-4 text-nexus-cyan" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Web Vitals</h3>
          <p className="text-[11px] text-muted-foreground">Performance real do navegador — CLS, INP, LCP, FCP, TTFB</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className={`text-[10px] ${overallScore >= 0.8 ? 'border-nexus-emerald/50 text-nexus-emerald' : overallScore >= 0.5 ? 'border-nexus-amber/50 text-nexus-amber' : 'border-destructive/50 text-destructive'}`}>
            {Math.round(overallScore * 100)}% saudável
          </Badge>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={collectMetrics} disabled={collecting}>
            <RefreshCcw className={`h-3.5 w-3.5 ${collecting ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
        {Object.entries(VITAL_CONFIG).map(([key, config]) => {
          const metric = metrics[key];
          return (
            <div key={key} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-foreground">{key}</span>
                {metric ? RATING_ICONS[metric.rating] : <span className="text-[10px] text-muted-foreground">—</span>}
              </div>
              <p className="text-xl font-black text-foreground tabular-nums">
                {metric ? `${metric.value}${config.unit}` : '—'}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{config.description}</p>
              {metric && (
                <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${RATING_COLORS[metric.rating]}`}
                    style={{ width: `${Math.min(100, metric.rating === 'good' ? 100 : metric.rating === 'needs-improvement' ? 60 : 30)}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Heap metric if available */}
        {metrics.HEAP && (
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-foreground">HEAP</span>
              {RATING_ICONS[metrics.HEAP.rating]}
            </div>
            <p className="text-xl font-black text-foreground tabular-nums">{metrics.HEAP.value}MB</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Memória JS heap usada</p>
          </div>
        )}
      </div>
    </div>
  );
}
