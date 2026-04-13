import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { inpaintImage, imageToBase64, base64ToDataUrl } from "@/services/productMockupService";
import { FilePicker, ResultImage } from "./MockupShared";

export function InpaintTab() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [maskFile, setMaskFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [maskPreview, setMaskPreview] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState("");

  const handleInpaint = async () => {
    if (!imageFile || !maskFile || !prompt.trim()) { return toast.error("Imagem, máscara e prompt são obrigatórios"); }
    setLoading(true);
    try {
      const [imageBase64, maskBase64] = await Promise.all([imageToBase64(imageFile), imageToBase64(maskFile)]);
      const data = await inpaintImage({ imageBase64, maskBase64, prompt: prompt.trim() });
      setResultUrl(base64ToDataUrl(data.image_base64));
      toast.success(`Inpaint concluído (${data.model})`);
      if (data.note) toast.info(data.note);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FilePicker id="inpaint-image" label="Imagem original" onFile={(f) => { setImageFile(f); setImagePreview(URL.createObjectURL(f)); }} preview={imagePreview} />
        <FilePicker id="inpaint-mask" label="Máscara (PNG branco/preto)" onFile={(f) => { setMaskFile(f); setMaskPreview(URL.createObjectURL(f)); }} preview={maskPreview} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="inpaint-prompt">Prompt</Label>
        <Textarea id="inpaint-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder="Ex.: substituir o fundo por um céu azul" className="bg-background border-border" />
      </div>
      <Button onClick={handleInpaint} disabled={!imageFile || !maskFile || !prompt.trim() || loading} className="w-full bg-primary hover:bg-primary/90">
        {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Editando…</> : "Inpaint"}
      </Button>
      {resultUrl && <ResultImage src={resultUrl} label="Imagem-inpaint" />}
    </div>
  );
}
