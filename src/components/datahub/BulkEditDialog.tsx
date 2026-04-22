import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabaseExternal } from '@/integrations/supabase/externalClient';
import { toast } from 'sonner';
import type { ColumnDef } from '@/config/datahub-columns';

interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  selectedRecords: Array<Record<string, unknown>>;
  columns: ColumnDef[];
  displayColumn: string;
  onSuccess: () => void;
}

const NON_EDITABLE = new Set([
  'id',
  'created_at',
  'updated_at',
  'search_vector',
  'is_customer',
  'is_supplier',
  'is_carrier',
]);

export function BulkEditDialog({
  open,
  onOpenChange,
  entityId,
  selectedRecords,
  columns,
  displayColumn,
  onSuccess,
}: BulkEditDialogProps) {
  const [field, setField] = useState('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'select' | 'preview'>('select');

  const editableColumns = columns.filter(
    (c) => !NON_EDITABLE.has(c.key) && c.format !== 'sensitive',
  );

  const selectedCol = editableColumns.find((c) => c.key === field);

  const handleNext = () => {
    if (!field) return;
    setStep('preview');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const recordIds = selectedRecords.map((r) => r.id);
      const { data: result, error } = await supabaseExternal.functions.invoke('datahub-query', {
        body: { action: 'batch_update', entity: entityId, record_ids: recordIds, field, value },
      });
      if (error) throw new Error(error.message);
      if (result?.error) throw new Error(result.error);
      toast.success(`${result?.updated_count ?? selectedRecords.length} registros atualizados`);
      handleClose();
      onSuccess();
    } catch (e: unknown) {
      toast.error(`Erro: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setField('');
    setValue('');
    setStep('select');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Edição em massa
            <Badge variant="secondary" className="text-xs">
              {selectedRecords.length} registros
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {step === 'select'
              ? 'Escolha o campo e o novo valor para aplicar a todos os registros selecionados.'
              : 'Revise as alterações antes de confirmar.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'select' ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <span className="text-sm font-medium text-foreground">Campo a alterar</span>
              <Select value={field} onValueChange={setField}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o campo..." />
                </SelectTrigger>
                <SelectContent>
                  {editableColumns.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {field && (
              <div className="space-y-2">
                <span className="text-sm font-medium text-foreground">Novo valor</span>
                {selectedCol?.format === 'boolean' ? (
                  <Select value={value} onValueChange={setValue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Sim (true)</SelectItem>
                      <SelectItem value="false">Não (false)</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder="Novo valor..."
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                  />
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-foreground">Confirme a alteração</p>
                <p className="text-muted-foreground mt-1">
                  O campo{' '}
                  <span className="font-mono font-semibold text-foreground">
                    {selectedCol?.label}
                  </span>{' '}
                  será alterado para{' '}
                  <span className="font-mono font-semibold text-primary">
                    {value === '' ? '(vazio)' : value}
                  </span>{' '}
                  em <span className="font-semibold text-foreground">{selectedRecords.length}</span>{' '}
                  registros.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border max-h-[200px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-secondary/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium text-muted-foreground">Registro</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Valor atual</th>
                    <th className="text-left p-2 font-medium text-primary">Novo valor</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRecords.map((r, i) => (
                    <tr key={String(r.id ?? i)} className="border-t border-border/30">
                      <td className="p-2 font-mono text-foreground truncate max-w-[180px]">
                        {String(r[displayColumn] ?? r.id ?? '')}
                      </td>
                      <td className="p-2 font-mono text-muted-foreground">
                        {r[field] === null || r[field] === undefined ? '—' : String(r[field])}
                      </td>
                      <td className="p-2 font-mono text-primary font-semibold">
                        {value === '' ? '(vazio)' : value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'select' ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handleNext} disabled={!field}>
                Próximo
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('select')}>
                Voltar
              </Button>
              <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Confirmar alteração
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
