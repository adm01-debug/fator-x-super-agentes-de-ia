import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}

export function LoadingSpinner({ size = "md", className, label = "Carregando..." }: LoadingSpinnerProps) {
  const sizes = { sm: "h-4 w-4 border-2", md: "h-6 w-6 border-2", lg: "h-10 w-10 border-3" };

  return (
    <div className={cn("flex items-center gap-2", className)} role="status" aria-label={label}>
      <div
        className={cn(
          "rounded-full border-primary/30 border-t-primary animate-spin",
          sizes[size]
        )}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function FullPageLoader({ label }: { label?: string }) {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[300px]">
      <div className="flex flex-col items-center gap-3">
        <LoadingSpinner size="lg" label={label} />
        {label && <p className="text-sm text-muted-foreground animate-pulse">{label}</p>}
      </div>
    </div>
  );
}
