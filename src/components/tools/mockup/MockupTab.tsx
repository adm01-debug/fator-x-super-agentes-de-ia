import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { generateMockup, imageToBase64, base64ToDataUrl, type MockupStep } from "@/services/productMockupService";
import { FilePicker, ResultImage } from "./MockupShared";

export function MockupTab() {
  const [productFile, setProductFile] = useState<File | null>(null);
  const [productPreview, setProductPreview] = useState("");
  const [productName, setProductName] = useState("");
  const [bgPrompt, setBgPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState("");
  const [steps, setSteps] = useState<MockupStep[]>([]);

  const handleProductFile = (f: File) => {
    setProductFile(f);
    setProductPreview(URL.createObjectURL(f));
    setResultUrl("");
    setSteps([]);
  };

  const handleGenerate = async () => {
    if (!productFile) { toast.error("Selecione uma imagem de produto"); return; }
    setLoading(true);
    try {
      const productImageBase64 = await imageToBase64(productFile);
      const data = await generateMockup({
        productImageBase64,
        productName: productName.trim() || undefined,
        backgroundPrompt: bgPrompt.trim() || undefined,
      });
      setResultUrl(base64ToDataUrl(data.product_clean));
      setSteps(data.steps);
      toast.success("Mockup gerado");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <FilePicker id="mockup-file" label="Imagem do produto" onFile={handleProductFile} preview={productPreview} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="mockup-name">Nome do produto (opcional)</Label>
          <Input id="mockup-name" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Ex.: caneca branca personalizada" className="bg-background border-border" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mockup-bg">Prompt de background (opcional)</Label>
          <Input id="mockup-bg" value={bgPrompt} onChange={(e) => setBgPrompt(e.target.value)} placeholder="Ex.: studio lighting, white gradient" className="bg-background border-border" />
        </div>
      </div>
      <Button onClick={handleGenerate} disabled={!productFile || loading} className="w-full bg-primary hover:bg-primary/90">
        {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processando…</> : "Gerar mockup"}
      </Button>
      {steps.length > 0 && (
        <div className="space-y-1 text-xs">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <Badge variant="outline" style={{
                borderColor: s.status === "ok" ? "#6BCB77" : s.status === "error" ? "#FF6B6B" : "#FFD93D",
                color: s.status === "ok" ? "#6BCB77" : s.status === "error" ? "#FF6B6B" : "#FFD93D",
              }}>
                {s.status}
              </Badge>
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
