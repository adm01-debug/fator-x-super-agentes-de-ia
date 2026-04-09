import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LayoutTemplate, ArrowRight } from 'lucide-react';

import { BUILTIN_TEMPLATES, type AutomationTemplate } from '@/services/automationTemplateService';
import { listAutomationTemplates } from '@/services';

const DIFFICULTY_COLORS: Record<string, string> = { beginner: 'bg-nexus-emerald/20 text-nexus-emerald', intermediate: 'bg-nexus-amber/20 text-nexus-amber', advanced: 'bg-destructive/20 text-destructive' };

export function AutomationTemplatesPanel() {
  const [dbTemplates, setDbTemplates] = useState<AutomationTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAutomationTemplates()
      .then(setDbTemplates)
      .catch(() => { /* fallback to builtins */ })
      .finally(() => setLoading(false));
  }, []);

  const templates = dbTemplates.length > 0 ? dbTemplates : BUILTIN_TEMPLATES;

  if (loading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <LayoutTemplate size={48} className="mx-auto mb-4 animate-pulse opacity-30" />
        <p>Carregando templates...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Templates de Automação — Promo Brindes</h3>
        <Badge variant="outline" className="border-border">{templates.length} disponíveis</Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((tpl) => (
          <Card key={tpl.slug} className="bg-card border-border hover:border-primary/50 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{tpl.icon}</span>
                <div>
                  <p className="font-semibold text-sm">{tpl.name}</p>
                  <Badge className={DIFFICULTY_COLORS[tpl.difficulty] ?? ''} >{tpl.difficulty}</Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{tpl.description}</p>
              <div className="flex flex-wrap gap-1 mb-3">
                {tpl.required_integrations.map((i) => (
                  <Badge key={i} variant="outline" className="text-[10px] border-border">{i}</Badge>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{tpl.steps.length} etapas</span>
                <span>~{tpl.estimated_setup_minutes}min setup</span>
              </div>
              <div className="mt-3 text-xs text-muted-foreground border-t border-border pt-3">
                <p className="font-medium text-muted-foreground mb-1">Fluxo:</p>
                {tpl.steps.map((step, i) => (
                  <span key={i} className="inline-flex items-center">
                    {i > 0 && <ArrowRight size={10} className="mx-1 text-muted-foreground/50" />}
                    <span className={step.type === 'trigger' ? 'text-primary' : step.type === 'notification' ? 'text-nexus-emerald' : 'text-muted-foreground'}>{step.name}</span>
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
