import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { upscaleImage, imageToBase64, base64ToDataUrl } from "@/services/productMockupService";
import { FilePicker, ResultImage } from "./MockupShared";

export function UpscaleTab() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState("");

  const handleFile = (f: File) => { setFile(f); setPreview(URL.createObjectURL(f)); setResultUrl(""); };

  const handleUpscale = async () => {
    if (!file) return toast.error("Selecione uma imagem");
    setLoading(true);
    try {
      const base64 = await imageToBase64(file);
      const data = await upscaleImage(base64, 2);
      setResultUrl(base64ToDataUrl(data.image_base64));
      toast.success(`Upscale x${data.scale} concluído (${data.model})`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <FilePicker id="upscale-file" label="Imagem (até 10MB)" onFile={handleFile} preview={preview} />
      <Button onClick={handleUpscale} disabled={!file || loading} className="w-full bg-primary hover:bg-primary/90">
        {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Aumentando resolução…</> : "Upscale 2x"}
      </Button>
      {resultUrl && <ResultImage src={resultUrl} label="Imagem-upscale" />}
    </div>
  );
}
