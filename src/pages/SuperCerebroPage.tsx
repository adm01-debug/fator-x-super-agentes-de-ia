import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { InfoHint } from "@/components/shared/InfoHint";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Brain, Search, Network, BookOpen,
  Activity, Users, FlaskConical, Zap, Clock, GitMerge, TrendingDown
} from "lucide-react";
import { OverviewTab } from "@/components/super-cerebro/OverviewTab";
import { SearchTab } from "@/components/super-cerebro/SearchTab";
import { KnowledgeAreasTab } from "@/components/super-cerebro/KnowledgeAreasTab";
import { KnowledgeGraphTab } from "@/components/super-cerebro/KnowledgeGraphTab";
import { KnowledgeHealthTab } from "@/components/super-cerebro/KnowledgeHealthTab";
import { AutoExtractionTab } from "@/components/super-cerebro/AutoExtractionTab";
import { ExpertDiscoveryTab } from "@/components/super-cerebro/ExpertDiscoveryTab";
import { BrainSandboxTab } from "@/components/super-cerebro/BrainSandboxTab";
import { TemporalGraphTab } from "@/components/super-cerebro/TemporalGraphTab";
import { EntityResolutionTab } from "@/components/super-cerebro/EntityResolutionTab";
import { DecayDetectionTab } from "@/components/super-cerebro/DecayDetectionTab";

export default function SuperCerebroPage() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader title="🧠 Super Cérebro" description="Enterprise Memory Layer — Memória centralizada da empresa" gradient={false} />

      <InfoHint title="O que é o Super Cérebro?">
        O Super Cérebro é a camada de memória empresarial que conecta todos os agentes. Ele armazena conhecimento institucional, processos, dados de clientes e fornecedores — permitindo que qualquer agente acesse informações da empresa em tempo real.
      </InfoHint>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary/50 border border-border/50 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="overview" className="text-xs gap-1.5"><Brain className="h-3.5 w-3.5" /> Visão Geral</TabsTrigger>
          <TabsTrigger value="search" className="text-xs gap-1.5"><Search className="h-3.5 w-3.5" /> Consultar</TabsTrigger>
          <TabsTrigger value="knowledge" className="text-xs gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Áreas</TabsTrigger>
          <TabsTrigger value="graph" className="text-xs gap-1.5"><Network className="h-3.5 w-3.5" /> Grafo</TabsTrigger>
          <TabsTrigger value="health" className="text-xs gap-1.5"><Activity className="h-3.5 w-3.5" /> Saúde</TabsTrigger>
          <TabsTrigger value="extract" className="text-xs gap-1.5"><Zap className="h-3.5 w-3.5" /> Extração</TabsTrigger>
          <TabsTrigger value="experts" className="text-xs gap-1.5"><Users className="h-3.5 w-3.5" /> Especialistas</TabsTrigger>
          <TabsTrigger value="sandbox" className="text-xs gap-1.5"><FlaskConical className="h-3.5 w-3.5" /> Sandbox</TabsTrigger>
          <TabsTrigger value="temporal" className="text-xs gap-1.5"><Clock className="h-3.5 w-3.5" /> Temporal</TabsTrigger>
          <TabsTrigger value="resolution" className="text-xs gap-1.5"><GitMerge className="h-3.5 w-3.5" /> Resolução</TabsTrigger>
          <TabsTrigger value="decay" className="text-xs gap-1.5"><TrendingDown className="h-3.5 w-3.5" /> Decay</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4"><OverviewTab /></TabsContent>
        <TabsContent value="search" className="mt-4"><SearchTab /></TabsContent>
        <TabsContent value="knowledge" className="mt-4"><KnowledgeAreasTab /></TabsContent>
        <TabsContent value="graph" className="mt-4"><KnowledgeGraphTab /></TabsContent>
        <TabsContent value="health" className="mt-4"><KnowledgeHealthTab /></TabsContent>
        <TabsContent value="extract" className="mt-4"><AutoExtractionTab /></TabsContent>
        <TabsContent value="experts" className="mt-4"><ExpertDiscoveryTab /></TabsContent>
        <TabsContent value="sandbox" className="mt-4"><BrainSandboxTab /></TabsContent>
        <TabsContent value="temporal" className="mt-4"><TemporalGraphTab /></TabsContent>
        <TabsContent value="resolution" className="mt-4"><EntityResolutionTab /></TabsContent>
        <TabsContent value="decay" className="mt-4"><DecayDetectionTab /></TabsContent>
      </Tabs>
    </div>
  );
}
