import { Brain, Shield, Zap } from 'lucide-react';
import { FatorXLogo } from '@/components/shared/FatorXLogo';

function FeaturePill({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5 text-primary" /><span>{text}</span>
    </div>
  );
}

export function MeshGradient() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute w-[500px] h-[500px] rounded-full opacity-20" style={{ background: 'hsl(var(--primary))', top: '10%', left: '5%', animation: 'meshBlob1 12s ease-in-out infinite' }} />
      <div className="absolute w-[400px] h-[400px] rounded-full opacity-15" style={{ background: 'hsl(var(--accent))', top: '50%', left: '30%', animation: 'meshBlob2 15s ease-in-out infinite' }} />
      <div className="absolute w-[350px] h-[350px] rounded-full opacity-10" style={{ background: 'hsl(var(--nexus-purple))', top: '20%', right: '0%', animation: 'meshBlob3 18s ease-in-out infinite' }} />
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} className="absolute rounded-full bg-primary/30" style={{ width: `${2 + Math.random() * 3}px`, height: `${2 + Math.random() * 3}px`, top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`, animation: `floatParticle ${8 + Math.random() * 12}s ease-in-out infinite`, animationDelay: `${Math.random() * -20}s` }} />
      ))}
    </div>
  );
}

export function GridBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `linear-gradient(hsl(var(--primary) / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary) / 0.3) 1px, transparent 1px)`, backgroundSize: '60px 60px' }} />
    </div>
  );
}

export function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export function AuthBrandingPanel() {
  return (
    <div className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-12 xl:p-16">
      <MeshGradient />
      <div className="animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
            <FatorXLogo size={22} className="text-primary-foreground" />
          </div>
          <span className="text-xl font-heading font-bold text-foreground tracking-tight">Fator X</span>
        </div>
      </div>
      <div className="space-y-8 animate-fade-in" style={{ animationDelay: '100ms' }}>
        <div className="space-y-4 max-w-lg">
          <h2 className="text-4xl xl:text-5xl font-heading font-bold text-foreground leading-[1.1] tracking-tight">
            Construa agentes de IA{' '}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">extraordinários</span>
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed max-w-md">Orquestre, monitore e escale seus agentes inteligentes com a plataforma mais completa do mercado.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <FeaturePill icon={Brain} text="Multi-modelo (GPT, Gemini, Claude)" />
          <FeaturePill icon={Shield} text="Guardrails & Observabilidade" />
          <FeaturePill icon={Zap} text="Deploy em 1 clique" />
        </div>
        <div className="mt-6 rounded-xl border border-border/30 bg-card/30 backdrop-blur-sm p-5 max-w-md">
          <p className="text-sm text-muted-foreground italic leading-relaxed">"Reduzimos 60% do tempo de atendimento ao cliente com agentes criados no Fator X. A plataforma é intuitiva e segura."</p>
          <div className="flex items-center gap-3 mt-3">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">MC</div>
            <div><p className="text-xs font-medium text-foreground">Marcos Costa</p><p className="text-[11px] text-muted-foreground">Head de Operações, TechBR</p></div>
          </div>
        </div>
      </div>
      <div className="animate-fade-in" style={{ animationDelay: '200ms' }}>
        <p className="text-xs text-muted-foreground/60">🔒 Criptografia ponta-a-ponta · SOC 2 · LGPD Compliant</p>
      </div>
    </div>
  );
}
