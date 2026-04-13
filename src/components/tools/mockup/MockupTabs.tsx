import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Maximize2, Eraser, Scissors, Download, Upload, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import {
  generateMockup, upscaleImage, inpaintImage, segmentImage,
  imageToBase64, base64ToDataUrl,
  type MockupStep, type SegmentEntry,
} from "@/services/productMockupService";

function FilePicker({ id, label, onFile, preview }: {
  id: string; label: string; onFile: (f: File) => void; preview?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input id={id} type="file" accept="image/*"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
          className="flex-1 text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-background file:text-foreground hover:file:bg-muted" />
        <Upload className="h-4 w-4 text-muted-foreground" />
      </div>
      {preview && <img src={preview} alt={label} className="max-h-32 rounded-lg border border-border object-contain bg-background" />}
    </div>
  );
}

function ResultImage({ src, label }: { src: string; label: string }) {
  const handleDownload = () => { const a = document.createElement("a"); a.href = src; a.download = `${label}-${Date.now()}.png`; a.click(); };
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <img src={src} alt={label} className="max-h-80 rounded-lg border border-border object-contain bg-background mx-auto" />
      <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5"><Download className="h-3.5 w-3.5" />Baixar PNG</Button>
    </div>
  );
}

export function MockupTab() {
  const [productFile, setProductFile] = useState<File | null>(null);
  const [productPreview, setProductPreview] = useState("");
  const [productName, setProductName] = useState("");
  const [bgPrompt, setBgPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState("");
  const [steps, setSteps] = useState<MockupStep[]>([]);

  const handleGenerate = async () => {
    if (!productFile) { toast.error("Selecione uma imagem de produto"); return; }
    setLoading(true);
    try {
      const productImageBase64 = await imageToBase64(productFile);
      const data = await generateMockup({ productImageBase64, productName: productName.trim() || undefined, backgroundPrompt: bgPrompt.trim() || undefined });
      setResultUrl(base64ToDataUrl(data.product_clean));
      setSteps(data.steps);
      toast.success("Mockup gerado");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erro inesperado"); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <FilePicker id="mockup-file" label="Imagem do produto" onFile={(f) => { setProductFile(f); setProductPreview(URL.createObjectURL(f)); setResultUrl(""); setSteps([]); }} preview={productPreview} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2"><Label htmlFor="mockup-name">Nome do produto (opcional)</Label><Input id="mockup-name" value={productName} onChange={e => setProductName(e.target.value)} placeholder="Ex.: caneca branca personalizada" className="bg-background border-border" /></div>
        <div className="space-y-2"><Label htmlFor="mockup-bg">Prompt de background (opcional)</Label><Input id="mockup-bg" value={bgPrompt} onChange={e => setBgPrompt(e.target.value)} placeholder="Ex.: studio lighting, white gradient" className="bg-background border-border" /></div>
      </div>
      <Button onClick={handleGenerate} disabled={!productFile || loading} className="w-full bg-primary hover:bg-primary/90">
        {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processando…</> : "Gerar mockup"}
      </Button>
      {steps.length > 0 && (
        <div className="space-y-1 text-xs">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <Badge variant="outline" style={{ borderColor: s.status === "ok" ? "#6BCB77" : s.status === "error" ? "#FF6B6B" : "#FFD93D", color: s.status === "ok" ? "#6BCB77" : s.status === "error" ? "#FF6B6B" : "#FFD93D" }}>{s.status}</Badge>
              <span className="text-muted-foreground">{s.step}</span>
              {s.details && <span className="text-[10px] text-muted-foreground">— {s.details}</span>}
            </div>
          ))}
        </div>
      )}
      {resultUrl && <ResultImage src={resultUrl} label="Mockup-final" />}
    </div>
  );
}

export function UpscaleTab() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState("");

  const handleUpscale = async () => {
    if (!file) return toast.error("Selecione uma imagem");
    setLoading(true);
    try {
      const base64 = await imageToBase64(file);
      const data = await upscaleImage(base64, 2);
      setResultUrl(base64ToDataUrl(data.image_base64));
      toast.success(`Upscale x${data.scale} concluído (${data.model})`);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erro inesperado"); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <FilePicker id="upscale-file" label="Imagem (até 10MB)" onFile={f => { setFile(f); setPreview(URL.createObjectURL(f)); setResultUrl(""); }} preview={preview} />
      <Button onClick={handleUpscale} disabled={!file || loading} className="w-full bg-primary hover:bg-primary/90">
        {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Aumentando resolução…</> : "Upscale 2x"}
      </Button>
      {resultUrl && <ResultImage src={resultUrl} label="Imagem-upscale" />}
    </div>
  );
}

export function InpaintTab() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [maskFile, setMaskFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [maskPreview, setMaskPreview] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState("");

  const handleInpaint = async () => {
    if (!imageFile || !maskFile || !prompt.trim()) return toast.error("Imagem, máscara e prompt são obrigatórios");
    setLoading(true);
    try {
      const [imageBase64, maskBase64] = await Promise.all([imageToBase64(imageFile), imageToBase64(maskFile)]);
      const data = await inpaintImage({ imageBase64, maskBase64, prompt: prompt.trim() });
      setResultUrl(base64ToDataUrl(data.image_base64));
      toast.success(`Inpaint concluído (${data.model})`);
      if (data.note) toast.info(data.note);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erro inesperado"); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FilePicker id="inpaint-image" label="Imagem original" onFile={f => { setImageFile(f); setImagePreview(URL.createObjectURL(f)); }} preview={imagePreview} />
        <FilePicker id="inpaint-mask" label="Máscara (PNG branco/preto)" onFile={f => { setMaskFile(f); setMaskPreview(URL.createObjectURL(f)); }} preview={maskPreview} />
      </div>
      <div className="space-y-2"><Label htmlFor="inpaint-prompt">Prompt</Label><Textarea id="inpaint-prompt" value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} placeholder="Ex.: substituir o fundo por um céu azul" className="bg-background border-border" /></div>
      <Button onClick={handleInpaint} disabled={!imageFile || !maskFile || !prompt.trim() || loading} className="w-full bg-primary hover:bg-primary/90">
        {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Editando…</> : "Inpaint"}
      </Button>
      {resultUrl && <ResultImage src={resultUrl} label="Imagem-inpaint" />}
    </div>
  );
}

export function SegmentTab() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [segments, setSegments] = useState<SegmentEntry[]>([]);

  const handleSegment = async () => {
    if (!file) return toast.error("Selecione uma imagem");
    setLoading(true);
    try {
      const base64 = await imageToBase64(file);
      const data = await segmentImage(base64);
      setSegments(data.segments);
      toast.success(`${data.segments.length} segmentos detectados (${data.model})`);
      if (data.note) toast.info(data.note);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erro inesperado"); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <FilePicker id="segment-file" label="Imagem para segmentar" onFile={f => { setFile(f); setPreview(URL.createObjectURL(f)); setSegments([]); }} preview={preview} />
      <Button onClick={handleSegment} disabled={!file || loading} className="w-full bg-primary hover:bg-primary/90">
        {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Analisando…</> : "Segmentar"}
      </Button>
      {segments.length > 0 && (
        <div className="space-y-2">
          <Label>Objetos detectados</Label>
          <div className="bg-background rounded-lg border border-border p-3 space-y-1">
            {segments.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-foreground">{s.label}</span>
                <Badge variant="outline" className="text-[10px]">{(s.score * 100).toFixed(1)}%</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
