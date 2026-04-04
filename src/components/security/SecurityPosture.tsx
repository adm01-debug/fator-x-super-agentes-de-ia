import { Lock, Key, Eye, UserX, ShieldAlert, ShieldCheck, AlertTriangle, CheckCircle } from "lucide-react";

const securityChecks = [
  { icon: Lock, title: 'Criptografia em trânsito', desc: 'TLS 1.3 em todas as comunicações', status: 'pass' },
  { icon: Key, title: 'Gestão de API Keys', desc: 'Chaves armazenadas com criptografia', status: 'pass' },
  { icon: Eye, title: 'Mascaramento de PII', desc: 'Dados pessoais detectados e mascarados', status: 'pass' },
  { icon: UserX, title: 'Anti-Jailbreak', desc: 'Detecção de prompt injection', status: 'pass' },
  { icon: ShieldAlert, title: 'Rate Limiting', desc: 'Limites de requisição por agente', status: 'warn' },
  { icon: ShieldCheck, title: 'Audit Logging', desc: 'Todas as ações registradas com trace', status: 'pass' },
];

export function SecurityPosture() {
  return (
    <div className="nexus-card">
      <h3 className="text-sm font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" /> Postura de Segurança
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {securityChecks.map((check) => (
          <div key={check.title}
            className="p-3 rounded-lg bg-secondary/30 border border-border/30 flex items-start gap-3"
          >
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${check.status === 'pass' ? 'bg-nexus-emerald/10' : 'bg-nexus-amber/10'}`}>
              <check.icon className={`h-4 w-4 ${check.status === 'pass' ? 'text-nexus-emerald' : 'text-nexus-amber'}`} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium text-foreground">{check.title}</p>
                {check.status === 'pass' ? <CheckCircle className="h-3 w-3 text-nexus-emerald" /> : <AlertTriangle className="h-3 w-3 text-nexus-amber" />}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">{check.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
