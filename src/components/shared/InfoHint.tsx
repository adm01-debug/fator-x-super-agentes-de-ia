import { Info } from "lucide-react";

interface InfoHintProps {
  title: string;
  children: React.ReactNode;
}

export function InfoHint({ title, children }: InfoHintProps) {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start gap-2.5">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
        <div>
          <p className="text-xs font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{children}</p>
        </div>
      </div>
    </div>
  );
}
