/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Phone,
  Mail,
  MapPin,
  User,
  Building2,
  MessageCircle,
  ExternalLink,
  Lock,
  GitBranch,
  Loader2,
  Pencil,
  Check,
  X as XIcon,
} from 'lucide-react';
import { formatCNPJ, formatPhone, formatDate } from '@/config/datahub-columns';
import { ENTITY_MAPPINGS } from '@/config/datahub-entities';
import { toast } from 'sonner';

const SENSITIVE_MARKER = /^\*{3}$|REDACTED/;

function isSensitive(value: unknown): boolean {
  return typeof value === 'string' && SENSITIVE_MARKER.test(value);
}

export function FieldValue({
  label,
  value,
  sensitive,
  editable,
  onSave,
}: {
  label: string;
  value: unknown;
  sensitive?: boolean;
  editable?: boolean;
  onSave?: (newValue: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value ?? ''));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSens = sensitive || isSensitive(value);

  const handleSave = async () => {
    if (editValue === String(value ?? '')) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave?.(editValue);
      setEditing(false);
      toast.success(`Campo "${label}" atualizado`);
    } catch (e: unknown) {
      toast.error(`Erro ao salvar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(String(value ?? ''));
    setEditing(false);
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') handleCancel();
  };
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <div className="flex justify-between items-center py-1 border-b border-border/10 last:border-0 group min-h-[28px]">
      <span className="text-muted-foreground text-[11px] min-w-[120px] shrink-0">{label}</span>
      {isSens ? (
        <span className="flex items-center gap-1 text-[11px] text-destructive/70">
          <Lock className="h-3 w-3" /> REDACTED (LGPD)
        </span>
      ) : editing ? (
        <div className="flex items-center gap-1 flex-1 justify-end">
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-6 text-[11px] font-mono bg-secondary/50 border-primary/30 max-w-[250px] px-1.5"
            disabled={saving}
          />
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
          ) : (
            <>
              <button
                onClick={handleSave}
                className="p-0.5 rounded hover:bg-primary/10 text-primary"
              >
                <Check className="h-3 w-3" />
              </button>
              <button
                onClick={handleCancel}
                className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground"
              >
                <XIcon className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1 max-w-[250px]">
          <span className="text-foreground text-[11px] font-mono text-right truncate flex-1">
            {value === null || value === undefined ? '—' : String(value)}
          </span>
          {editable && (
            <button
              onClick={() => {
                setEditValue(String(value ?? ''));
                setEditing(true);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function PhoneList({ phones }: { phones: Array<Record<string, unknown>> }) {
  if (!phones?.length) return <EmptySecondary label="Nenhum telefone" />;
  return (
    <div className="flex flex-wrap gap-2">
      {phones.map((p, i) => (
        <div
          key={i}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary/30 border border-border/20 text-[11px]"
        >
          <Phone className="h-3 w-3 text-primary" />
          <span className="font-mono text-foreground">{formatPhone(p.phone as string | null)}</span>
        </div>
      ))}
    </div>
  );
}

export function EmailList({ emails }: { emails: Array<Record<string, unknown>> }) {
  if (!emails?.length) return <EmptySecondary label="Nenhum email" />;
  return (
    <div className="flex flex-wrap gap-2">
      {emails.map((e, i) => (
        <div
          key={i}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary/30 border border-border/20 text-[11px]"
        >
          <Mail className="h-3 w-3 text-primary" />
          <span className="font-mono text-foreground">{String(e.email || '')}</span>
        </div>
      ))}
    </div>
  );
}

export function AddressCard({ addresses }: { addresses: Array<Record<string, unknown>> }) {
  if (!addresses?.length) return <EmptySecondary label="Nenhum endereço" />;
  const addr = addresses[0];
  return (
    <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-secondary/30 border border-border/20 text-[11px]">
      <MapPin className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
      <div>
        <p className="text-foreground font-medium">
          {[addr.cidade, addr.estado].filter(Boolean).map(String).join(', ') || '—'}
        </p>
        {addr.cep ? (
          <p className="text-muted-foreground font-mono">CEP: {String(addr.cep)}</p>
        ) : null}
      </div>
    </div>
  );
}

export function VendorCard({ data }: { data: Array<Record<string, unknown>> }) {
  if (!data?.length) return null;
  const vendor = data[0];
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary/5 border border-primary/20 text-[11px]">
      <User className="h-3.5 w-3.5 text-primary shrink-0" />
      <div>
        <p className="text-foreground font-medium">
          {String(vendor.vendedor_nome || 'Sem vendedor')}
        </p>
        {vendor.vendedor_id ? (
          <p className="text-muted-foreground font-mono text-[11px]">
            ID: {String(vendor.vendedor_id)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function SupplierScoreCard({ data }: { data: Array<Record<string, unknown>> }) {
  if (!data?.length) return null;
  const s = data[0];
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-secondary/30 border border-border/20 text-[11px]">
      <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-foreground font-medium">Fornecedor</span>
          {s.homologado !== undefined && (
            <Badge variant={s.homologado ? 'default' : 'secondary'} className="text-[11px] h-4">
              {s.homologado ? '✅ Homologado' : 'Não homologado'}
            </Badge>
          )}
        </div>
        {s.score_geral !== undefined && (
          <p className="text-muted-foreground">
            Score: <span className="text-foreground font-mono">{String(s.score_geral)}</span>
          </p>
        )}
        {s.data_homologacao ? (
          <p className="text-muted-foreground">
            Homologado em: {formatDate(s.data_homologacao as string)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function MessagesTimeline({ messages }: { messages: Array<Record<string, unknown>> }) {
  if (!messages?.length) return <EmptySecondary label="Nenhuma mensagem" />;
  return (
    <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
      {messages.slice(0, 20).map((msg, i) => (
        <div
          key={i}
          className="flex gap-2 px-2.5 py-1.5 rounded-lg bg-secondary/20 border border-border/10 text-[11px]"
        >
          <MessageCircle className="h-3 w-3 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-foreground truncate">{String(msg.body || '[sem conteúdo]')}</p>
            <p className="text-muted-foreground">
              {String(msg.type)} · {formatDate(msg.timestamp as string | null)}
            </p>
          </div>
        </div>
      ))}
      {messages.length > 20 && (
        <p className="text-[11px] text-muted-foreground text-center">
          +{messages.length - 20} mensagens...
        </p>
      )}
    </div>
  );
}

export function GenericSecondaryCard({
  tableName,
  data,
}: {
  tableName: string;
  data: Array<Record<string, unknown>>;
}) {
  if (!data?.length) return null;
  return (
    <div className="rounded-lg bg-secondary/20 border border-border/20 p-3 text-[11px]">
      <p className="font-mono font-semibold text-foreground mb-1.5">
        {tableName} ({data.length})
      </p>
      <div className="space-y-1 max-h-[120px] overflow-y-auto">
        {data.map((row, i) => (
          <div
            key={i}
            className="flex flex-wrap gap-x-3 gap-y-0.5 py-1 border-b border-border/10 last:border-0"
          >
            {Object.entries(row).map(([k, v]) => (
              <span key={k} className="text-[11px]">
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

export function CrossDbResults({ data }: { data: Record<string, unknown[]> }) {
  const entries = Object.entries(data).filter(([, rows]) => Array.isArray(rows) && rows.length > 0);
  if (!entries.length)
    return (
      <p className="text-[11px] text-muted-foreground italic">
        Nenhum dado cross-database encontrado
      </p>
    );
  return (
    <div className="space-y-2">
      {entries.map(([key, rows]) => {
        const [conn, table] = key.split('.');
        return (
          <div
            key={key}
            className="rounded-lg bg-nexus-emerald/5 border border-nexus-emerald/20 p-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <ExternalLink className="h-3 w-3 text-nexus-emerald" />
              <span className="text-[11px] font-mono text-foreground">{conn}</span>
              <span className="text-[11px] text-muted-foreground">→</span>
              <span className="text-[11px] font-mono text-nexus-emerald">{table}</span>
              <Badge
                variant="outline"
                className="text-[11px] h-4 border-nexus-emerald/30 text-nexus-emerald"
              >
                {rows.length} resultado{rows.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            <div className="space-y-1 max-h-[150px] overflow-y-auto">
              {(rows as Record<string, unknown>[]).map((row, i) => (
                <div
                  key={i}
                  className="flex flex-wrap gap-x-3 gap-y-0.5 py-1 border-b border-nexus-emerald/10 last:border-0 text-[11px]"
                >
                  {Object.entries(row)
                    .slice(0, 8)
                    .map(([k, v]) => (
                      <span key={k}>
                        <span className="text-muted-foreground">{k}: </span>
                        <span className="text-foreground font-mono">
                          {v === null ? '—' : String(v).slice(0, 50)}
                        </span>
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

export function EmptySecondary({ label }: { label: string }) {
  return <p className="text-[11px] text-muted-foreground italic">{label}</p>;
}

export function GroupMembers({
  entityId,
  grupoId,
  excludeId,
}: {
  entityId: string;
  grupoId: string;
  excludeId: string;
}) {
  const [members, setMembers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!grupoId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data } = await supabase.functions.invoke('datahub-query', {
          body: {
            action: 'query_entity',
            entity: entityId,
            filters: [{ column: 'grupo_economico_id', operator: 'eq', value: grupoId }],
            exclude_id: excludeId,
            page_size: 10,
          },
        });
        setMembers((data?.data ?? []).filter((r: Record<string, unknown>) => r.id !== excludeId));
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, [entityId, grupoId, excludeId]);

  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (!members.length) return null;

  const mapping = ENTITY_MAPPINGS[entityId as keyof typeof ENTITY_MAPPINGS];
  const displayCol = mapping?.primary.display_column ?? 'id';

  return (
    <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Building2 className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-semibold text-foreground">
          Empresas do mesmo grupo ({members.length})
        </span>
      </div>
      <div className="space-y-1">
        {members.map((m, i) => (
          <div key={i} className="flex items-center justify-between py-1 text-[11px]">
            <span className="text-foreground">{String((m[displayCol] as string) || m.id)}</span>
            {m.cnpj ? (
              <span className="text-muted-foreground font-mono">
                {formatCNPJ(m.cnpj as string)}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export const SECONDARY_RENDERERS: Record<
  string,
  (data: Array<Record<string, unknown>>) => React.ReactNode
> = {
  company_phones: (data) => <PhoneList phones={data} />,
  company_emails: (data) => <EmailList emails={data} />,
  company_addresses: (data) => <AddressCard addresses={data} />,
  customers: (data) => <VendorCard data={data} />,
  suppliers: (data) => <SupplierScoreCard data={data} />,
  messages: (data) => <MessagesTimeline messages={data} />,
};

export const SECONDARY_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  company_phones: { label: 'Telefones', icon: <Phone className="h-3.5 w-3.5 text-primary" /> },
  company_emails: { label: 'Emails', icon: <Mail className="h-3.5 w-3.5 text-primary" /> },
  company_addresses: { label: 'Endereço', icon: <MapPin className="h-3.5 w-3.5 text-primary" /> },
  customers: { label: 'Vendedor', icon: <User className="h-3.5 w-3.5 text-primary" /> },
  suppliers: { label: 'Fornecedor', icon: <Building2 className="h-3.5 w-3.5 text-primary" /> },
  messages: { label: 'Mensagens', icon: <MessageCircle className="h-3.5 w-3.5 text-primary" /> },
  carriers: { label: 'Transportadora', icon: <Building2 className="h-3.5 w-3.5 text-primary" /> },
  departamentos: {
    label: 'Departamento',
    icon: <Building2 className="h-3.5 w-3.5 text-primary" />,
  },
  cargos: { label: 'Cargo', icon: <User className="h-3.5 w-3.5 text-primary" /> },
  contacts: { label: 'Contatos', icon: <User className="h-3.5 w-3.5 text-primary" /> },
  interactions: {
    label: 'Interações',
    icon: <MessageCircle className="h-3.5 w-3.5 text-primary" />,
  },
  product_variants: {
    label: 'Variantes',
    icon: <GitBranch className="h-3.5 w-3.5 text-primary" />,
  },
  product_images: { label: 'Imagens', icon: <ExternalLink className="h-3.5 w-3.5 text-primary" /> },
  controle_ponto: { label: 'Ponto', icon: <Building2 className="h-3.5 w-3.5 text-primary" /> },
};
