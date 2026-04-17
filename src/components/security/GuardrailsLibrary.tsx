import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Library, Search, Star, Check, Plus, Loader2, Sparkles, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { GUARDRAIL_PRESETS, PRESET_CATEGORIES, type GuardrailPreset, type GuardrailPresetCategory } from "@/data/guardrailPresets";
import { listGuardrailPolicies, installGuardrailPreset } from "@/services/securityService";
import { getWorkspaceId } from "@/lib/agentService";

export function GuardrailsLibrary() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<GuardrailPresetCategory | "all">("all");
  const [installing, setInstalling] = useState<string | null>(null);

  const { data: installed = [] } = useQuery({
    queryKey: ["guardrail_policies"],
    queryFn: listGuardrailPolicies,
  });

  // Map: presetId -> installed?
  const installedPresetIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of installed as Array<{ config?: { preset_id?: string } }>) {
      const pid = p?.config?.preset_id;
      if (pid) ids.add(pid);
    }
    return ids;
  }, [installed]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return GUARDRAIL_PRESETS.filter(p => {
      if (activeCat !== "all" && p.category !== activeCat) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q)) ||
        (p.framework ?? []).some(f => f.toLowerCase().includes(q))
      );
    }).sort((a, b) => b.popularity - a.popularity);
  }, [search, activeCat]);

  const handleInstall = async (preset: GuardrailPreset) => {
    setInstalling(preset.id);
    try {
      const wsId = await getWorkspaceId();
      await installGuardrailPreset(preset, wsId);
      toast.success(`"${preset.name}" instalado no workspace`);
      qc.invalidateQueries({ queryKey: ["guardrail_policies"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao instalar");
    } finally {
      setInstalling(null);
    }
  };

  const handleInstallCategory = async (cat: GuardrailPresetCategory) => {
    const presets = GUARDRAIL_PRESETS.filter(p => p.category === cat && !installedPresetIds.has(p.id));
    if (presets.length === 0) {
      toast.info("Todos os presets dessa categoria já estão instalados");
      return;
    }
    try {
      const wsId = await getWorkspaceId();
      await Promise.all(presets.map(p => installGuardrailPreset(p, wsId)));
      toast.success(`${presets.length} guardrails instalados`);
      qc.invalidateQueries({ queryKey: ["guardrail_policies"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao instalar pacote");
    }
  };

  const totalInstalled = installedPresetIds.size;

  return (
    <div className="nexus-card p-6 space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Library className="h-5 w-5 text-primary" />
          <h3 className="font-heading font-semibold text-foreground">Biblioteca de Guardrails</h3>
          <Badge variant="outline" className="text-[10px]">
            {GUARDRAIL_PRESETS.length} presets · {totalInstalled} instalados
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Sparkles className="h-3 w-3" />
          Curado com base em OWASP LLM, NIST AI RMF, LGPD
        </div>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, framework (LGPD, OWASP), tag..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-secondary/30"
        />
      </div>

      <Tabs value={activeCat} onValueChange={(v) => setActiveCat(v as GuardrailPresetCategory | "all")}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
          <TabsTrigger value="all" className="text-xs data-[state=active]:bg-primary/10">
            Todos ({GUARDRAIL_PRESETS.length})
          </TabsTrigger>
          {PRESET_CATEGORIES.map(cat => {
            const count = GUARDRAIL_PRESETS.filter(p => p.category === cat.id).length;
            return (
              <TabsTrigger key={cat.id} value={cat.id} className="text-xs data-[state=active]:bg-primary/10 gap-1.5">
                <span>{cat.icon}</span>
                {cat.label} ({count})
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={activeCat} className="mt-4 space-y-3">
          {/* Bulk install button when category selected */}
          {activeCat !== "all" && (
            <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 text-xs">
                <Shield className="h-3.5 w-3.5 text-primary" />
                <span className="text-foreground">Instalar todos os presets desta categoria de uma vez</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7"
                onClick={() => handleInstallCategory(activeCat as GuardrailPresetCategory)}
              >
                <Plus className="h-3 w-3 mr-1" /> Instalar pacote
              </Button>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              Nenhum preset encontrado para "{search}"
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map(preset => {
                const isInstalled = installedPresetIds.has(preset.id);
                const meta = PRESET_CATEGORIES.find(c => c.id === preset.category)!;
                return (
                  <Card key={preset.id} className="p-4 bg-secondary/20 border-border/40 hover:border-primary/30 transition-colors flex flex-col">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg shrink-0">{meta.icon}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{preset.name}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-2.5 w-2.5 ${i < preset.popularity ? "fill-nexus-amber text-nexus-amber" : "text-muted-foreground/30"}`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[9px] uppercase tracking-wide shrink-0 ${
                          preset.severity === "block" ? "border-destructive/40 text-destructive" :
                          preset.severity === "warn" ? "border-nexus-amber/40 text-nexus-amber" :
                          "border-muted-foreground/40 text-muted-foreground"
                        }`}
                      >
                        {preset.severity}
                      </Badge>
                    </div>

                    <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">{preset.description}</p>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-[10px] text-muted-foreground/70 italic line-clamp-1 mb-3 cursor-help">
                          💡 {preset.rationale}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        {preset.rationale}
                      </TooltipContent>
                    </Tooltip>

                    <div className="flex flex-wrap gap-1 mb-3 mt-auto">
                      {(preset.framework ?? []).map(fw => (
                        <Badge key={fw} variant="outline" className="text-[9px] py-0 h-4 border-primary/30 text-primary">
                          {fw}
                        </Badge>
                      ))}
                      {preset.tags.slice(0, 2).map(tag => (
                        <Badge key={tag} variant="secondary" className="text-[9px] py-0 h-4">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    <Button
                      size="sm"
                      variant={isInstalled ? "outline" : "default"}
                      className={`w-full text-xs h-7 ${isInstalled ? "" : "nexus-gradient-bg text-primary-foreground"}`}
                      disabled={isInstalled || installing === preset.id}
                      onClick={() => handleInstall(preset)}
                    >
                      {installing === preset.id ? (
                        <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Instalando…</>
                      ) : isInstalled ? (
                        <><Check className="h-3 w-3 mr-1" /> Instalado</>
                      ) : (
                        <><Plus className="h-3 w-3 mr-1" /> Instalar</>
                      )}
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
