import { Info, ChevronDown } from "lucide-react";
import { useState } from "react";

interface InfoHintProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function InfoHint({ title, children, defaultOpen = false }: InfoHintProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-primary/10 bg-primary/5 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-left hover:bg-primary/5 transition-colors"
        aria-expanded={open}
      >
        <Info className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-xs font-semibold text-foreground flex-1">{title}</p>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      <div
        className={`grid transition-all duration-200 ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <p className="px-3.5 pb-3 pt-0 text-xs text-muted-foreground leading-relaxed pl-9">
            {children}
          </p>
        </div>
      </div>
    </div>
  );
}
