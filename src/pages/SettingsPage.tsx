import { PageHeader } from "@/components/shared/PageHeader";
import { Settings as SettingsIcon, Palette, Globe, Bell, Key, Code } from "lucide-react";
import { motion } from "framer-motion";

const sections = [
  { icon: Palette, title: 'Aparência', desc: 'Tema, logo e personalização visual do workspace' },
  { icon: Globe, title: 'Geral', desc: 'Nome do workspace, idioma, timezone e região' },
  { icon: Bell, title: 'Notificações', desc: 'Alertas por email, Slack e configurações de frequência' },
  { icon: Key, title: 'API Keys', desc: 'Gerenciar chaves de API e tokens de acesso' },
  { icon: Code, title: 'Webhooks', desc: 'Configurar endpoints para eventos do sistema' },
  { icon: SettingsIcon, title: 'Avançado', desc: 'Limites, retenção de dados e configurações de segurança' },
];

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="Settings" description="Configure seu workspace e preferências da plataforma" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sections.map((s, i) => (
          <motion.div key={s.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="nexus-card cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <s.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
