import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, Check, X as XIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCellValue } from "@/config/datahub-columns";
import type { ColumnDef } from "@/config/datahub-columns";

const NON_EDITABLE = new Set(['id', 'created_at', 'updated_at', 'search_vector', 'is_customer', 'is_supplier', 'is_carrier']);

interface InlineEditCellProps {
  row: Record<string, unknown>;
  col: ColumnDef;
  entityId: string;
  onUpdate: (rowId: string, updatedRow: Record<string, unknown>) => void;
}

export function InlineEditCell({ row, col, entityId, onUpdate }: InlineEditCellProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const canEdit = !NON_EDITABLE.has(col.key) && col.format !== 'sensitive';
  const rawValue = row[col.key];

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSave = async () => {
    if (value === String(rawValue ?? '')) { setEditing(false); return; }
    setSaving(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('datahub-query', {
        body: { action: 'update_field', entity: entityId, record_id: row.id, field: col.key, value },
      });
      if (error) throw new Error(error.message);
      if (result?.error) throw new Error(result.error);
      if (result?.record) onUpdate(row.id, result.record);
      setEditing(false);
      toast.success(`"${col.label}" atualizado`);
    } catch (e: unknown) {
      toast.error(`Erro: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setValue(String(rawValue ?? ''));
    setEditing(false);
  };

  const isSensitive = col.format === 'sensitive' && (String(rawValue).includes('REDACTED') || String(rawValue) === '***');

  if (editing) {
    return (
      <div className="flex items-center gap-0.5">
        <Input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
          className="h-6 text-[11px] font-mono bg-secondary/50 border-primary/30 px-1.5 min-w-[80px]"
          disabled={saving}
        />
        {saving ? (
          <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
        ) : (
          <>
            <button onClick={handleSave} className="p-0.5 rounded hover:bg-primary/10 text-primary shrink-0"><Check className="h-3 w-3" /></button>
            <button onClick={handleCancel} className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground shrink-0"><XIcon className="h-3 w-3" /></button>
          </>
        )}
      </div>
    );
  }

  return (
    <span
      className={`font-mono text-[11px] truncate block max-w-[300px] ${
        isSensitive ? 'text-destructive/60' : 'text-foreground'
      } ${canEdit ? 'cursor-pointer hover:bg-primary/5 hover:text-primary rounded px-0.5 -mx-0.5 transition-colors' : ''}`}
      onDoubleClick={() => {
        if (!canEdit) return;
        setValue(String(rawValue ?? ''));
        setEditing(true);
      }}
      title={canEdit ? 'Duplo clique para editar' : undefined}
    >
      {formatCellValue(rawValue, col.format)}
    </span>
  );
}
