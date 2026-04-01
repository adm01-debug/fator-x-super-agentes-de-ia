import { useMemo } from 'react';

interface Props {
  textA: string;
  textB: string;
  labelA: string;
  labelB: string;
}

function diffLines(a: string, b: string): { linesA: { text: string; type: 'same' | 'removed' }[]; linesB: { text: string; type: 'same' | 'added' }[] } {
  const aLines = a.split('\n');
  const bLines = b.split('\n');

  // Simple LCS-based diff
  const m = aLines.length;
  const n = bLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = aLines[i - 1] === bLines[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const linesA: { text: string; type: 'same' | 'removed' }[] = [];
  const linesB: { text: string; type: 'same' | 'added' }[] = [];

  let i = m, j = n;
  const opsA: typeof linesA = [];
  const opsB: typeof linesB = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aLines[i - 1] === bLines[j - 1]) {
      opsA.unshift({ text: aLines[i - 1], type: 'same' });
      opsB.unshift({ text: bLines[j - 1], type: 'same' });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      opsA.unshift({ text: '', type: 'same' }); // spacer
      opsB.unshift({ text: bLines[j - 1], type: 'added' });
      j--;
    } else {
      opsA.unshift({ text: aLines[i - 1], type: 'removed' });
      opsB.unshift({ text: '', type: 'same' }); // spacer
      i--;
    }
  }

  return { linesA: opsA, linesB: opsB };
}

export function PromptDiff({ textA, textB, labelA, labelB }: Props) {
  const { linesA, linesB } = useMemo(() => diffLines(textA, textB), [textA, textB]);

  const renderLine = (line: { text: string; type: string }, idx: number) => {
    const isRemoved = line.type === 'removed';
    const isAdded = line.type === 'added';
    const isEmpty = line.text === '' && line.type === 'same';

    return (
      <div
        key={idx}
        className={`px-3 py-0.5 text-xs font-mono whitespace-pre-wrap min-h-[20px] border-l-2 ${
          isRemoved
            ? 'bg-destructive/10 border-l-destructive text-destructive'
            : isAdded
            ? 'bg-emerald-500/10 border-l-emerald-500 text-emerald-400'
            : isEmpty
            ? 'border-l-transparent opacity-30'
            : 'border-l-transparent text-foreground/80'
        }`}
      >
        {isRemoved && <span className="mr-2 text-destructive/60">−</span>}
        {isAdded && <span className="mr-2 text-emerald-400/60">+</span>}
        {line.text || '\u00A0'}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-lg border border-border overflow-hidden bg-muted/10">
        <div className="px-3 py-2 border-b border-border bg-destructive/5">
          <p className="text-xs font-semibold text-muted-foreground">{labelA}</p>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {linesA.map((line, idx) => renderLine(line, idx))}
        </div>
      </div>
      <div className="rounded-lg border border-border overflow-hidden bg-muted/10">
        <div className="px-3 py-2 border-b border-border bg-emerald-500/5">
          <p className="text-xs font-semibold text-muted-foreground">{labelB}</p>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {linesB.map((line, idx) => renderLine(line, idx, 'b'))}
        </div>
      </div>
    </div>
  );
}
