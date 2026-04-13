import { Upload, Download } from "lucide-react";
import { Upload, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function FilePicker({
  id,
  label,
  onFile,
  preview,
}: {
  id: string;
  label: string;
  onFile: (f: File) => void;
  preview?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
          className="flex-1 text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-background file:text-foreground hover:file:bg-muted"
        />
        <Upload className="h-4 w-4 text-muted-foreground" />
      </div>
      {preview && (
        <img
          src={preview}
          alt={label}
          className="max-h-32 rounded-lg border border-border object-contain bg-background"
        />
      )}
    </div>
  );
}

export function ResultImage({ src, label }: { src: string; label: string }) {
  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = src;
    a.download = `${label}-${Date.now()}.png`;
    a.click();
  };
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <img
        src={src}
        alt={label}
        className="max-h-80 rounded-lg border border-border object-contain bg-background mx-auto"
      />
      <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
        <Download className="h-3.5 w-3.5" />
        Baixar PNG
      </Button>
    </div>
  );
}
