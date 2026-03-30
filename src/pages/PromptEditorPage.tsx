import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Save, GitBranch, Play, CheckCircle, AlertTriangle,
  Variable, RotateCcw, Plus, Trash2,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";

/* ─── Mock data ─── */
const PROMPT_DB: Record<string, PromptData> = {
  "1": {
    id: "1", name: "Suporte Premium L1", agent: "Atlas", currentVersion: "v2.4",
    sections: {
      persona: "Você é o Atlas, assistente de suporte premium da empresa Nexus.\n- Tom profissional mas acolhedor\n- Respostas precisas e concisas\n- Sempre cite a fonte da informação",
      scope: "- Responder dúvidas técnicas sobre o produto\n- Guiar integrações e configurações\n- Escalar para humano quando fora do escopo\n- Nunca inventar informações",
      rules: "- Máximo 300 palavras por resposta\n- Sempre perguntar antes de tomar ação destrutiva\n- Não revelar dados de outros clientes\n- Manter contexto das últimas 10 mensagens",
      tools: "- search_knowledge: buscar na base técnica\n- crm_lookup: consultar dados do cliente\n- create_ticket: abrir ticket de suporte\n- escalate_human: transferir para atendente",
      output: "- Use markdown para formatação\n- Inclua links relevantes da documentação\n- Adicione citações [fonte] para cada afirmação factual",
      examples: 'User: "Como configuro webhooks?"\nAssistant: "Para configurar webhooks, acesse **Configurações > Integrações > Webhooks** e clique em \'Novo Webhook\'. [Docs: Webhooks Guide]\n\nVocê precisará de:\n1. URL de destino\n2. Eventos a monitorar\n3. Secret para validação\n\nPosso guiá-lo em algum desses passos?"',
      fallback: "- Se não souber a resposta: \"Vou verificar com a equipe técnica e retorno em breve.\"\n- Se fora do escopo: escalar via escalate_human com resumo do contexto\n- Se detectar frustração: oferecer canal direto com especialista",
    },
    variables: [
      { key: "customer_name", description: "Nome do cliente", example: "Marina Costa" },
      { key: "plan", description: "Plano atual", example: "Enterprise" },
      { key: "tone", description: "Tom da resposta", example: "formal" },
    ],
    versions: [
      { id: "v2.4", date: "2026-03-28", author: "Marina Costa", changes: "Adicionou fallback policy e exemplos few-shot" },
      { id: "v2.3", date: "2026-03-20", author: "Marina Costa", changes: "Refinou regras de citação" },
      { id: "v2.2", date: "2026-03-12", author: "Rafael Mendes", changes: "Adicionou tool create_ticket" },
      { id: "v2.1", date: "2026-02-28", author: "Marina Costa", changes: "Expandiu persona e escopo" },
      { id: "v2.0", date: "2026-02-15", author: "Marina Costa", changes: "Reescrita completa do prompt" },
    ],
    score: { clarity: true, scope: true, tools: true, format: true, safety: true, examples: true, fallback: true },
  },
};

// Simple fallback for any id
function getPrompt(id: string): PromptData {
  return PROMPT_DB[id] || PROMPT_DB["1"];
}

interface PromptData {
  id: string; name: string; agent: string; currentVersion: string;
  sections: Record<string, string>;
  variables: { key: string; description: string; example: string }[];
  versions: { id: string; date: string; author: string; changes: string }[];
  score: Record<string, boolean>;
}

const SECTION_META: { key: string; label: string; placeholder: string }[] = [
  { key: "persona", label: "Persona", placeholder: "Defina a personalidade, tom e estilo do agente..." },
  { key: "scope", label: "Escopo", placeholder: "O que o agente pode e não pode fazer..." },
  { key: "rules", label: "Regras", placeholder: "Restrições, limites e políticas..." },
  { key: "tools", label: "Ferramentas", placeholder: "Ferramentas disponíveis e quando usá-las..." },
  { key: "output", label: "Formato de saída", placeholder: "Como formatar as respostas..." },
  { key: "examples", label: "Exemplos (few-shot)", placeholder: "Exemplos de interações ideais..." },
  { key: "fallback", label: "Fallback & Escalação", placeholder: "O que fazer quando não souber responder..." },
];

export default function PromptEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const prompt = getPrompt(id || "1");
  const { setHasUnsavedChanges } = useUnsavedChanges();

  const [sections, setSections] = useState(prompt.sections);
  const [variables, setVariables] = useState(prompt.variables);
  const [activeTab, setActiveTab] = useState("editor");
  const [diffVersion, setDiffVersion] = useState<string | null>(null);

  const updateSection = (key: string, value: string) => {
    setSections(prev => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  };

  const addVariable = () => {
    setVariables(prev => [...prev, { key: "", description: "", example: "" }]);
    setHasUnsavedChanges(true);
  };

  const updateVariable = (i: number, field: string, value: string) => {
    setVariables(prev => prev.map((v, idx) => idx === i ? { ...v, [field]: value } : v));
    setHasUnsavedChanges(true);
  };

  const removeVariable = (i: number) => {
    setVariables(prev => prev.filter((_, idx) => idx !== i));
    setHasUnsavedChanges(true);
  };

  const handleSave = () => {
    setHasUnsavedChanges(false);
    toast.success("Prompt salvo!", { description: `Nova versão criada para ${prompt.name}` });
  };

  const compiledPrompt = SECTION_META
    .map(s => sections[s.key] ? `## ${s.label}\n${sections[s.key]}` : "")
    .filter(Boolean)
    .join("\n\n");

  const scoreItems = Object.entries(prompt.score);
  const scorePercent = Math.round((scoreItems.filter(([, v]) => v).length / scoreItems.length) * 100);

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/prompts")} className="text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-heading font-bold text-foreground">{prompt.name}</h1>
              <Badge variant="outline" className="text-[10px] font-mono">{prompt.currentVersion}</Badge>
              <Badge className="bg-primary/10 text-primary text-[10px]">{prompt.agent}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Editor avançado de prompt com seções estruturadas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Play className="h-3.5 w-3.5" /> Testar
          </Button>
          <Button size="sm" onClick={handleSave} className="gap-1.5 text-xs nexus-gradient-bg text-primary-foreground hover:opacity-90">
            <Save className="h-3.5 w-3.5" /> Salvar versão
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-secondary/50 border border-border/50">
          <TabsTrigger value="editor" className="text-xs data-[state=active]:bg-background">Seções</TabsTrigger>
          <TabsTrigger value="variables" className="text-xs data-[state=active]:bg-background">Variáveis</TabsTrigger>
          <TabsTrigger value="preview" className="text-xs data-[state=active]:bg-background">Preview</TabsTrigger>
          <TabsTrigger value="versions" className="text-xs data-[state=active]:bg-background">Versões & Diff</TabsTrigger>
          <TabsTrigger value="score" className="text-xs data-[state=active]:bg-background">Score</TabsTrigger>
        </TabsList>

        {/* ─── Sections Editor ─── */}
        <TabsContent value="editor" className="mt-4 space-y-4">
          {SECTION_META.map((s, i) => (
            <motion.div key={s.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="nexus-card"
            >
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold text-foreground">{s.label}</Label>
                <span className="text-[10px] text-muted-foreground">{(sections[s.key] || "").length} chars</span>
              </div>
              <Textarea
                value={sections[s.key] || ""}
                onChange={e => updateSection(s.key, e.target.value)}
                placeholder={s.placeholder}
                rows={Math.max(3, (sections[s.key] || "").split("\n").length + 1)}
                className="bg-nexus-surface-1 border-border/50 font-mono text-xs leading-relaxed resize-none"
              />
            </motion.div>
          ))}
        </TabsContent>

        {/* ─── Variables ─── */}
        <TabsContent value="variables" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Variáveis de template</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Use <code className="bg-secondary px-1 py-0.5 rounded text-[10px] font-mono">{"{{variável}}"}</code> no prompt para inserção dinâmica.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={addVariable} className="gap-1.5 text-xs">
              <Plus className="h-3 w-3" /> Adicionar
            </Button>
          </div>
          {variables.map((v, i) => (
            <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="nexus-card grid grid-cols-[1fr_1.5fr_1fr_auto] gap-3 items-end"
            >
              <div>
                <Label className="text-[10px] text-muted-foreground">Chave</Label>
                <Input value={v.key} onChange={e => updateVariable(i, "key", e.target.value)}
                  placeholder="nome_variavel" className="mt-1 bg-secondary/50 border-border/50 text-xs font-mono" />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Descrição</Label>
                <Input value={v.description} onChange={e => updateVariable(i, "description", e.target.value)}
                  placeholder="Para que serve" className="mt-1 bg-secondary/50 border-border/50 text-xs" />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Exemplo</Label>
                <Input value={v.example} onChange={e => updateVariable(i, "example", e.target.value)}
                  placeholder="Valor exemplo" className="mt-1 bg-secondary/50 border-border/50 text-xs" />
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeVariable(i)} className="text-muted-foreground hover:text-destructive h-9 w-9">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </motion.div>
          ))}
          {variables.length > 0 && (
            <div className="nexus-card bg-nexus-surface-1">
              <p className="text-[10px] text-muted-foreground mb-2">Uso no prompt:</p>
              <div className="flex flex-wrap gap-1.5">
                {variables.filter(v => v.key).map(v => (
                  <code key={v.key} className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-mono">
                    {`{{${v.key}}}`}
                  </code>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ─── Preview ─── */}
        <TabsContent value="preview" className="mt-4">
          <div className="nexus-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Prompt compilado</h3>
              <span className="text-[10px] text-muted-foreground">{compiledPrompt.length} caracteres</span>
            </div>
            <div className="rounded-lg bg-nexus-surface-1 p-4 font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap max-h-[600px] overflow-y-auto">
              {compiledPrompt}
            </div>
          </div>
        </TabsContent>

        {/* ─── Versions & Diff ─── */}
        <TabsContent value="versions" className="mt-4 space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Version list */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground mb-2">Histórico de versões</h3>
              {prompt.versions.map((v, i) => (
                <motion.div key={v.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                  className={`nexus-card flex items-center justify-between cursor-pointer transition-all ${
                    diffVersion === v.id ? "ring-2 ring-primary bg-primary/5" : ""
                  } ${i === 0 ? "border-primary/30" : ""}`}
                  onClick={() => setDiffVersion(diffVersion === v.id ? null : v.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${i === 0 ? "bg-primary/15" : "bg-secondary"}`}>
                      <GitBranch className={`h-4 w-4 ${i === 0 ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-medium text-foreground">{v.id}</span>
                        {i === 0 && <Badge className="bg-primary/10 text-primary text-[9px]">atual</Badge>}
                      </div>
                      <p className="text-[10px] text-muted-foreground">{v.changes}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">{v.date}</p>
                    <p className="text-[10px] text-muted-foreground">{v.author}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Diff panel */}
            <div className="nexus-card">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                {diffVersion ? `Diff: ${diffVersion} → ${prompt.currentVersion}` : "Selecione uma versão para comparar"}
              </h3>
              {diffVersion ? (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {SECTION_META.map(s => (
                    <div key={s.key} className="rounded-lg overflow-hidden border border-border/50">
                      <div className="bg-secondary/50 px-3 py-1.5 text-[10px] font-semibold text-foreground">{s.label}</div>
                      <div className="p-3 space-y-1">
                        <div className="flex items-start gap-2">
                          <span className="text-destructive font-mono text-[10px] shrink-0 mt-0.5">−</span>
                          <span className="text-xs text-muted-foreground font-mono line-through">
                            {(sections[s.key] || "").slice(0, 60)}...
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-nexus-emerald font-mono text-[10px] shrink-0 mt-0.5">+</span>
                          <span className="text-xs text-foreground font-mono">
                            {(sections[s.key] || "").slice(0, 60)}... <span className="text-nexus-emerald">(atualizado)</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <GitBranch className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">Clique em uma versão à esquerda para visualizar as diferenças.</p>
                </div>
              )}
              {diffVersion && (
                <Button variant="outline" size="sm" className="mt-3 gap-1.5 text-xs w-full">
                  <RotateCcw className="h-3 w-3" /> Restaurar {diffVersion}
                </Button>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ─── Score ─── */}
        <TabsContent value="score" className="mt-4">
          <div className="nexus-card">
            <div className="flex items-center gap-4 mb-4">
              <div className="relative h-16 w-16">
                <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--secondary))" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--primary))" strokeWidth="3"
                    strokeDasharray={`${scorePercent * 0.975} 97.5`} strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-heading font-bold text-foreground">
                  {scorePercent}%
                </span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Score de qualidade</h3>
                <p className="text-xs text-muted-foreground">Checklist de boas práticas para prompts de produção</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                { key: "clarity", label: "Clareza e especificidade" },
                { key: "scope", label: "Escopo bem definido" },
                { key: "tools", label: "Ferramentas documentadas" },
                { key: "format", label: "Formato de saída" },
                { key: "safety", label: "Regras de segurança" },
                { key: "examples", label: "Exemplos few-shot" },
                { key: "fallback", label: "Política de fallback" },
              ].map(item => (
                <div key={item.key} className="flex items-center gap-2 text-xs">
                  {prompt.score[item.key] ? (
                    <CheckCircle className="h-4 w-4 text-nexus-emerald" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-nexus-amber" />
                  )}
                  <span className={prompt.score[item.key] ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
