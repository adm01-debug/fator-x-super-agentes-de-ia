/**
 * Nexus Agents Studio — Document OCR Dialog
 *
 * Wraps the doc-ocr Edge Function (IBM Granite Vision 3.3-2b).
 * Lets users upload a document image and run one of 4 actions:
 *   - ocr            : full text extraction
 *   - describe       : free-form description (custom prompt)
 *   - extract_table  : returns tables as markdown
 *   - extract_fields : structured JSON for a list of named fields
 *
 * Used in KnowledgePage actions row, next to Audio + Create base.
 */
import { useState } from "react";
import { Loader2, FileSearch, Copy, Download, Upload, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { runDocOcr, type DocOcrAction } from "@/services/knowledgeService";
import { imageToBase64 } from "@/services/productMockupService";

export function DocOcrDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [action, setAction] = useState<DocOcrAction>("ocr");
  const [prompt, setPrompt] = useState("");
  const [fieldDraft, setFieldDraft] = useState("");
  const [fields, setFields] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  const reset = () => {
    setFile(null);
    setPreview("");
    setResult("");
    setLoading(false);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : "");
    setResult("");
  };

  const addField = () => {
    const v = fieldDraft.trim();
    if (!v) return;
    if (fields.includes(v)) {
      toast.error("Campo já adicionado");
      return;
    }
    setFields([...fields, v]);
    setFieldDraft("");
  };

  const removeField = (f: string) => setFields(fields.filter((x) => x !== f));

  const handleRun = async () => {
    if (!file) {
      toast.error("Selecione uma imagem do documento");
      return;
    }
    if (action === "extract_fields" && fields.length === 0) {
      toast.error("Adicione pelo menos 1 campo a extrair");
      return;
    }
    setLoading(true);
    try {
      const imageBase64 = await imageToBase64(file);
      const data = await runDocOcr({
        imageBase64,
        action,
        prompt: action === "describe" ? prompt : undefined,
        fields: action === "extract_fields" ? fields : undefined,
      });
      setResult(data.text || "(sem resposta)");
      toast.success(`OCR concluído (${data.model})`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    toast.success("Texto copiado");
  };

  const handleDownload = () => {
    const blob = new Blob([result], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `doc-ocr-${action}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <FileSearch className="h-3.5 w-3.5" />
          OCR de documento
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-nexus-emerald" />
            OCR de documento
          </DialogTitle>
          <DialogDescription>
            IBM Granite Vision 3.3-2b · OCR, descrição, tabelas e campos estruturados
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ocr-file">Imagem do documento</Label>
            <div className="flex items-center gap-2">
              <input
                id="ocr-file"
                type="file"
                accept="image/*"
                onChange={handleFile}
                className="flex-1 text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-background file:text-foreground hover:file:bg-muted"
              />
              <Upload className="h-4 w-4 text-muted-foreground" />
            </div>
            {preview && (
              <img
                src={preview}
                alt="preview"
                className="max-h-48 rounded-lg border border-border object-contain bg-background mx-auto"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Ação</Label>
            <Select value={action} onValueChange={(v) => setAction(v as DocOcrAction)}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ocr">OCR (todo o texto)</SelectItem>
                <SelectItem value="describe">Descrever (prompt customizado)</SelectItem>
                <SelectItem value="extract_table">Extrair tabelas (markdown)</SelectItem>
                <SelectItem value="extract_fields">Extrair campos (JSON)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {action === "describe" && (
            <div className="space-y-2">
              <Label htmlFor="ocr-prompt">Prompt customizado</Label>
              <Textarea
                id="ocr-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder="Descreva o conteúdo deste documento em detalhes."
                className="bg-background border-border"
              />
            </div>
          )}

          {action === "extract_fields" && (
            <div className="space-y-2">
              <Label>Campos a extrair</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={fieldDraft}
                  onChange={(e) => setFieldDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addField();
                    }
                  }}
                  placeholder="Ex.: nome do cliente, CNPJ, valor total"
                  className="bg-background border-border"
                />
                <Button type="button" variant="outline" size="sm" onClick={addField}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              {fields.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {fields.map((f) => (
                    <Badge key={f} variant="outline" className="gap-1 text-xs">
                      {f}
                      <button onClick={() => removeField(f)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          <Button
            onClick={handleRun}
            disabled={!file || loading}
            className="w-full bg-nexus-emerald hover:bg-nexus-emerald/90 text-[#050510]"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processando…
              </>
            ) : (
              "Executar OCR"
            )}
          </Button>

          {result && (
            <div className="space-y-2">
              <Label>Resultado</Label>
              <Textarea
                value={result}
                readOnly
                rows={10}
                className="bg-background border-border font-mono text-xs"
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                  <Copy className="h-3.5 w-3.5" />
                  Copiar
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  Baixar .txt
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
