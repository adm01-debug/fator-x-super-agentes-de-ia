/**
 * GenerativeUI — Renders dynamic UI components from agent responses.
 * Implements A2UI spec basics: agents can output structured UI instead of just text.
 *
 * Supported widgets: table, form, chart, card, progress, alert, code
 */
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface UIWidget {
  type: 'table' | 'form' | 'chart' | 'card' | 'progress' | 'alert' | 'code' | 'text' | 'list';
  title?: string;
  data: Record<string, unknown>;
}

export interface GenerativeUIProps {
  widgets: UIWidget[];
  onAction?: (action: string, data: Record<string, unknown>) => void;
}

function TableWidget({ widget }: { widget: UIWidget }) {
  const rows = (widget.data.rows || []) as Array<Record<string, string>>;
  const columns = (widget.data.columns || Object.keys(rows[0] || {})) as string[];
  return (
    <div className="bg-secondary/30 rounded-lg overflow-hidden border border-border/30">
      {widget.title && <div className="px-3 py-2 text-xs font-bold text-foreground border-b border-border/30">{widget.title}</div>}
      <table className="w-full text-xs">
        <thead><tr>{columns.map(c => <th key={c} className="px-3 py-2 text-left text-muted-foreground border-b border-border/30">{c}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => (
          <tr key={i} className="border-b border-border/20 hover:bg-secondary/50">
            {columns.map(c => <td key={c} className="px-3 py-2 text-foreground">{row[c]}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function CardWidget({ widget }: { widget: UIWidget }) {
  const { title: cardTitle, description, metrics, actions } = widget.data as {
    title?: string; description?: string; metrics?: Array<{ label: string; value: string; color?: string }>;
    actions?: Array<{ label: string; action: string }>;
  };
  return (
    <div className="nexus-card space-y-3">
      {(cardTitle || widget.title) && <h4 className="text-sm font-bold text-foreground">{cardTitle || widget.title}</h4>}
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {metrics && (
        <div className="grid grid-cols-3 gap-2">
          {metrics.map((m, i) => (
            <div key={i} className="bg-secondary/30 rounded p-2 text-center border border-border/20">
              <div className="text-lg font-bold text-primary">{m.value}</div>
              <div className="text-[10px] text-muted-foreground">{m.label}</div>
            </div>
          ))}
        </div>
      )}
      {actions && (
        <div className="flex gap-2">{actions.map((a, i) => (
          <Button key={i} size="sm" variant="outline" className="text-xs">{a.label}</Button>
        ))}</div>
      )}
    </div>
  );
}

function ProgressWidget({ widget }: { widget: UIWidget }) {
  const { steps, current } = widget.data as { steps: string[]; current: number };
  return (
    <div className="nexus-card space-y-2">
      {widget.title && <h4 className="text-sm font-bold text-foreground">{widget.title}</h4>}
      {steps.map((step, i) => (
        <div key={i} className={`flex items-center gap-2 text-xs ${i < current ? 'text-nexus-emerald' : i === current ? 'text-primary' : 'text-muted-foreground/50'}`}>
          <span>{i < current ? '✅' : i === current ? '⏳' : '○'}</span>
          <span>{step}</span>
        </div>
      ))}
    </div>
  );
}

function AlertWidget({ widget }: { widget: UIWidget }) {
  const { severity, message } = widget.data as { severity: 'info' | 'warning' | 'error' | 'success'; message: string };
  const colorMap = {
    info: 'bg-primary/10 border-primary/30 text-primary',
    warning: 'bg-nexus-amber/10 border-nexus-amber/30 text-nexus-amber',
    error: 'bg-destructive/10 border-destructive/30 text-destructive',
    success: 'bg-nexus-emerald/10 border-nexus-emerald/30 text-nexus-emerald',
  };
  return (
    <div className={`rounded-lg p-3 text-xs border ${colorMap[severity]}`}>
      <Badge variant="outline" className="mb-1">{severity}</Badge>
      <p className="text-foreground">{message}</p>
    </div>
  );
}

function CodeWidget({ widget }: { widget: UIWidget }) {
  const { language, code } = widget.data as { language?: string; code: string };
  return (
    <div className="bg-secondary/30 rounded-lg overflow-hidden border border-border/30">
      {(widget.title || language) && <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-b border-border/30">{widget.title || language}</div>}
      <pre className="p-3 text-xs text-foreground overflow-x-auto font-mono"><code>{code}</code></pre>
    </div>
  );
}

export function GenerativeUI({ widgets, onAction: _onAction }: GenerativeUIProps) {
  return (
    <div className="space-y-3">
      {widgets.map((w, i) => {
        switch (w.type) {
          case 'table': return <TableWidget key={i} widget={w} />;
          case 'card': return <CardWidget key={i} widget={w} />;
          case 'progress': return <ProgressWidget key={i} widget={w} />;
          case 'alert': return <AlertWidget key={i} widget={w} />;
          case 'code': return <CodeWidget key={i} widget={w} />;
          case 'text': return <p key={i} className="text-sm text-foreground">{String(w.data.content)}</p>;
          default: return <div key={i} className="text-xs text-muted-foreground">[Widget: {w.type}]</div>;
        }
      })}
    </div>
  );
}
