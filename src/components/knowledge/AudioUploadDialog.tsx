/**
 * Nexus Agents Studio — Audio Upload Dialog
 * Lets the user upload an audio file (≤25MB) and transcribe it
 * via the audio-transcribe Edge Function (Whisper Large v3 Turbo).
 *
 * The transcription can be copied or downloaded as .txt — and is
 * the first step toward ingesting audio sources into a RAG knowledge
 * base in a future iteration.
 */
import { useState } from "react";
import { Loader2, Mic, Copy, Download, Upload } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { transcribeAudio, fileToBase64 } from "@/services/audioService";

const MAX_BYTES = 25 * 1024 * 1024;

export function AudioUploadDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState("pt");
  const [action, setAction] = useState<"transcribe" | "translate">("transcribe");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");

  const reset = () => {
    setFile(null);
    setResult("");
    setLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > MAX_BYTES) {
      toast.error("Arquivo excede 25MB. Whisper aceita até 25MB por chamada.");
      return;
    }
    setFile(f);
    setResult("");
  };

  const handleTranscribe = async () => {
    if (!file) {
      toast.error("Selecione um arquivo de áudio");
      return;
    }
    setLoading(true);
    try {
      const audioBase64 = await fileToBase64(file);
      const data = await transcribeAudio({
        audioBase64,
        language,
        action,
        format: "text",
      });
      setResult(data.text);
      toast.success(
        `Transcrição concluída (${(data.audio_size_bytes / 1024).toFixed(1)} KB · ${data.model})`,
      );
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
    a.download = `transcricao-${Date.now()}.txt`;
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
          <Mic className="h-3.5 w-3.5" />
          Transcrever áudio
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#111122] border-[#222244] max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-[#4D96FF]" />
            Transcrever áudio
          </DialogTitle>
          <DialogDescription>
            Whisper Large v3 Turbo · até 25MB · pt/en/es/etc.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="audio-file">Arquivo de áudio</Label>
            <div className="flex items-center gap-2">
              <input
                id="audio-file"
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="flex-1 text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-[#0a0a1a] file:text-foreground hover:file:bg-[#222244]"
              />
              <Upload className="h-4 w-4 text-muted-foreground" />
            </div>
            {file && (
              <p className="text-[11px] text-muted-foreground">
                {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Idioma</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="bg-[#0a0a1a] border-[#222244]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt">Português</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ação</Label>
              <Select value={action} onValueChange={(v) => setAction(v as "transcribe" | "translate")}>
                <SelectTrigger className="bg-[#0a0a1a] border-[#222244]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transcribe">Transcrever</SelectItem>
                  <SelectItem value="translate">Traduzir p/ inglês</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleTranscribe}
            disabled={!file || loading}
            className="w-full bg-[#4D96FF] hover:bg-[#4D96FF]/90"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Transcrevendo…
              </>
            ) : (
              "Transcrever"
            )}
          </Button>

          {result && (
            <div className="space-y-2">
              <Label>Resultado</Label>
              <Textarea
                value={result}
                readOnly
                rows={8}
                className="bg-[#0a0a1a] border-[#222244] font-mono text-xs"
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
