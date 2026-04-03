import { useState } from 'react';

interface ComparisonToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  label?: string;
}

export function ComparisonToggle({ enabled, onToggle, label = 'Comparar período anterior' }: ComparisonToggleProps) {
  return (
    <button
      onClick={() => onToggle(!enabled)}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all border ${
        enabled
          ? 'bg-primary/10 border-primary/30 text-primary'
          : 'bg-secondary/50 border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
      }`}
      aria-pressed={enabled}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M1 8L4 4L7 6L11 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {enabled && (
          <path d="M1 10L4 7L7 8.5L11 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" strokeDasharray="2 2" />
        )}
      </svg>
      {label}
    </button>
  );
}

/** Generate comparison data by shifting data array back by `offset` positions */
export function generateComparisonData(
  data: Record<string, any>[],
  dataKeys: string[],
  offset?: number
): Record<string, any>[] {
  const shift = offset ?? Math.floor(data.length / 2);
  return data.map((d, i) => {
    const prev = data[i - shift];
    const entry = { ...d };
    for (const key of dataKeys) {
      entry[`prev_${key}`] = prev ? (Number(prev[key]) || 0) : null;
    }
    return entry;
  });
}
