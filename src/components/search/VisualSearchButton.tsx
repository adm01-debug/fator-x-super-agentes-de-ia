import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { fileToDataUrl, visualSearch, type VisualSearchResponse } from "@/services/searchService";

interface VisualSearchButtonProps {
  knowledgeBaseId?: string | null;
  topK?: number;
  hint?: string;
  onResults?: (response: VisualSearchResponse) => void;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  label?: string;
}

/**
 * Upload an image and run a visual semantic search against the
 * knowledge base. Image goes to Lovable AI (Gemini multimodal),
 * description is forwarded to semantic-search.
 */
export function VisualSearchButton({
  knowledgeBaseId,
  topK = 10,
  hint,
  onResults,
  variant = "outline",
  size = "default",
  label = "Buscar por imagem",
}: VisualSearchButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Imagem muito grande", { description: "Limite: 8 MB" });
      return;
    }

    setLoading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const response = await visualSearch(dataUrl, {
        hint,
        knowledgeBaseId: knowledgeBaseId ?? null,
        topK,
      });
      toast.success(`${response.total} resultado(s) encontrado(s)`, {
        description: response.description.slice(0, 120),
      });
      onResults?.(response);
    } catch (e) {
      toast.error("Falha na busca visual", {
        description: e instanceof Error ? e.message : "Erro desconhecido",
      });
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <Button
        variant={variant}
        size={size}
        disabled={loading}
        onClick={() => inputRef.current?.click()}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Camera className="h-4 w-4" />
        )}
        {size !== "icon" && <span className="ml-2">{label}</span>}
      </Button>
    </>
  );
}
