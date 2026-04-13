import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { segmentImage, imageToBase64, type SegmentEntry } from "@/services/productMockupService";
import { FilePicker } from "./MockupShared";

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
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <FilePicker id="segment-file" label="Imagem para segmentar" onFile={(f) => { setFile(f); setPreview(URL.createObjectURL(f)); setSegments([]); }} preview={preview} />
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
