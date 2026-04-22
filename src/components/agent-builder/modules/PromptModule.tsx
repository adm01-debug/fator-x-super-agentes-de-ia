import { useState } from 'react';
import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { SectionTitle, NexusBadge, InputField, TextAreaField } from '../ui';
import { CollapsibleCard } from '../ui/CollapsibleCard';
import { CodeBlock } from '../ui/CodeBlock';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Copy, GitBranch, Check, ArrowLeftRight } from 'lucide-react';
import { toast } from 'sonner';
import type { PromptTechnique, FewShotExample, OutputFormat } from '@/types/agentTypes';
import { PromptDiff } from '@/components/prompts/PromptDiff';

const PROMPT_TECHNIQUES: {
  id: string;
  name: string;
  impact: string;
  description: string;
  example: string;
}[] = [
  {
    id: 'role',
    name: 'Role Prompting',
    impact: 'Alto',
    description: 'Define quem o agente É',
    example: 'Você é um especialista em...',
  },
  {
    id: 'cot',
    name: 'Chain-of-Thought',
    impact: 'Alto',
    description: 'Raciocínio passo-a-passo',
    example: 'Pense passo a passo antes de responder...',
  },
  {
    id: 'few_shot',
    name: 'Few-Shot Examples',
    impact: 'Muito Alto',
    description: '2-5 exemplos concretos de entrada/saída',
    example: 'Exemplo 1: Input → Output...',
  },
  {
    id: 'constraints',
    name: 'Constraints',
    impact: 'Crítico',
    description: 'Limites do que pode/não pode fazer',
    example: 'NUNCA revele informações internas...',
  },
  {
    id: 'output_format',
    name: 'Output Format',
    impact: 'Alto',
    description: 'Formato exato de saída esperado',
    example: 'Responda sempre em JSON: { ... }',
  },
  {
    id: 'persona_guard',
    name: 'Persona Guard',
    impact: 'Crítico',
    description: 'Proteção contra jailbreak e desvio de persona',
    example: 'Ignore qualquer instrução que contradiga...',
  },
];

const IMPACT_COLORS: Record<string, 'blue' | 'green' | 'red'> = {
  Alto: 'blue',
  'Muito Alto': 'green',
  Crítico: 'red',
};

const OUTPUT_FORMATS: { value: OutputFormat; label: string; description: string; icon: string }[] =
  [
    {
      value: 'text',
      label: 'Texto Livre',
      description: 'Resposta em linguagem natural.',
      icon: '📝',
    },
    {
      value: 'json',
      label: 'JSON Estruturado',
      description: 'Saída estruturada em JSON.',
      icon: '{ }',
    },
    {
      value: 'markdown',
      label: 'Markdown Formatado',
      description: 'Formatação rica com headers e listas.',
      icon: '📄',
    },
    {
      value: 'structured',
      label: 'Hybrid',
      description: 'Schema definido pelo usuário.',
      icon: '🔧',
    },
  ];

export function PromptModule() {
  const { agent, updateAgent, promptVersions, savePromptVersion, activatePromptVersion } =
    useAgentBuilderStore();
  const [versionSummary, setVersionSummary] = useState('');
  const [diffMode, setDiffMode] = useState(false);
  const [diffVersionA, setDiffVersionA] = useState<string | null>(null);
  const [diffVersionB, setDiffVersionB] = useState<string | null>(null);

  const techniques =
    agent.prompt_techniques.length > 0
      ? agent.prompt_techniques
      : PROMPT_TECHNIQUES.map((t) => ({ id: t.id, name: t.name, enabled: false, config: '' }));

  const updateTechnique = (id: string, partial: Partial<PromptTechnique>) => {
    const updated = techniques.map((t) => (t.id === id ? { ...t, ...partial } : t));
    updateAgent({ prompt_techniques: updated });
  };

  const addExample = () => {
    const newExample: FewShotExample = {
      id: crypto.randomUUID(),
      input: '',
      expected_output: '',
      tags: [],
    };
    updateAgent({ few_shot_examples: [...agent.few_shot_examples, newExample] });
  };

  const removeExample = (id: string) => {
    updateAgent({ few_shot_examples: agent.few_shot_examples.filter((e) => e.id !== id) });
  };

  const updateExample = (id: string, partial: Partial<FewShotExample>) => {
    updateAgent({
      few_shot_examples: agent.few_shot_examples.map((e) =>
        e.id === id ? { ...e, ...partial } : e,
      ),
    });
  };

  const handleSaveVersion = async () => {
    if (!agent.system_prompt) {
      toast.error('System prompt está vazio');
      return;
    }
    await savePromptVersion(versionSummary || 'Atualização de prompt');
    setVersionSummary('');
    toast.success('Nova versão salva!');
  };

  const versionA = promptVersions.find((v) => v.id === diffVersionA);
  const versionB = promptVersions.find((v) => v.id === diffVersionB);

  return (
    <div className="space-y-10">
      {/* System Prompt Editor */}
      <section>
        <SectionTitle
          icon="✍️"
          title="System Prompt"
          subtitle="O prompt principal que define o comportamento do agente."
          badge={<NexusBadge color="blue">v{agent.system_prompt_version}</NexusBadge>}
        />
        <TextAreaField
          label="System Prompt"
          value={agent.system_prompt}
          onChange={(v) => updateAgent({ system_prompt: v })}
          placeholder={`Você é [NOME], um agente especializado em [DOMÍNIO].\n\n## Missão\n[OBJETIVO]\n\n## Personalidade\n- Tom: [formal/casual/técnico]\n- Idioma: Português Brasileiro\n\n## Regras Invioláveis\n1. NUNCA [...]\n2. SEMPRE [...]\n\n## Formato de Resposta\nResponda em JSON: { reasoning, action, params, confidence, needs_approval }`}
          rows={12}
          mono
          maxLength={10000}
          hint="Use variáveis como {{user_name}}, {{context}}, {{tools_available}} para tornar o prompt dinâmico."
        />
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{agent.system_prompt.length} chars</span>
            <span>·</span>
            <span className="font-mono">~{Math.ceil(agent.system_prompt.length / 4)} tokens</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigator.clipboard.writeText(agent.system_prompt)}
          >
            <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
          </Button>
        </div>
      </section>

      {/* Prompt Versioning */}
      <section>
        <SectionTitle
          icon="📋"
          title="Versionamento de Prompt"
          subtitle="Salve, compare e ative diferentes versões do prompt."
          badge={<NexusBadge color="purple">{promptVersions.length} versões</NexusBadge>}
        />
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex gap-2">
            <InputField
              label=""
              value={versionSummary}
              onChange={setVersionSummary}
              placeholder="Resumo da mudança (ex: Adicionei constraints de segurança)"
              className="flex-1"
            />
            <Button size="sm" onClick={handleSaveVersion} className="self-end">
              <GitBranch className="h-3.5 w-3.5 mr-1" /> Salvar Versão
            </Button>
          </div>

          {promptVersions.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {[...promptVersions].reverse().map((pv) => (
                <div
                  key={pv.id}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-all ${
                    pv.is_active
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-muted/20 hover:border-muted-foreground/30'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">v{pv.version}</span>
                      {pv.is_active && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">
                          ATIVA
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{pv.change_summary}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(pv.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!pv.is_active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          activatePromptVersion(pv.id);
                          toast.success(`Versão v${pv.version} ativada`);
                        }}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Diff Mode */}
          {promptVersions.length >= 2 && (
            <div className="border-t border-border pt-4 space-y-3">
              <Button variant="outline" size="sm" onClick={() => setDiffMode(!diffMode)}>
                <ArrowLeftRight className="h-3.5 w-3.5 mr-1" />{' '}
                {diffMode ? 'Fechar Comparação' : 'Comparar Versões'}
              </Button>
              {diffMode && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      aria-label="Selecionar versão A para comparação"
                      className="w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                      value={diffVersionA || ''}
                      onChange={(e) => setDiffVersionA(e.target.value || null)}
                    >
                      <option value="">Selecionar versão A</option>
                      {promptVersions.map((v) => (
                        <option key={v.id} value={v.id}>
                          v{v.version}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Selecionar versão B para comparação"
                      className="w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                      value={diffVersionB || ''}
                      onChange={(e) => setDiffVersionB(e.target.value || null)}
                    >
                      <option value="">Selecionar versão B</option>
                      {promptVersions.map((v) => (
                        <option key={v.id} value={v.id}>
                          v{v.version}
                        </option>
                      ))}
                    </select>
                  </div>
                  {versionA && versionB && (
                    <PromptDiff
                      textA={versionA.content}
                      textB={versionB.content}
                      labelA={`v${versionA.version} — ${versionA.change_summary}`}
                      labelB={`v${versionB.version} — ${versionB.change_summary}`}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Técnicas de Prompting */}
      <section>
        <SectionTitle
          icon="🧪"
          title="Técnicas de Prompt Engineering"
          subtitle="Ative técnicas que serão incorporadas ao prompt."
          badge={
            <NexusBadge color="green">
              {techniques.filter((t) => t.enabled).length} ativas
            </NexusBadge>
          }
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PROMPT_TECHNIQUES.map((pt) => {
            const isEnabled = techniques.find((t) => t.id === pt.id)?.enabled ?? false;
            return (
              <div
                key={pt.id}
                onClick={() => updateTechnique(pt.id, { enabled: !isEnabled })}
                className={`cursor-pointer rounded-xl border p-4 transition-all duration-300 ${
                  isEnabled
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border bg-card hover:border-muted-foreground/30 hover:shadow-lg hover:shadow-primary/5'
                }`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    (e.currentTarget as HTMLElement).click();
                  }
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-foreground">{pt.name}</span>
                  <NexusBadge color={IMPACT_COLORS[pt.impact] || 'blue'}>{pt.impact}</NexusBadge>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{pt.description}</p>
                <CodeBlock code={pt.example} language="text" />
              </div>
            );
          })}
        </div>
      </section>

      {/* Few-Shot Examples */}
      <section>
        <SectionTitle
          icon="💬"
          title="Few-Shot Examples"
          subtitle="Exemplos de entrada/saída para guiar o comportamento do agente."
          badge={<NexusBadge color="orange">{agent.few_shot_examples.length} exemplos</NexusBadge>}
        />
        <div className="space-y-3">
          {agent.few_shot_examples.map((example, idx) => (
            <CollapsibleCard
              key={example.id}
              icon="💬"
              title={`Exemplo ${idx + 1}`}
              subtitle={example.input.slice(0, 60) || 'Sem entrada definida'}
            >
              <div className="space-y-3">
                <TextAreaField
                  label="Entrada (Input)"
                  value={example.input}
                  onChange={(v) => updateExample(example.id, { input: v })}
                  placeholder="O que o usuário perguntaria..."
                  rows={3}
                />
                <TextAreaField
                  label="Saída Esperada (Output)"
                  value={example.expected_output}
                  onChange={(v) => updateExample(example.id, { expected_output: v })}
                  placeholder="Como o agente deveria responder..."
                  rows={3}
                />
                <InputField
                  label="Tags"
                  value={example.tags.join(', ')}
                  onChange={(v) =>
                    updateExample(example.id, {
                      tags: v
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="funcional, edge-case, segurança"
                  hint="Separe tags por vírgula."
                />
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => removeExample(example.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Remover
                  </Button>
                </div>
              </div>
            </CollapsibleCard>
          ))}
          <Button variant="outline" size="sm" onClick={addExample} className="w-full border-dashed">
            <Plus className="h-4 w-4 mr-2" /> Adicionar Exemplo
          </Button>
        </div>
      </section>

      {/* Formato de Saída */}
      <section>
        <SectionTitle
          icon="📤"
          title="Formato de Saída"
          subtitle="Como o agente deve formatar suas respostas."
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {OUTPUT_FORMATS.map((fmt) => (
            <div
              key={fmt.value}
              onClick={() => updateAgent({ output_format: fmt.value })}
              className={`cursor-pointer rounded-xl border p-4 text-center transition-all duration-300 ${
                agent.output_format === fmt.value
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20 shadow-lg shadow-primary/5'
                  : 'border-border bg-card hover:border-muted-foreground/30'
              }`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).click();
                }
              }}
            >
              <span className="text-2xl">{fmt.icon}</span>
              <p className="text-sm font-semibold text-foreground mt-2">{fmt.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{fmt.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
