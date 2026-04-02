import { useState, useEffect } from "react";
import { Keyboard, X } from "lucide-react";

interface ShortcutEntry {
  keys: string[];
  description: string;
  category: string;
}

const SHORTCUTS: ShortcutEntry[] = [
  { keys: ["⌘", "K"], description: "Busca rápida / Command Palette", category: "Geral" },
  { keys: ["G"], description: "Ir para Dashboard", category: "Navegação" },
  { keys: ["A"], description: "Ir para Agentes", category: "Navegação" },
  { keys: ["⇧", "N"], description: "Criar novo agente", category: "Navegação" },
  { keys: ["Alt", "←"], description: "Voltar página anterior", category: "Navegação" },
  { keys: ["?"], description: "Mostrar atalhos de teclado", category: "Geral" },
  { keys: ["Esc"], description: "Fechar modal / dialog", category: "Geral" },
];

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  const categories = [...new Set(SHORTCUTS.map((s) => s.category))];

  return (
    {open && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-xl border border-border bg-background shadow-2xl"
            role="dialog"
            aria-label="Atalhos de teclado"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-heading font-semibold text-foreground">Atalhos de teclado</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
              {categories.map((cat) => (
                <div key={cat}>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2">{cat}</p>
                  <div className="space-y-1.5">
                    {SHORTCUTS.filter((s) => s.category === cat).map((s) => (
                      <div key={s.description} className="flex items-center justify-between py-1.5">
                        <span className="text-xs text-foreground">{s.description}</span>
                        <div className="flex items-center gap-1">
                          {s.keys.map((k) => (
                            <kbd
                              key={k}
                              className="inline-flex h-6 min-w-[24px] items-center justify-center rounded border border-border bg-secondary/50 px-1.5 text-[10px] font-mono text-muted-foreground"
                            >
                              {k}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-border/50">
              <p className="text-[10px] text-muted-foreground text-center">
                Pressione <kbd className="inline-flex h-5 items-center rounded border border-border bg-secondary/50 px-1 text-[10px] font-mono">?</kbd> para abrir/fechar
              </p>
            </div>
          </div>
        </>
      )}
    
  );
}
