/**
 * FilteredEmptyState — empty state contextual para a timeline filtrada.
 *
 * Aparece quando `filteredVersions.length === 0` mas `versions.length > 0`,
 * ou seja: existem versões, mas nenhum dos filtros ativos casou. O usuário
 * normalmente fica confuso ("sumiu tudo?") — então aqui:
 *
 *   1. Confirmamos que existem versões (ex: "0 de 12 versões").
 *   2. Listamos cada filtro ativo como um chip com botão "X" — clicar limpa
 *      apenas aquele filtro, sem precisar caçar o controle no resto da UI.
 *   3. Oferecemos "Limpar tudo" como atalho.
 *
 * Visual segue o sistema (border, semantic tokens, sem cores hardcoded).
 */
import { Filter, Clock, Tag, Activity, X, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  totalVersions: number;
  activePresetLabel: string | null;
  rangeActive: boolean;
  runId: string | null;
  activeTypes: string[];
  onClearPreset: () => void;
  onClearRange: () => void;
  onClearTypes: () => void;
  onClearAll: () => void;
}

interface ChipProps {
  icon: typeof Filter;
  label: string;
  onClear: () => void;
  /** Cor semântica do chip — combina com a cor do filtro original. */
  tone: 'preset' | 'range' | 'run' | 'types';
}

const TONE_CLASSES: Record<ChipProps['tone'], string> = {
  preset: 'border-primary/40 bg-primary/10 text-primary',
  range: 'border-border/60 bg-secondary/60 text-foreground',
  run: 'border-nexus-cyan/40 bg-nexus-cyan/10 text-nexus-cyan',
  types: 'border-nexus-violet/40 bg-nexus-violet/10 text-nexus-violet',
};

function FilterChip({ icon: Icon, label, onClear, tone }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium border ${TONE_CLASSES[tone]}`}
    >
      <Icon className="h-2.5 w-2.5" aria-hidden />
      {label}
      <button
        type="button"
        onClick={onClear}
        className="ml-0.5 rounded-full hover:bg-current/20 p-0.5 transition-colors"
        aria-label={`Limpar filtro: ${label}`}
        title={`Limpar filtro: ${label}`}
      >
        <X className="h-2 w-2" aria-hidden />
      </button>
    </span>
  );
}

export function FilteredEmptyState({
  totalVersions,
  activePresetLabel,
  rangeActive,
  runId,
  activeTypes,
  onClearPreset,
  onClearRange,
  onClearTypes,
  onClearAll,
}: Props) {
  // Conta filtros ativos para decidir se vale mostrar "limpar tudo".
  const activeCount =
    (activePresetLabel ? 1 : 0) +
    (rangeActive ? 1 : 0) +
    (runId ? 1 : 0) +
    (activeTypes.length > 0 ? 1 : 0);

  return (
    <div className="rounded-lg border border-dashed border-border/60 bg-card/30 p-5 flex flex-col items-center text-center gap-3">
      <div className="h-12 w-12 rounded-full bg-secondary/60 flex items-center justify-center">
        <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden />
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-foreground">
          Nenhuma versão para os filtros atuais
        </h4>
        <p className="text-[11px] text-muted-foreground max-w-[280px]">
          Existem <span className="font-mono font-semibold text-foreground">{totalVersions}</span>{' '}
          {totalVersions === 1 ? 'versão' : 'versões'} no agente, mas nenhuma corresponde
          {activeCount === 1 ? ' ao filtro ativo' : ' à combinação de filtros ativos'}.
          Remova um filtro abaixo para voltar a ver versões.
        </p>
      </div>

      {activeCount > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-full">
          {activePresetLabel && (
            <FilterChip
              icon={Filter}
              label={`Preset: ${activePresetLabel}`}
              onClear={onClearPreset}
              tone="preset"
            />
          )}
          {/* Range e Run compartilham o mesmo controle de URL (range absoluto
              é derivado do session_id), então limpamos ambos juntos. */}
          {rangeActive && (
            <FilterChip
              icon={runId ? Activity : Clock}
              label={runId ? `Execução …${runId.slice(-6)}` : 'Intervalo temporal'}
              onClear={onClearRange}
              tone={runId ? 'run' : 'range'}
            />
          )}
          {activeTypes.length > 0 && (
            <FilterChip
              icon={Tag}
              label={`Tipos: ${activeTypes.join(', ')}`}
              onClear={onClearTypes}
              tone="types"
            />
          )}
        </div>
      )}

      {activeCount > 1 && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onClearAll}
          className="h-7 text-[11px] gap-1.5"
        >
          <X className="h-3 w-3" /> Limpar todos os filtros
        </Button>
      )}
    </div>
  );
}
