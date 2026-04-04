import { PageHeader } from "@/components/shared/PageHeader";
import { InfoHint } from "@/components/shared/InfoHint";
import { SecurityPosture } from "@/components/security/SecurityPosture";
import { ComplianceFrameworks } from "@/components/security/ComplianceFrameworks";
import { GuardrailPolicies } from "@/components/security/GuardrailPolicies";
import { SessionManagement } from "@/components/security/SessionManagement";
import { RateLimitingPanel } from "@/components/security/RateLimitingPanel";
import { AuditLogSection } from "@/components/security/AuditLogSection";

export default function SecurityPage() {
  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Security & Guardrails"
        description="Segurança, compliance e governança dos agentes de IA"
      />

      <InfoHint title="Segurança em camadas">
        A segurança opera em múltiplas camadas: autenticação, criptografia, mascaramento de dados, detecção de jailbreak, rate limiting, audit logging e guardrails customizados por agente.
      </InfoHint>

      <SecurityPosture />
      <ComplianceFrameworks />
      <GuardrailPolicies />
      <SessionManagement />
      <RateLimitingPanel />
      <AuditLogSection />
    </div>
  );
}
