import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Plus, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ── Field definitions per entity for creation forms ── */

interface FormField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'boolean' | 'number';
  required?: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
  defaultValue?: string;
}

const ENTITY_CREATE_FIELDS: Record<string, FormField[]> = {
  cliente: [
    { key: 'razao_social', label: 'Razão Social', type: 'text', required: true, placeholder: 'Ex: Empresa ABC Ltda' },
    { key: 'nome_fantasia', label: 'Nome Fantasia', type: 'text', placeholder: 'Ex: ABC' },
    { key: 'cnpj', label: 'CNPJ', type: 'text', placeholder: '00.000.000/0000-00' },
    { key: 'inscricao_estadual', label: 'Inscrição Estadual', type: 'text', placeholder: 'IE' },
    { key: 'status', label: 'Status', type: 'select', options: [
      { label: 'Ativo', value: 'ativo' }, { label: 'Inativo', value: 'inativo' },
    ], defaultValue: 'ativo' },
  ],
  fornecedor: [
    { key: 'razao_social', label: 'Razão Social', type: 'text', required: true, placeholder: 'Ex: Fornecedor XYZ' },
    { key: 'nome_fantasia', label: 'Nome Fantasia', type: 'text', placeholder: 'Ex: XYZ' },
    { key: 'cnpj', label: 'CNPJ', type: 'text', placeholder: '00.000.000/0000-00' },
    { key: 'status', label: 'Status', type: 'select', options: [
      { label: 'Ativo', value: 'ativo' }, { label: 'Inativo', value: 'inativo' },
    ], defaultValue: 'ativo' },
  ],
  transportadora: [
    { key: 'razao_social', label: 'Razão Social', type: 'text', required: true, placeholder: 'Ex: Transportes Rápidos' },
    { key: 'nome_fantasia', label: 'Nome Fantasia', type: 'text', placeholder: 'Ex: TR' },
    { key: 'cnpj', label: 'CNPJ', type: 'text', placeholder: '00.000.000/0000-00' },
    { key: 'status', label: 'Status', type: 'select', options: [
      { label: 'Ativo', value: 'ativo' }, { label: 'Inativo', value: 'inativo' },
    ], defaultValue: 'ativo' },
  ],
  produto: [
    { key: 'name', label: 'Nome do Produto', type: 'text', required: true, placeholder: 'Ex: Caneta Personalizada' },
    { key: 'slug', label: 'Slug', type: 'text', placeholder: 'caneta-personalizada' },
    { key: 'description', label: 'Descrição', type: 'text', placeholder: 'Descrição do produto' },
    { key: 'is_active', label: 'Ativo', type: 'boolean', defaultValue: 'true' },
  ],
  colaborador: [
    { key: 'nome_completo', label: 'Nome Completo', type: 'text', required: true, placeholder: 'Ex: João da Silva' },
    { key: 'email', label: 'Email', type: 'text', required: true, placeholder: 'joao@empresa.com' },
    { key: 'status', label: 'Status', type: 'select', options: [
      { label: 'Ativo', value: 'ativo' }, { label: 'Inativo', value: 'inativo' },
    ], defaultValue: 'ativo' },
  ],
  conversa_whatsapp: [
    { key: 'name', label: 'Nome do Contato', type: 'text', required: true, placeholder: 'Ex: Maria' },
    { key: 'phone', label: 'Telefone', type: 'text', required: true, placeholder: '5511999999999' },
  ],
};

/* ── Extra flags to set based on entity type ── */
const ENTITY_EXTRA_FIELDS: Record<string, Record<string, any>> = {
  cliente: { is_customer: true },
  fornecedor: { is_supplier: true },
  transportadora: { is_carrier: true },
};

interface CreateRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  entityName: string;
  onSuccess: () => void;
}

export function CreateRecordDialog({ open, onOpenChange, entityId, entityName, onSuccess }: CreateRecordDialogProps) {
  const fields = ENTITY_CREATE_FIELDS[entityId] ?? [];
  const [values, setValues] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    for (const f of fields) {
      if (f.defaultValue) defaults[f.key] = f.defaultValue;
    }
    return defaults;
  });
  const [saving, setSaving] = useState(false);

  const updateField = (key: string, val: string) => {
    setValues(prev => ({ ...prev, [key]: val }));
  };

  const isValid = fields.filter(f => f.required).every(f => values[f.key]?.trim());

  const handleCreate = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = { ...values };
      // Add extra flags (is_customer, is_supplier, etc.)
      const extra = ENTITY_EXTRA_FIELDS[entityId];
      if (extra) Object.assign(payload, extra);

      // Parse booleans and numbers
      for (const [k, v] of Object.entries(payload)) {
        if (v === 'true') payload[k] = true;
        else if (v === 'false') payload[k] = false;
        else if (v === '') payload[k] = null;
      }

      const { data: result, error } = await supabase.functions.invoke('datahub-query', {
        body: { action: 'create_record', entity: entityId, data: payload },
      });
      if (error) throw new Error(error.message);
      if (result?.error) throw new Error(result.error);

      toast.success(`${entityName} criado com sucesso!`);
      handleClose();
      onSuccess();
    } catch (e: unknown) {
      toast.error(`Erro ao criar: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    const defaults: Record<string, string> = {};
    for (const f of fields) {
      if (f.defaultValue) defaults[f.key] = f.defaultValue;
    }
    setValues(defaults);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            Novo {entityName}
          </DialogTitle>
          <DialogDescription>
            Preencha os campos para criar um novo registro no banco de dados externo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {fields.map(field => (
            <div key={field.key} className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>

              {field.type === 'select' ? (
                <Select value={values[field.key] ?? ''} onValueChange={v => updateField(field.key, v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : field.type === 'boolean' ? (
                <Select value={values[field.key] ?? 'true'} onValueChange={v => updateField(field.key, v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Sim</SelectItem>
                    <SelectItem value="false">Não</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder={field.placeholder}
                  value={values[field.key] ?? ''}
                  onChange={e => updateField(field.key, e.target.value)}
                  type={field.type === 'number' ? 'number' : 'text'}
                />
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={saving || !isValid} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Criar {entityName}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
