import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { SectionTitle, NexusBadge, ToggleField, SelectField, InputField, TextAreaField } from '../ui';
import { CollapsibleCard } from '../ui/CollapsibleCard';
import { CodeBlock } from '../ui/CodeBlock';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Copy } from 'lucide-react';
import type { PromptTechnique, FewShotExample, OutputFormat } from '@/types/agentTypes';

const PROMPT_TECHNIQUES: Omit<PromptTechnique, 'config'>[] = [
  { id: 'chain_of_thought', name: 'Chain of Thought (CoT)', enabled: false },
  { id: 'few_shot', name: 'Few-Shot Examples', enabled: false },
  { id: 'role_play', name: 'Role Play', enabled: false },
  { id: 'step_by_step', name: 'Step-by-Step Instructions', enabled: false },
  { id: 'self_reflection', name: 'Self-Reflection', enabled: false },
  { id: 'output_format', name: 'Output Format Enforcement', enabled: false },
  { id: 'guardrail_prompt', name: 'Guardrail Prompting', enabled: false },
  { id: 'meta_prompting', name: 'Meta-Prompting', enabled: false },
];

const OUTPUT_FORMATS: { value: OutputFormat; label: string; description: string }[] = [
  { value: 'text', label: 'Texto Livre', description: 'Resposta em linguagem natural.' },
  { value: 'json', label: 'JSON', description: 'Saída estruturada em JSON.' },
  { value: 'markdown', label: 'Markdown', description: 'Formatação rica com headers, listas, etc.' },
  { value: 'structured', label: 'Structured', description: 'Schema definido pelo usuário.' },
];

export function PromptModule() {
  const agent = useAgentBuilderStore((s) => s.agent);
  const updateAgent = useAgentBuilderStore((s) => s.updateAgent);

  const techniques = agent.prompt_techniques.length > 0
    ? agent.prompt_techniques
    : PROMPT_TECHNIQUES.map((t) => ({ ...t, config: '' }));

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
      few_shot_examples: agent.few_shot_examples.map((e) => (e.id === id ? { ...e, ...partial } : e)),
    });
  };

  const promptPreview = `${agent.system_prompt}\n\n---\nTécnicas ativas: ${techniques.filter((t) => t.enabled).map((t) => t.name).join(', ') || 'Nenhuma'}\nFormato de saída: ${agent.output_format}\nExemplos few-shot: ${agent.few_shot_examples.length}`;

  return (
    <div className="space-y-10">
      {/* Seção A — System Prompt Editor */}
      <section>
        <SectionTitle
          icon="✍️"
          title="System Prompt"
          subtitle="O prompt principal que define o comportamento do agente."
          badge={
            <NexusBadge color="blue">
              v{agent.system_prompt_version}
            </NexusBadge>
          }
        />
        <TextAreaField
          label="System Prompt"
          value={agent.system_prompt}
          onChange={(v) => updateAgent({ system_prompt: v })}
          placeholder="Você é um agente especializado em..."
          rows={10}
          mono
          maxLength={10000}
          hint="Use variáveis como {{user_name}}, {{context}}, {{tools_available}} para tornar o prompt dinâmico."
        />
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{agent.system_prompt.length} chars</span>
          <span>·</span>
          <span className="font-mono">~{Math.ceil(agent.system_prompt.length / 4)} tokens</span>
        </div>
      </section>

      {/* Seção B — Técnicas de Prompting */}
      <section>
        <SectionTitle
          icon="🧪"
          title="Técnicas de Prompting"
          subtitle="Ative técnicas que serão incorporadas ao prompt."
          badge={
            <NexusBadge color="green">
              {techniques.filter((t) => t.enabled).length} ativas
            </NexusBadge>
          }
        />
        <div className="space-y-2">
          {techniques.map((technique) => (
            <div
              key={technique.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <ToggleField
                  label=""
                  checked={technique.enabled}
                  onCheckedChange={(v) => updateTechnique(technique.id, { enabled: v })}
                />
                <span className="text-sm font-medium text-foreground">{technique.name}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Seção C — Few-Shot Examples */}
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
                    updateExample(example.id, { tags: v.split(',').map((t) => t.trim()).filter(Boolean) })
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

      {/* Seção D — Formato de Saída */}
      <section>
        <SectionTitle icon="📤" title="Formato de Saída" subtitle="Como o agente deve formatar suas respostas." />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {OUTPUT_FORMATS.map((fmt) => (
            <div
              key={fmt.value}
              onClick={() => updateAgent({ output_format: fmt.value })}
              className={`cursor-pointer rounded-xl border p-4 transition-all ${
                agent.output_format === fmt.value
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                  : 'border-border bg-card hover:border-muted-foreground/30'
              }`}
            >
              <p className="text-sm font-semibold text-foreground">{fmt.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{fmt.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Seção E — Preview do Prompt Montado */}
      <section>
        <SectionTitle icon="👁️" title="Preview do Prompt" subtitle="Visualização do prompt montado com todas as técnicas." />
        <CodeBlock code={promptPreview} language="markdown" />
        <div className="mt-2 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigator.clipboard.writeText(agent.system_prompt)}
          >
            <Copy className="h-4 w-4 mr-1" /> Copiar Prompt
          </Button>
        </div>
      </section>
    </div>
  );
}
