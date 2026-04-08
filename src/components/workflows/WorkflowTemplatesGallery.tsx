import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layers, Clock, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { useWorkflowStore } from "@/stores/workflowStore";
import {
  TEMPLATE_CATEGORIES,
  getTemplatesByCategory,
  type WorkflowTemplate,
} from "@/config/workflow-templates";

export function WorkflowTemplatesGallery() {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [previewId, setPreviewId] = useState<string | null>(null);

  const setWorkflow = useWorkflowStore((s) => s.setWorkflow);

  const templates = getTemplatesByCategory(activeCategory);

  const handleUseTemplate = (template: WorkflowTemplate) => {
    setWorkflow(
      `template-${template.id}-${Date.now()}`,
      template.name,
      template.nodes,
      template.edges
    );
    toast.success(`Template "${template.name}" carregado no canvas`);
    setOpen(false);
    setPreviewId(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Layers className="h-3.5 w-3.5" />
          Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Galeria de Templates de Workflow
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Category filter */}
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATE_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  activeCategory === cat.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary/40 text-muted-foreground hover:bg-secondary/60'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Templates grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templates.map((tpl) => {
              const isPreviewing = previewId === tpl.id;
              const catCfg = TEMPLATE_CATEGORIES.find((c) => c.value === tpl.category);
              return (
                <div
                  key={tpl.id}
                  className={`p-4 rounded-lg border bg-secondary/20 transition-all cursor-pointer ${
                    isPreviewing ? 'border-primary ring-1 ring-primary/40' : 'border-border/30 hover:border-primary/40'
                  }`}
                  onClick={() => setPreviewId(isPreviewing ? null : tpl.id)}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-2xl">{tpl.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{tpl.name}</p>
                        <Badge
                          variant="outline"
                          className="text-[9px] mt-0.5"
                          style={{ borderColor: catCfg?.color + '80', color: catCfg?.color }}
                        >
                          {catCfg?.label ?? tpl.category}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                      <Clock className="h-2.5 w-2.5" />
                      {tpl.estimated_minutes}min
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3">
                    {tpl.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Layers className="h-2.5 w-2.5" />
                      {tpl.nodes.length} nós · {tpl.edges.length} conexões
                    </div>
                    <Button
                      size="sm"
                      variant={isPreviewing ? 'default' : 'outline'}
                      className="h-7 text-xs gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUseTemplate(tpl);
                      }}
                    >
                      {isPreviewing ? <Check className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                      Usar
                    </Button>
                  </div>

                  {/* Preview: node list when expanded */}
                  {isPreviewing && (
                    <div className="mt-3 pt-3 border-t border-border/30">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                        Etapas do workflow
                      </p>
                      <div className="space-y-1">
                        {tpl.nodes.map((n, i) => (
                          <div key={n.id} className="flex items-start gap-2 text-[11px]">
                            <span className="text-muted-foreground font-mono shrink-0 w-5">
                              {String(i + 1).padStart(2, '0')}
                            </span>
                            <div className="flex-1 min-w-0">
                              <span className="text-foreground font-medium">
                                {String(n.data.label ?? n.type)}
                              </span>
                              {n.data.description != null && (
                                <span className="text-muted-foreground"> — {String(n.data.description)}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {templates.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Layers className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-xs">Nenhum template nesta categoria</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
