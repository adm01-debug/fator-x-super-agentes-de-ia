/**
 * Nexus Agents Studio — Image Analysis Dialog
 *
 * Reusable standalone dialog that wraps the image-analysis Edge Function.
 * Three modes: Analyze (vision LLM), Classify, NSFW Check.
 *
 * Used initially in ToolsPage. Designed to be dropped into AgentBuilder
 * Tools tab and chat composer in a future iteration.
 */
import { useState } from "react";
import { Loader2, Eye, ShieldCheck, Tag, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import {
  analyzeImage,
  classifyImage,
  checkNsfw,
  type ClassifyEntry,
} from "@/services/visionService";
import { imageToBase64 } from "@/services/productMockupService";

type Mode = "analyze" | "classify" | "nsfw";

export function ImageAnalysisDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [mode, setMode] = useState<Mode>("analyze");
  const [prompt, setPrompt] = useState("Descreva esta imagem em detalhes.");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [classes, setClasses] = useState<ClassifyEntry[]>([]);
  const [nsfwFlag, setNsfwFlag] = useState<boolean | null>(null);

  const reset = () => {
    setFile(null);
    setPreview("");
    setAnalysis("");
    setClasses([]);
    setNsfwFlag(null);
    setLoading(false);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : "");
    setAnalysis("");
    setClasses([]);
    setNsfwFlag(null);
  };

  const handleRun = async () => {
    if (!file) {
      toast.error("Selecione uma imagem");
      return;
    }
    setLoading(true);
    try {
      const imageBase64 = await imageToBase64(file);
      if (mode === "analyze") {
        const data = await analyzeImage({ imageBase64, prompt });
        setAnalysis(data.analysis || "(sem resposta)");
        toast.success("Análise concluída");
      } else if (mode === "classify") {
        const data = await classifyImage({ imageBase64 });
        setClasses(data);
        toast.success(`${data.length} classes detectadas`);
      } else {
        const data = await checkNsfw({ imageBase64 });
        setNsfwFlag(data.is_nsfw);
        setClasses(data.scores);
        toast.success(`NSFW: ${data.is_nsfw ? "SIM" : "NÃO"}`);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
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
          <Eye className="h-3.5 w-3.5" />
          Análise de imagem
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-nexus-purple" />
            Análise de imagem
          </DialogTitle>
          <DialogDescription>
            Vision LLM, classificação e verificação NSFW via HuggingFace
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vision-file">Imagem</Label>
            <div className="flex items-center gap-2">
              <input
                id="vision-file"
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
            <Label>Modo</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="analyze">
                  <div className="flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5" /> Analyze (Vision LLM)
                  </div>
                </SelectItem>
                <SelectItem value="classify">
                  <div className="flex items-center gap-2">
                    <Tag className="h-3.5 w-3.5" /> Classify (ViT)
                  </div>
                </SelectItem>
                <SelectItem value="nsfw">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5" /> NSFW Check
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "analyze" && (
            <div className="space-y-2">
              <Label htmlFor="vision-prompt">Prompt</Label>
              <Textarea
                id="vision-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                className="bg-background border-border"
              />
            </div>
          )}

          <Button
            onClick={handleRun}
            disabled={!file || loading}
            className="w-full bg-nexus-purple hover:bg-nexus-purple/90"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Analisando…
              </>
            ) : (
              "Executar"
            )}
          </Button>

          {analysis && (
            <div className="space-y-2">
              <Label>Resultado</Label>
              <div className="bg-background rounded-lg border border-border p-3 text-xs text-foreground whitespace-pre-wrap max-h-64 overflow-y-auto">
                {analysis}
              </div>
            </div>
          )}

          {nsfwFlag !== null && (
            <div
              className="rounded-lg border p-3 flex items-center gap-3"
              style={{
                borderColor: nsfwFlag ? "#FF6B6B" : "#6BCB77",
                backgroundColor: nsfwFlag ? "#FF6B6B10" : "#6BCB7710",
              }}
            >
              <ShieldCheck
                className="h-5 w-5"
                style={{ color: nsfwFlag ? "#FF6B6B" : "#6BCB77" }}
              />
              <span className="text-sm font-medium text-foreground">
                {nsfwFlag ? "Conteúdo NSFW detectado" : "Conteúdo seguro"}
              </span>
            </div>
          )}

          {classes.length > 0 && (
            <div className="space-y-2">
              <Label>Classes / scores</Label>
              <div className="bg-background rounded-lg border border-border p-3 space-y-1 max-h-48 overflow-y-auto">
                {classes.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-foreground">{c.label}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {(c.score * 100).toFixed(1)}%
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
