import { Loader2 } from "lucide-react";

export function PageLoading() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh]" role="status" aria-label="Carregando página" aria-live="polite">
      <div
        className="flex flex-col items-center gap-3"
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
}
