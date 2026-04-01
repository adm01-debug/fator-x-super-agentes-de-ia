import { useState, useCallback } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { InfoHint } from "@/components/shared/InfoHint";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Brain, Clock, Globe, User, Users, Database, Trash2, Eye, Settings, Search } from "lucide-react";
import { toast } from "sonner";

interface MemoryLayer {
  id: string; name: string; icon: string; description: string; enabled: boolean;
  retention: string; strategy: string; entries: number; sizeKb: number;
  examples: string[];
}

const SEED_LAYERS: MemoryLayer[] = [
  { id: 'short', name: 'Short-term (Buffer)', icon: '⚡', description: 'Contexto da conversa atual. Descartado ao final da sessão.', enabled: true, retention: 'Sessão', strategy: 'FIFO', entries: 24, sizeKb: 12, examples: ['Última mensagem do usuário', 'Contexto de 5 turnos', 'Variáveis temporárias'] },
  { id: 'episodic', name: 'Episódica (Experiências)', icon: '📔', description: 'Registra interações passadas significativas para aprendizado.', enabled: true, retention: '90 dias', strategy: 'Relevance-decay', entries: 1240, sizeKb: 560, examples: ['Cliente X reclamou do prazo', 'Fornecedor Y atrasou 3 vezes', 'Pedido #123 teve problema'] },
  { id: 'semantic', name: 'Semântica (Fatos)', icon: '🧠', description: 'Fatos permanentes sobre o negócio e domínio.', enabled: true, retention: 'Permanente', strategy: 'Vector + decay', entries: 502, sizeKb: 890, examples: ['Prazo de entrega padrão é 21 dias', 'Margem mínima é 35%', 'Score de fornecedor: Q30% P25% E25% D20%'] },
  { id: 'procedural', name: 'Procedimental (Skills)', icon: '⚙️', description: 'Como executar tarefas (workflows aprendidos).', enabled: true, retention: 'Permanente', strategy: 'Versioned', entries: 18, sizeKb: 45, examples: ['Como criar cotação', 'Como escalar para humano', 'Como consultar estoque'] },
  { id: 'profile', name: 'Perfil (Identidade)', icon: '🪪', description: 'Quem o agente é: persona, tom, restrições.', enabled: true, retention: 'Permanente', strategy: 'Snapshot', entries: 1, sizeKb: 8, examples: ['Persona: Consultor comercial experiente', 'Tom: Profissional e empático', 'Restrições: Não revelar dados sensíveis'] },
  { id: 'shared', name: 'Compartilhada (Org)', icon: '🏢', description: 'Conhecimento compartilhado entre todos os agentes da org.', enabled: false, retention: '365 dias', strategy: 'Consensus', entries: 0, sizeKb: 0, examples: ['Regras comerciais globais', 'Políticas de compliance', 'Dados da empresa'] },
];

const RETENTION_OPTIONS = ['Sessão', '7 dias', '30 dias', '90 dias', '180 dias', '365 dias', 'Permanente'];
const STRATEGY_OPTIONS = ['FIFO', 'Relevance-decay', 'Vector + decay', 'Versioned', 'Snapshot', 'Consensus', 'LRU'];

export default function MemoryPage() {
  const [layers, setLayers] = useState<MemoryLayer[]>(SEED_LAYERS);
  const [expandedLayer, setExpandedLayer] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleLayer = useCallback((id: string) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, enabled: !l.enabled } : l));
  }, []);

  const updateRetention = useCallback((id: string, retention: string) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, retention } : l));
    toast.success('Retenção atualizada');
  }, []);

  const updateStrategy = useCallback((id: string, strategy: string) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, strategy } : l));
    toast.success('Estratégia atualizada');
  }, []);

  const clearLayer = useCallback((id: string) => {
    const layer = layers.find(l => l.id === id);
    if (!confirm(`Limpar todos os ${layer?.entries ?? 0} registros da memória "${layer?.name}"?\n\nEssa ação NÃO pode ser desfeita.`)) return;
    setLayers(prev => prev.map(l => l.id === id ? { ...l, entries: 0, sizeKb: 0 } : l));
    toast.success(`Memória "${layer?.name}" limpa`);
  }, [layers]);

  const totalEntries = layers.filter(l => l.enabled).reduce((s, l) => s + l.entries, 0);
  const totalSize = layers.filter(l => l.enabled).reduce((s, l) => s + l.sizeKb, 0);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="Memory" description="Configure as 6 camadas de memória dos agentes — retenção, estratégia e inspeção" />

      <InfoHint title="Memória multi-camada">
        Cada agente possui 6 camadas de memória independentes: short-term (buffer), episódica (experiências), semântica (fatos), procedimental (skills), perfil (identidade) e compartilhada (org). Configure retenção e estratégia por camada.
      </InfoHint>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Camadas ativas', value: layers.filter(l => l.enabled).length, color: 'text-emerald-400' },
          { label: 'Total de registros', value: totalEntries.toLocaleString(), color: 'text-foreground' },
          { label: 'Tamanho total', value: totalSize > 1024 ? `${(totalSize / 1024).toFixed(1)} MB` : `${totalSize} KB`, color: 'text-primary' },
          { label: 'Estratégias', value: new Set(layers.filter(l => l.enabled).map(l => l.strategy)).size, color: 'text-amber-400' },
        ].map(k => (
          <div key={k.label} className="nexus-card text-center py-3">
            <p className={`text-2xl font-heading font-bold ${k.color}`}>{k.value}</p>
            <p className="text-[10px] text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {layers.map(layer => {
          const isExpanded = expandedLayer === layer.id;
          return (
            <div key={layer.id} className={`nexus-card ${!layer.enabled ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpandedLayer(isExpanded ? null : layer.id)}>
                  <span className="text-2xl">{layer.icon}</span>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{layer.name}</h3>
                    <p className="text-[11px] text-muted-foreground">{layer.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{layer.entries.toLocaleString()} registros</p>
                    <p>{layer.sizeKb > 1024 ? `${(layer.sizeKb / 1024).toFixed(1)} MB` : `${layer.sizeKb} KB`}</p>
                  </div>
                  <Switch checked={layer.enabled} onCheckedChange={() => toggleLayer(layer.id)} />
                </div>
              </div>

              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-border space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div><label className="text-[10px] text-muted-foreground">Retenção</label>
                      <select value={layer.retention} onChange={e => updateRetention(layer.id, e.target.value)} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground mt-1">
                        {RETENTION_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div><label className="text-[10px] text-muted-foreground">Estratégia de consolidação</label>
                      <select value={layer.strategy} onChange={e => updateStrategy(layer.id, e.target.value)} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground mt-1">
                        {STRATEGY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2 flex gap-2 items-end">
                      <Button variant="outline" size="sm" className="text-[10px] h-7 gap-1" onClick={() => toast.info(`${layer.entries} registros na camada "${layer.name}"`)}>
                        <Eye className="h-3 w-3" /> Inspecionar
                      </Button>
                      <Button variant="outline" size="sm" className="text-[10px] h-7 gap-1 text-destructive border-destructive/30" disabled={layer.entries === 0} onClick={() => clearLayer(layer.id)}>
                        <Trash2 className="h-3 w-3" /> Limpar
                      </Button>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Exemplos de registros:</p>
                    <div className="flex flex-wrap gap-1">
                      {layer.examples.map(ex => (
                        <span key={ex} className="text-[10px] px-2 py-0.5 rounded bg-muted/20 text-muted-foreground">{ex}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
