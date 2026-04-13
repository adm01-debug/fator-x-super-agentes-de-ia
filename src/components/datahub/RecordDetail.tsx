import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { XCircle, GitBranch, Link2, Lock, Building2, Pencil } from "lucide-react";
import { formatDate } from "@/config/datahub-columns";
import { ENTITY_MAPPINGS } from "@/config/datahub-entities";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import {
  FieldValue, NON_EDITABLE, GenericSecondaryCard, CrossDbResults, GroupMembers,
  SECONDARY_RENDERERS, SECONDARY_LABELS,
} from "./RecordSubComponents";

interface RecordDetailProps {
  record: Record<string, unknown>;
  enrichedData: { enriched: Record<string, unknown[]>; cross_db: Record<string, unknown[]> } | null;
  entityId: string;
  onClose: () => void;
  onRecordUpdate?: (updatedRecord: Record<string, unknown>) => void;
}

export function RecordDetail({ record, enrichedData, entityId, onClose, onRecordUpdate }: RecordDetailProps) {
  const mapping = ENTITY_MAPPINGS[entityId];
  const displayCol = mapping?.primary.display_column ?? 'id';
  const sensitiveFields = new Set(mapping?.sensitive_fields ?? []);
  const [currentRecord, setCurrentRecord] = useState(record);

  useEffect(() => { setCurrentRecord(record); }, [record]);

  const skipKeys = new Set(['id', 'created_at', 'updated_at', 'is_customer', 'is_supplier', 'is_carrier', 'search_vector']);
  const primaryFields = Object.entries(currentRecord).filter(([k]) => !skipKeys.has(k));

  const handleFieldSave = async (field: string, newValue: string) => {
    const { data: result, error } = await supabase.functions.invoke('datahub-query', {
      body: { action: 'update_field', entity: entityId, record_id: currentRecord.id, field, value: newValue },
    });
    if (error) throw new Error(error.message);
    if (result?.error) throw new Error(result.error);
    if (result?.record) {
      setCurrentRecord(result.record);
      onRecordUpdate?.(result.record);
    }
  };

  const isEditable = (key: string) => !NON_EDITABLE.has(key) && !sensitiveFields.has(key);

  const hasEnriched = enrichedData?.enriched && Object.keys(enrichedData.enriched).length > 0;
  const hasCrossDb = enrichedData?.cross_db && Object.entries(enrichedData.cross_db).some(([, rows]) => Array.isArray(rows) && rows.length > 0);
  const hasGroup = !!(record.grupo_economico_id) && !!mapping?.group_by;

  const enrichedEntries = hasEnriched ? Object.entries(enrichedData!.enriched) : [];
  const tabCount = (hasEnriched ? 1 : 0) + (hasCrossDb ? 1 : 0) + (hasGroup ? 1 : 0);

  return (
    <div className="space-y-4 border-t border-border pt-4 animate-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          📋 {String(currentRecord[displayCol] || 'Registro')}
          {currentRecord.id ? <span className="text-[11px] font-mono text-muted-foreground">#{String(currentRecord.id).slice(0, 8)}</span> : null}
        </h4>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[11px] gap-1 text-primary border-primary/30"><Pencil className="h-3 w-3" /> Clique para editar</Badge>
          <Button size="sm" variant="ghost" onClick={onClose}><XCircle className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="rounded-lg bg-secondary/20 border border-border/20 p-3">
        <h5 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Dados Primários</h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          {primaryFields.map(([key, val]) => (
            <FieldValue key={key} label={key} value={val} sensitive={sensitiveFields.has(key)}
              editable={isEditable(key)} onSave={(newValue) => handleFieldSave(key, newValue)} />
          ))}
        </div>
        {currentRecord.created_at ? (
          <p className="text-[11px] text-muted-foreground mt-2 border-t border-border/10 pt-1">
            Criado: {formatDate(String(currentRecord.created_at))} · Atualizado: {formatDate(String(currentRecord.updated_at))}
          </p>
        ) : null}
      </div>

      {sensitiveFields.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-[11px] text-destructive">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          <span>Campos protegidos pela LGPD estão redactados: <strong>{Array.from(sensitiveFields).join(', ')}</strong></span>
        </div>
      )}

      {tabCount > 0 && (
        <Tabs defaultValue="enriched" className="space-y-3">
          <TabsList className="bg-secondary/50">
            {hasEnriched && <TabsTrigger value="enriched" className="gap-1.5 text-xs"><GitBranch className="h-3 w-3" /> Enriquecidos<Badge variant="secondary" className="text-[10px] h-4 ml-1">{enrichedEntries.length}</Badge></TabsTrigger>}
            {hasCrossDb && <TabsTrigger value="crossdb" className="gap-1.5 text-xs"><Link2 className="h-3 w-3" /> Cross-DB</TabsTrigger>}
            {hasGroup && <TabsTrigger value="group" className="gap-1.5 text-xs"><Building2 className="h-3 w-3" /> Grupo</TabsTrigger>}
          </TabsList>

          {hasEnriched && (
            <TabsContent value="enriched" className="space-y-3">
              {enrichedEntries.map(([table, rows]) => {
                const info = SECONDARY_LABELS[table];
                const renderer = SECONDARY_RENDERERS[table];
                return (
                  <div key={table} className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px]">
                      {info?.icon ?? <GitBranch className="h-3 w-3 text-muted-foreground" />}
                      <span className="font-semibold text-foreground">{info?.label ?? table}</span>
                      <Badge variant="secondary" className="text-[11px] h-4">{Array.isArray(rows) ? rows.length : 0}</Badge>
                    </div>
                    {renderer ? renderer(rows as Record<string, unknown>[]) : <GenericSecondaryCard tableName={table} data={rows as Record<string, unknown>[]} />}
                  </div>
                );
              })}
            </TabsContent>
          )}
          {hasCrossDb && <TabsContent value="crossdb" className="space-y-2"><CrossDbResults data={enrichedData!.cross_db} /></TabsContent>}
          {hasGroup && <TabsContent value="group"><GroupMembers entityId={entityId} grupoId={String(record.grupo_economico_id)} excludeId={String(record.id)} /></TabsContent>}
        </Tabs>
      )}
    </div>
  );
}
