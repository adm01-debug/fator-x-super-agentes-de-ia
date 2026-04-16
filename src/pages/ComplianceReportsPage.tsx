import { ShieldCheck, FileCheck2, Download, Calendar, Eye, BadgeCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/PageHeader";
import { toast } from "sonner";

type Framework = { id: string; name: string; coverage: number; lastReport: string; nextAudit: string; controls: number; passing: number };

const FRAMEWORKS: Framework[] = [
  { id: "soc2", name: "SOC 2 Type II", coverage: 94, lastReport: "01/04/2026", nextAudit: "01/10/2026", controls: 64, passing: 60 },
  { id: "iso27001", name: "ISO 27001:2022", coverage: 89, lastReport: "15/03/2026", nextAudit: "15/09/2026", controls: 114, passing: 101 },
  { id: "lgpd", name: "LGPD (Brasil)", coverage: 100, lastReport: "10/04/2026", nextAudit: "Contínuo", controls: 38, passing: 38 },
  { id: "gdpr", name: "GDPR (UE)", coverage: 96, lastReport: "08/04/2026", nextAudit: "Contínuo", controls: 47, passing: 45 },
  { id: "hipaa", name: "HIPAA (Saúde)", coverage: 78, lastReport: "20/03/2026", nextAudit: "20/06/2026", controls: 54, passing: 42 },
  { id: "pci", name: "PCI-DSS 4.0", coverage: 82, lastReport: "25/03/2026", nextAudit: "25/06/2026", controls: 78, passing: 64 },
];

export default function ComplianceReportsPage() {
  const generate = (name: string) => toast.success(`Gerando relatório ${name}`, { description: "PDF estará pronto em ~2 min" });

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Compliance Reports"
        description="Relatórios automáticos de conformidade para SOC 2, ISO 27001, LGPD, GDPR, HIPAA e PCI-DSS. Auditoria contínua."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Frameworks ativos</div><div className="text-2xl font-bold mt-1">{FRAMEWORKS.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Cobertura média</div><div className="text-2xl font-bold mt-1 text-nexus-green">{Math.round(FRAMEWORKS.reduce((s, f) => s + f.coverage, 0) / FRAMEWORKS.length)}%</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Controles totais</div><div className="text-2xl font-bold mt-1">{FRAMEWORKS.reduce((s, f) => s + f.controls, 0)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Passando</div><div className="text-2xl font-bold mt-1 text-nexus-green">{FRAMEWORKS.reduce((s, f) => s + f.passing, 0)}</div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {FRAMEWORKS.map((f) => {
          const failing = f.controls - f.passing;
          return (
            <Card key={f.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck className={`h-4 w-4 ${f.coverage >= 95 ? "text-nexus-green" : f.coverage >= 85 ? "text-nexus-amber" : "text-nexus-red"}`} />
                  {f.name}
                  {f.coverage === 100 && <BadgeCheck className="h-4 w-4 text-nexus-green ml-auto" />}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1.5"><span>Cobertura</span><span className="font-bold">{f.coverage}%</span></div>
                  <Progress value={f.coverage} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-nexus-green/10 rounded">
                    <div className="text-muted-foreground">Passando</div>
                    <div className="font-bold text-nexus-green">{f.passing}/{f.controls}</div>
                  </div>
                  <div className={`p-2 rounded ${failing > 0 ? "bg-nexus-red/10" : "bg-muted/30"}`}>
                    <div className="text-muted-foreground">Falhando</div>
                    <div className={`font-bold ${failing > 0 ? "text-nexus-red" : ""}`}>{failing}</div>
                  </div>
                </div>

                <div className="space-y-1 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" />Último: {f.lastReport}</div>
                  <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" />Próximo: {f.nextAudit}</div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="flex-1"><Eye className="h-3.5 w-3.5 mr-1" />Detalhes</Button>
                  <Button size="sm" className="flex-1" onClick={() => generate(f.name)}><Download className="h-3.5 w-3.5 mr-1" />PDF</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><FileCheck2 className="h-4 w-4" />Evidências automáticas coletadas</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {[
            { name: "Logs de acesso (90d)", count: "2.4M registros" },
            { name: "Backup automático", count: "diário · 30d retenção" },
            { name: "Encryption at rest", count: "AES-256 · 100% cobertura" },
            { name: "MFA enforced", count: "94% usuários" },
            { name: "Penetration test", count: "último: Q1 2026" },
            { name: "Vulnerability scans", count: "semanal · 0 high/critical" },
          ].map((e) => (
            <div key={e.name} className="p-3 bg-muted/30 rounded">
              <div className="font-medium">{e.name}</div>
              <div className="text-muted-foreground mt-0.5">{e.count}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
