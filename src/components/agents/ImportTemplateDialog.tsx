/**
 * Modal de importação de skills/templates externos.
 *
 * Suporta três entradas:
 *  - Colar JSON (formato nativo AgentTemplateRaw ou Dify/n8n — auto-detecta).
 *  - URL remota (HTTPS público; passa por SSRF guard).
 *  - Markdown skill (Claude Skill / awesome-prompts, com YAML frontmatter opcional).
 *
 * Após importar, mostra preview (nome, emoji, prompt truncado, tools +
 * unknowns + warnings) e expõe dois callbacks:
 *  - `onAddToGallery(t)` — injeta o template no array em memória.
 *  - `onForkNow(t)` — roda o fluxo existente de fork + saveAgent.
 */
import { useState } from 'react';
import { AlertTriangle, Download, FileJson, FileText, Globe, Loader2 } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { AgentTemplate, AgentTemplateRaw } from '@/data/agentTemplates';
import {
  ImportError,
  importAgentTemplate,
  type ImportResult,
  type ImportSource,
} from '@/lib/templateImporter';
import { logger } from '@/lib/logger';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToGallery: (t: AgentTemplate) => void;
  onForkNow: (t: AgentTemplate) => void;
}

/** Converte AgentTemplateRaw (do importador) em AgentTemplate (formato da galeria). */
function toGalleryTemplate(raw: AgentTemplateRaw): AgentTemplate {
  return {
    ...raw,
    emoji: raw.icon,
    type: raw.config.persona,
    model: raw.config.model,
    prompt: raw.config.system_prompt,
    tools: raw.config.tools,
    memory: raw.config.memory_types,
    enriched: Boolean(
      raw.config.few_shot_examples?.length ||
      raw.config.detailed_guardrails?.length ||
      raw.config.test_cases?.length,
    ),
  };
}

export function ImportTemplateDialog({ open, onOpenChange, onAddToGallery, onForkNow }: Props) {
  const [tab, setTab] = useState<'json' | 'url' | 'markdown'>('json');
  const [jsonText, setJsonText] = useState('');
  const [urlText, setUrlText] = useState('');
  const [mdText, setMdText] = useState('');
  const [mdName, setMdName] = useState('');
  const [mdIcon, setMdIcon] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function reset() {
    setJsonText('');
    setUrlText('');
    setMdText('');
    setMdName('');
    setMdIcon('');
    setResult(null);
    setErrorMsg(null);
  }

  async function handleImport() {
    setLoading(true);
    setErrorMsg(null);
    setResult(null);
    try {
      let source: ImportSource;
      if (tab === 'json') {
        const trimmed = jsonText.trim();
        if (!trimmed)
          throw new ImportError('Cole o JSON do template antes de importar', 'invalid_payload');
        let payload: unknown;
        try {
          payload = JSON.parse(trimmed);
        } catch {
          throw new ImportError('JSON inválido — verifique a sintaxe', 'invalid_payload');
        }
        // Auto-detect native vs dify vs n8n.
        const kind = detectKindFromPayload(payload);
        source =
          kind === 'dify'
            ? { kind: 'dify', payload }
            : kind === 'n8n'
              ? { kind: 'n8n', payload }
              : { kind: 'json_native', payload };
      } else if (tab === 'url') {
        const url = urlText.trim();
        if (!url) throw new ImportError('Informe a URL', 'invalid_url');
        source = { kind: 'json_url', url };
      } else {
        const content = mdText.trim();
        if (!content) throw new ImportError('Cole o conteúdo markdown', 'invalid_payload');
        source = {
          kind: 'markdown_skill',
          content,
          name: mdName.trim() || undefined,
          icon: mdIcon.trim() || undefined,
        };
      }
      const res = await importAgentTemplate(source);
      setResult(res);
    } catch (err) {
      const msg =
        err instanceof ImportError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Erro desconhecido';
      setErrorMsg(msg);
      logger.warn('Template import failed', err);
    } finally {
      setLoading(false);
    }
  }

  function handleAddToGallery() {
    if (!result) return;
    onAddToGallery(toGalleryTemplate(result.template));
    reset();
    onOpenChange(false);
  }

  function handleForkNow() {
    if (!result) return;
    onForkNow(toGalleryTemplate(result.template));
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-4 w-4" /> Importar Template
          </DialogTitle>
          <DialogDescription>
            Importe uma skill/template de JSON nativo, Dify, n8n ou markdown (Claude Skill /
            awesome-prompts). Templates importados ficam disponíveis na galeria apenas nesta sessão.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="json" className="gap-1.5">
              <FileJson className="h-3.5 w-3.5" /> JSON
            </TabsTrigger>
            <TabsTrigger value="url" className="gap-1.5">
              <Globe className="h-3.5 w-3.5" /> URL
            </TabsTrigger>
            <TabsTrigger value="markdown" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Markdown
            </TabsTrigger>
          </TabsList>

          <TabsContent value="json" className="space-y-2">
            <Label htmlFor="tpl-json">Cole o JSON do template</Label>
            <Textarea
              id="tpl-json"
              placeholder={`{"id":"meu_template","name":"...", "config":{ "system_prompt":"..." } }`}
              rows={10}
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Auto-detecta formato nativo, Dify ou n8n a partir das chaves presentes.
            </p>
          </TabsContent>

          <TabsContent value="url" className="space-y-2">
            <Label htmlFor="tpl-url">URL (HTTPS público)</Label>
            <Input
              id="tpl-url"
              type="url"
              placeholder="https://raw.githubusercontent.com/.../template.json"
              value={urlText}
              onChange={(e) => setUrlText(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Só HTTPS. Hosts privados/loopback são bloqueados. Máx. 256 KB, timeout 10s.
            </p>
          </TabsContent>

          <TabsContent value="markdown" className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="tpl-md-name">Nome (opcional)</Label>
                <Input
                  id="tpl-md-name"
                  placeholder="Revisor de Código"
                  value={mdName}
                  onChange={(e) => setMdName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tpl-md-icon">Emoji (opcional)</Label>
                <Input
                  id="tpl-md-icon"
                  placeholder="🧩"
                  value={mdIcon}
                  onChange={(e) => setMdIcon(e.target.value)}
                  maxLength={4}
                />
              </div>
            </div>
            <Label htmlFor="tpl-md">Conteúdo markdown</Label>
            <Textarea
              id="tpl-md"
              placeholder={`---\nname: Revisor de Código\nmodel: claude-sonnet-4-6\n---\n\n# Revisor\n\nVocê é um revisor...`}
              rows={10}
              value={mdText}
              onChange={(e) => setMdText(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Frontmatter YAML simples (name, model, persona, icon, category, tags). O corpo vira{' '}
              <code>system_prompt</code>.
            </p>
          </TabsContent>
        </Tabs>

        {errorMsg && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Não foi possível importar</AlertTitle>
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        {result && (
          <Alert>
            <AlertTitle className="flex items-center gap-2">
              <span className="text-lg">{result.template.icon}</span>
              {result.template.name}
              <Badge variant="secondary" className="ml-auto text-xs">
                {result.sourceKind}
              </Badge>
            </AlertTitle>
            <AlertDescription className="space-y-2 mt-2">
              <p className="text-xs text-muted-foreground">{result.template.description}</p>
              <ScrollArea className="max-h-32 rounded bg-muted/30 p-2 text-xs font-mono">
                {result.template.config.system_prompt.slice(0, 600)}
                {result.template.config.system_prompt.length > 600 ? '…' : ''}
              </ScrollArea>
              <div className="flex flex-wrap gap-1 text-xs">
                {result.template.config.tools.map((t) => (
                  <Badge
                    key={t}
                    variant={result.unknownTools.includes(t) ? 'destructive' : 'default'}
                  >
                    {t}
                  </Badge>
                ))}
              </div>
              {result.unknownTools.length > 0 && (
                <p className="text-xs text-destructive">
                  {result.unknownTools.length} tool(s) não catalogadas — você precisará mapeá-las
                  manualmente.
                </p>
              )}
              {result.warnings.length > 0 && (
                <ul className="text-xs text-muted-foreground list-disc pl-4">
                  {result.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          {!result ? (
            <Button onClick={handleImport} disabled={loading}>
              {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Importar
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={handleAddToGallery}>
                Adicionar à galeria
              </Button>
              <Button onClick={handleForkNow}>Forkar agora</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Heurística rápida para decidir se o JSON colado é native / dify / n8n. */
function detectKindFromPayload(payload: unknown): 'native' | 'dify' | 'n8n' {
  if (!payload || typeof payload !== 'object') return 'native';
  const p = payload as Record<string, unknown>;
  if (
    Array.isArray(p.nodes) &&
    p.nodes.some((n: Record<string, unknown>) => String(n.type ?? '').includes('n8n'))
  ) {
    return 'n8n';
  }
  if ('model_config' in p || 'modelConfig' in p) return 'dify';
  return 'native';
}
