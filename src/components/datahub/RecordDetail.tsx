import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  XCircle, Phone, Mail, MapPin, User, GitBranch, Link2,
  ExternalLink, Lock, Building2, MessageCircle, Loader2,
} from "lucide-react";
import { formatCNPJ, formatPhone, formatDate } from "@/config/datahub-columns";
import { ENTITY_MAPPINGS } from "@/config/datahub-entities";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";

interface RecordDetailProps {
  record: Record<string, any>;
  enrichedData: { enriched: Record<string, any[]>; cross_db: Record<string, any[]> } | null;
  entityId: string;
  onClose: () => void;
}

/* ── Helpers ─────────────────────────────────────────── */

const SENSITIVE_MARKER = /^\*{3}$|REDACTED/;

function isSensitive(value: any): boolean {
  return typeof value === 'string' && SENSITIVE_MARKER.test(value);
}

function FieldValue({ label, value, sensitive }: { label: string; value: any; sensitive?: boolean }) {
  const isSens = sensitive || isSensitive(value);
  return (
    <div className="flex justify-between items-center py-1 border-b border-border/10 last:border-0">
      <span className="text-muted-foreground text-[11px] min-w-[120px]">{label}</span>
      {isSens ? (
        <span className="flex items-center gap-1 text-[11px] text-destructive/70">
          <Lock className="h-3 w-3" /> REDACTED (LGPD)
        </span>
      ) : (
        <span className="text-foreground text-[11px] font-mono text-right max-w-[250px] truncate">
          {value === null || value === undefined ? '—' : String(value)}
        </span>
      )}
    </div>
  );
}

/* ── Phone list ─────────────────────────────────────── */
function PhoneList({ phones }: { phones: any[] }) {
  if (!phones?.length) return <EmptySecondary label="Nenhum telefone" />;
  return (
    <div className="flex flex-wrap gap-2">
      {phones.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary/30 border border-border/20 text-[11px]">
          <Phone className="h-3 w-3 text-primary" />
          <span className="font-mono text-foreground">{formatPhone(p.phone)}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Email list ─────────────────────────────────────── */
function EmailList({ emails }: { emails: any[] }) {
  if (!emails?.length) return <EmptySecondary label="Nenhum email" />;
  return (
    <div className="flex flex-wrap gap-2">
      {emails.map((e, i) => (
        <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary/30 border border-border/20 text-[11px]">
          <Mail className="h-3 w-3 text-primary" />
          <span className="font-mono text-foreground">{e.email}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Address card ───────────────────────────────────── */
function AddressCard({ addresses }: { addresses: any[] }) {
  if (!addresses?.length) return <EmptySecondary label="Nenhum endereço" />;
  const addr = addresses[0];
  return (
    <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-secondary/30 border border-border/20 text-[11px]">
      <MapPin className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
      <div>
        <p className="text-foreground font-medium">
          {[addr.cidade, addr.estado].filter(Boolean).join(', ') || '—'}
        </p>
        {addr.cep && <p className="text-muted-foreground font-mono">CEP: {addr.cep}</p>}
      </div>
    </div>
  );
}

/* ── Vendor info card ───────────────────────────────── */
function VendorCard({ data }: { data: any[] }) {
  if (!data?.length) return null;
  const vendor = data[0];
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary/5 border border-primary/20 text-[11px]">
      <User className="h-3.5 w-3.5 text-primary shrink-0" />
      <div>
        <p className="text-foreground font-medium">{vendor.vendedor_nome || 'Sem vendedor'}</p>
        {vendor.vendedor_id && <p className="text-muted-foreground font-mono text-[10px]">ID: {vendor.vendedor_id}</p>}
      </div>
    </div>
  );
}

/* ── Supplier score card ────────────────────────────── */
function SupplierScoreCard({ data }: { data: any[] }) {
  if (!data?.length) return null;
  const s = data[0];
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-secondary/30 border border-border/20 text-[11px]">
      <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-foreground font-medium">Fornecedor</span>
          {s.homologado !== undefined && (
            <Badge variant={s.homologado ? 'default' : 'secondary'} className="text-[9px] h-4">
              {s.homologado ? '✅ Homologado' : 'Não homologado'}
            </Badge>
          )}
        </div>
        {s.score_geral !== undefined && (
          <p className="text-muted-foreground">Score: <span className="text-foreground font-mono">{s.score_geral}</span></p>
        )}
        {s.data_homologacao && (
          <p className="text-muted-foreground">Homologado em: {formatDate(s.data_homologacao)}</p>
        )}
      </div>
    </div>
  );
}

/* ── Messages timeline ──────────────────────────────── */
function MessagesTimeline({ messages }: { messages: any[] }) {
  if (!messages?.length) return <EmptySecondary label="Nenhuma mensagem" />;
  return (
    <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
      {messages.slice(0, 20).map((msg, i) => (
        <div key={i} className="flex gap-2 px-2.5 py-1.5 rounded-lg bg-secondary/20 border border-border/10 text-[10px]">
          <MessageCircle className="h-3 w-3 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-foreground truncate">{msg.body || '[sem conteúdo]'}</p>
            <p className="text-muted-foreground">{msg.type} · {formatDate(msg.timestamp)}</p>
          </div>
        </div>
      ))}
      {messages.length > 20 && (
        <p className="text-[10px] text-muted-foreground text-center">+{messages.length - 20} mensagens...</p>
      )}
    </div>
  );
}

/* ── Generic secondary data ─────────────────────────── */
function GenericSecondaryCard({ tableName, data }: { tableName: string; data: any[] }) {
  if (!data?.length) return null;
  return (
    <div className="rounded-lg bg-secondary/20 border border-border/20 p-3 text-[11px]">
      <p className="font-mono font-semibold text-foreground mb-1.5">{tableName} ({data.length})</p>
      <div className="space-y-1 max-h-[120px] overflow-y-auto">
        {data.map((row, i) => (
          <div key={i} className="flex flex-wrap gap-x-3 gap-y-0.5 py-1 border-b border-border/10 last:border-0">
            {Object.entries(row).map(([k, v]) => (
              <span key={k} className="text-[10px]">
                <span className="text-muted-foreground">{k}: </span>
                <span className="text-foreground font-mono">{v === null ? '—' : String(v)}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptySecondary({ label }: { label: string }) {
  return <p className="text-[10px] text-muted-foreground italic">{label}</p>;
}

/* ── Cross-DB results ───────────────────────────────── */
function CrossDbResults({ data }: { data: Record<string, any[]> }) {
  const entries = Object.entries(data).filter(([, rows]) => Array.isArray(rows) && rows.length > 0);
  if (!entries.length) return <p className="text-[10px] text-muted-foreground italic">Nenhum dado cross-database encontrado</p>;

  return (
    <div className="space-y-2">
      {entries.map(([key, rows]) => {
        const [conn, table] = key.split('.');
        return (
          <div key={key} className="rounded-lg bg-nexus-emerald/5 border border-nexus-emerald/20 p-3">
            <div className="flex items-center gap-2 mb-2">
              <ExternalLink className="h-3 w-3 text-nexus-emerald" />
              <span className="text-[11px] font-mono text-foreground">{conn}</span>
              <span className="text-[10px] text-muted-foreground">→</span>
              <span className="text-[11px] font-mono text-nexus-emerald">{table}</span>
              <Badge variant="outline" className="text-[9px] h-4 border-nexus-emerald/30 text-nexus-emerald">
                {rows.length} resultado{rows.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            <div className="space-y-1 max-h-[150px] overflow-y-auto">
              {rows.map((row, i) => (
                <div key={i} className="flex flex-wrap gap-x-3 gap-y-0.5 py-1 border-b border-nexus-emerald/10 last:border-0 text-[10px]">
                  {Object.entries(row).slice(0, 8).map(([k, v]) => (
                    <span key={k}>
                      <span className="text-muted-foreground">{k}: </span>
                      <span className="text-foreground font-mono">{v === null ? '—' : String(v).slice(0, 50)}</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Group members ──────────────────────────────────── */
function GroupMembers({ entityId, grupoId, excludeId }: { entityId: string; grupoId: string; excludeId: string }) {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!grupoId) { setLoading(false); return; }
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('datahub-query', {
          body: {
            action: 'query_entity',
            entity: entityId,
            filters: [{ column: 'grupo_economico_id', operator: 'eq', value: grupoId }],
            exclude_id: excludeId,
            page_size: 10,
          },
        });
        setMembers((data?.data ?? []).filter((r: any) => r.id !== excludeId));
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [entityId, grupoId, excludeId]);

  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (!members.length) return null;

  const mapping = ENTITY_MAPPINGS[entityId];
  const displayCol = mapping?.primary.display_column ?? 'id';

  return (
    <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Building2 className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-semibold text-foreground">Empresas do mesmo grupo ({members.length})</span>
      </div>
      <div className="space-y-1">
        {members.map((m, i) => (
          <div key={i} className="flex items-center justify-between py-1 text-[10px]">
            <span className="text-foreground">{m[displayCol] || m.id}</span>
            {m.cnpj && <span className="text-muted-foreground font-mono">{formatCNPJ(m.cnpj)}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── KNOWN SECONDARY TABLE RENDERERS ─────────────────── */
const SECONDARY_RENDERERS: Record<string, (data: any[]) => React.ReactNode> = {
  company_phones: (data) => <PhoneList phones={data} />,
  company_emails: (data) => <EmailList emails={data} />,
  company_addresses: (data) => <AddressCard addresses={data} />,
  customers: (data) => <VendorCard data={data} />,
  suppliers: (data) => <SupplierScoreCard data={data} />,
  messages: (data) => <MessagesTimeline messages={data} />,
};

const SECONDARY_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  company_phones: { label: 'Telefones', icon: <Phone className="h-3.5 w-3.5 text-primary" /> },
  company_emails: { label: 'Emails', icon: <Mail className="h-3.5 w-3.5 text-primary" /> },
  company_addresses: { label: 'Endereço', icon: <MapPin className="h-3.5 w-3.5 text-primary" /> },
  customers: { label: 'Vendedor', icon: <User className="h-3.5 w-3.5 text-primary" /> },
  suppliers: { label: 'Fornecedor', icon: <Building2 className="h-3.5 w-3.5 text-primary" /> },
  messages: { label: 'Mensagens', icon: <MessageCircle className="h-3.5 w-3.5 text-primary" /> },
  carriers: { label: 'Transportadora', icon: <Building2 className="h-3.5 w-3.5 text-primary" /> },
  departamentos: { label: 'Departamento', icon: <Building2 className="h-3.5 w-3.5 text-primary" /> },
  cargos: { label: 'Cargo', icon: <User className="h-3.5 w-3.5 text-primary" /> },
  contacts: { label: 'Contatos', icon: <User className="h-3.5 w-3.5 text-primary" /> },
  interactions: { label: 'Interações', icon: <MessageCircle className="h-3.5 w-3.5 text-primary" /> },
  product_variants: { label: 'Variantes', icon: <GitBranch className="h-3.5 w-3.5 text-primary" /> },
  product_images: { label: 'Imagens', icon: <ExternalLink className="h-3.5 w-3.5 text-primary" /> },
  controle_ponto: { label: 'Ponto', icon: <Building2 className="h-3.5 w-3.5 text-primary" /> },
};

/* ── Main Component ──────────────────────────────────── */
export function RecordDetail({ record, enrichedData, entityId, onClose }: RecordDetailProps) {
  const mapping = ENTITY_MAPPINGS[entityId];
  const displayCol = mapping?.primary.display_column ?? 'id';
  const sensitiveFields = new Set(mapping?.sensitive_fields ?? []);

  // Determine primary fields to show (skip internal/boring columns)
  const skipKeys = new Set(['id', 'created_at', 'updated_at', 'is_customer', 'is_supplier', 'is_carrier']);
  const primaryFields = Object.entries(record).filter(([k]) => !skipKeys.has(k));

  return (
    <div className="space-y-4 border-t border-border pt-4 animate-in slide-in-from-bottom-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          📋 {record[displayCol] || 'Registro'}
          {record.id && (
            <span className="text-[10px] font-mono text-muted-foreground">#{String(record.id).slice(0, 8)}</span>
          )}
        </h4>
        <Button size="sm" variant="ghost" onClick={onClose}>
          <XCircle className="h-4 w-4" />
        </Button>
      </div>

      {/* Primary fields */}
      <div className="rounded-lg bg-secondary/20 border border-border/20 p-3">
        <h5 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Dados Primários</h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          {primaryFields.map(([key, val]) => (
            <FieldValue key={key} label={key} value={val} sensitive={sensitiveFields.has(key)} />
          ))}
        </div>
        {record.created_at && (
          <p className="text-[9px] text-muted-foreground mt-2 border-t border-border/10 pt-1">
            Criado: {formatDate(record.created_at)} · Atualizado: {formatDate(record.updated_at)}
          </p>
        )}
      </div>

      {/* LGPD warning if sensitive fields present */}
      {sensitiveFields.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-[11px] text-destructive">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          <span>Campos protegidos pela LGPD estão redactados: <strong>{Array.from(sensitiveFields).join(', ')}</strong></span>
        </div>
      )}

      {/* Secondary data */}
      {enrichedData?.enriched && Object.keys(enrichedData.enriched).length > 0 && (
        <div className="space-y-3">
          <h5 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5 text-nexus-cyan" /> Dados Enriquecidos
          </h5>
          {Object.entries(enrichedData.enriched).map(([table, rows]) => {
            const info = SECONDARY_LABELS[table];
            const renderer = SECONDARY_RENDERERS[table];
            return (
              <div key={table} className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px]">
                  {info?.icon ?? <GitBranch className="h-3 w-3 text-muted-foreground" />}
                  <span className="font-semibold text-foreground">{info?.label ?? table}</span>
                  <Badge variant="secondary" className="text-[9px] h-4">{Array.isArray(rows) ? rows.length : 0}</Badge>
                </div>
                {renderer ? renderer(rows as any[]) : <GenericSecondaryCard tableName={table} data={rows as any[]} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Group members */}
      {record.grupo_economico_id && mapping?.group_by && (
        <GroupMembers entityId={entityId} grupoId={record.grupo_economico_id} excludeId={record.id} />
      )}

      {/* Cross-DB */}
      {enrichedData?.cross_db && Object.keys(enrichedData.cross_db).length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5 text-nexus-emerald" /> Dados Cross-Database
          </h5>
          <CrossDbResults data={enrichedData.cross_db} />
        </div>
      )}
    </div>
  );
}
