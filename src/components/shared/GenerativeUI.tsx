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
    <div className="bg-[#0a0a1a] rounded-lg overflow-hidden">
      {widget.title && <div className="px-3 py-2 text-xs font-bold text-white border-b border-[#222244]">{widget.title}</div>}
      <table className="w-full text-xs">
        <thead><tr>{columns.map(c => <th key={c} className="px-3 py-2 text-left text-[#888888] border-b border-[#222244]">{c}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => (
          <tr key={i} className="border-b border-[#222244]/50 hover:bg-[#111122]">
            {columns.map(c => <td key={c} className="px-3 py-2 text-[#E0E0E0]">{row[c]}</td>)}
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
    <div className="bg-[#0a0a1a] rounded-lg p-4 space-y-3">
      {(cardTitle || widget.title) && <h4 className="text-sm font-bold text-white">{cardTitle || widget.title}</h4>}
      {description && <p className="text-xs text-[#888888]">{description}</p>}
      {metrics && (
        <div className="grid grid-cols-3 gap-2">
          {metrics.map((m, i) => (
            <div key={i} className="bg-[#111122] rounded p-2 text-center">
              <div className="text-lg font-bold" style={{ color: m.color || '#4D96FF' }}>{m.value}</div>
              <div className="text-[10px] text-[#888888]">{m.label}</div>
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
    <div className="bg-[#0a0a1a] rounded-lg p-4 space-y-2">
      {widget.title && <h4 className="text-sm font-bold text-white">{widget.title}</h4>}
      {steps.map((step, i) => (
        <div key={i} className={`flex items-center gap-2 text-xs ${i < current ? 'text-[#6BCB77]' : i === current ? 'text-[#4D96FF]' : 'text-[#555555]'}`}>
          <span>{i < current ? '✅' : i === current ? '⏳' : '○'}</span>
          <span>{step}</span>
        </div>
      ))}
    </div>
  );
}

function AlertWidget({ widget }: { widget: UIWidget }) {
  const { severity, message } = widget.data as { severity: 'info' | 'warning' | 'error' | 'success'; message: string };
  const colors = { info: '#4D96FF', warning: '#FFD93D', error: '#FF6B6B', success: '#6BCB77' };
  return (
    <div className="rounded-lg p-3 text-xs" style={{ background: `${colors[severity]}15`, border: `1px solid ${colors[severity]}40` }}>
      <Badge className="mb-1" style={{ background: `${colors[severity]}30`, color: colors[severity] }}>{severity}</Badge>
      <p className="text-[#E0E0E0]">{message}</p>
    </div>
  );
}

function CodeWidget({ widget }: { widget: UIWidget }) {
  const { language, code } = widget.data as { language?: string; code: string };
  return (
    <div className="bg-[#0a0a1a] rounded-lg overflow-hidden">
      {(widget.title || language) && <div className="px-3 py-1.5 text-[10px] text-[#888888] border-b border-[#222244]">{widget.title || language}</div>}
      <pre className="p-3 text-xs text-[#E0E0E0] overflow-x-auto font-mono"><code>{code}</code></pre>
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
          case 'text': return <p key={i} className="text-sm text-[#E0E0E0]">{String(w.data.content)}</p>;
          default: return <div key={i} className="text-xs text-[#888888]">[Widget: {w.type}]</div>;
        }
      })}
    </div>
  );
}
