import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

export default function OraclePage() {
  return (
    <div className="p-6 max-w-[1000px] mx-auto space-y-6">
      <PageHeader title="🔮 Oráculo" description="Multi-LLM Council Engine" />
      <div className="nexus-card flex flex-col items-center text-center py-16 space-y-4">
        <Sparkles className="h-16 w-16 text-purple-400/40" />
        <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">Em desenvolvimento</Badge>
        <h2 className="text-lg font-heading font-semibold text-foreground">Multi-LLM Council Engine</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          O Oráculo consultará múltiplas IAs em paralelo, fará peer-review anônimo entre elas 
          e sintetizará a melhor resposta com score de consenso e confiança.
        </p>
      </div>
    </div>
  );
}
