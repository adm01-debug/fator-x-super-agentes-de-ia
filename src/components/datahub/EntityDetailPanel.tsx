import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Database, Table2, GitBranch, Link2, ExternalLink, ArrowRight, Eye } from 'lucide-react';
import type { EntityMapping, SecondaryMapping, CrossDbMapping } from '@/config/datahub-entities';
import { ENTITY_ICONS, getConnectionLabel } from './entityMeta';

export function EntityDetailPanel({
  entityId,
  mapping,
  onBrowse,
}: {
  entityId: string;
  mapping: EntityMapping;
  onBrowse: (entityId: string) => void;
}) {
  const Icon = ENTITY_ICONS[entityId] ?? Database;

  return (
    <div className="nexus-card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-heading font-bold text-foreground">{mapping.name}</h3>
            <p className="text-xs text-muted-foreground">
              Banco primário:{' '}
              <span className="font-mono text-foreground">
                {getConnectionLabel(mapping.primary.connection)}
              </span>
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={() => onBrowse(entityId)}
        >
          <Eye className="h-3.5 w-3.5" /> Explorar Dados
        </Button>
      </div>

      {mapping.note && (
        <div className="p-2.5 rounded-lg bg-nexus-amber/10 border border-nexus-amber/20 text-[11px] text-nexus-amber">
          ⚠️ {mapping.note}
        </div>
      )}
      {mapping.group_by && (
        <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-[11px] text-primary">
          🏢 Agrupável por: <span className="font-mono">{mapping.group_by}</span>
          {mapping.exclude_self && (
            <span className="text-muted-foreground ml-2">(exclui a própria empresa no grupo)</span>
          )}
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Table2 className="h-3.5 w-3.5 text-primary" /> Tabela Primária
        </h4>
        <div className="rounded-lg bg-secondary/30 border border-border/30 p-3 text-xs space-y-1.5 font-mono">
          <div className="flex justify-between">
            <span className="text-muted-foreground">tabela</span>
            <span className="text-foreground">{mapping.primary.table}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">id</span>
            <span className="text-foreground">{mapping.primary.id_column ?? 'id'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">display</span>
            <span className="text-foreground">{mapping.primary.display_column ?? '—'}</span>
          </div>
          {mapping.primary.filter && (
            <div className="pt-1.5 border-t border-border/30">
              <span className="text-muted-foreground">filtro: </span>
              <span className="text-nexus-cyan text-[11px] break-all">
                {mapping.primary.filter}
              </span>
            </div>
          )}
        </div>
      </div>

      {mapping.secondary && mapping.secondary.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5 text-nexus-cyan" /> Tabelas Secundárias (
            {mapping.secondary.length})
          </h4>
          <div className="space-y-1.5">
            {mapping.secondary.map((sec: SecondaryMapping, i: number) => (
              <div
                key={i}
                className="rounded-lg bg-secondary/20 border border-border/20 p-2.5 text-[11px] font-mono"
              >
                <div className="flex items-center justify-between">
                  <span className="text-foreground font-semibold">{sec.table}</span>
                  <div className="flex gap-1">
                    {sec.aggregate && (
                      <Badge variant="outline" className="text-[11px] h-4">
                        {sec.aggregate}
                      </Badge>
                    )}
                    {sec.limit && (
                      <Badge variant="outline" className="text-[11px] h-4">
                        limit {sec.limit}
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="text-muted-foreground text-[11px] mt-0.5">JOIN: {sec.join}</p>
                {sec.fields && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {sec.fields.map((f) => (
                      <span
                        key={f}
                        className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}
                {sec.note && <p className="text-[11px] text-nexus-amber mt-1">⚠️ {sec.note}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {mapping.cross_db && mapping.cross_db.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5 text-nexus-emerald" /> Cross-Database (
            {mapping.cross_db.length})
          </h4>
          {mapping.cross_db.map((cross: CrossDbMapping, i: number) => (
            <div
              key={i}
              className="rounded-lg bg-nexus-emerald/5 border border-nexus-emerald/20 p-3 text-[11px] space-y-1.5"
            >
              <div className="flex items-center gap-2">
                <ExternalLink className="h-3 w-3 text-nexus-emerald" />
                <span className="font-mono text-foreground">
                  {getConnectionLabel(cross.connection)}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono text-foreground">{cross.table}</span>
              </div>
              <p className="text-muted-foreground font-mono text-[11px]">
                match: {cross.match_with} → {cross.match_by}
              </p>
              {cross.fallback && (
                <p className="text-[11px] text-nexus-amber">fallback: {cross.fallback}</p>
              )}
              {cross.enrich && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {cross.enrich.map((f) => (
                    <span
                      key={f}
                      className="text-[11px] px-1.5 py-0.5 rounded bg-nexus-emerald/10 text-nexus-emerald"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {mapping.sensitive_fields && mapping.sensitive_fields.length > 0 && (
        <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-[11px]">
          <span className="text-destructive font-semibold">🔒 Campos sensíveis (LGPD): </span>
          <span className="text-muted-foreground font-mono">
            {mapping.sensitive_fields.join(', ')}
          </span>
        </div>
      )}
    </div>
  );
}
