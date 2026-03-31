import { useState } from 'react';
import { SectionTitle, InputField, SelectField } from '../ui';
import { NexusBadge } from '../ui/NexusBadge';
import { EmptyState } from '../ui/EmptyState';
import { toast } from 'sonner';

interface Member {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'editor' | 'viewer' | 'operator';
  status: 'active' | 'invited';
}

const roleOptions = [
  { value: 'admin', label: 'Admin — Acesso total' },
  { value: 'editor', label: 'Editor — Criar e editar agentes' },
  { value: 'viewer', label: 'Viewer — Somente leitura' },
  { value: 'operator', label: 'Operador — Deploy e monitoramento' },
];

const roleBadgeColors: Record<string, 'red' | 'blue' | 'muted' | 'green'> = {
  admin: 'red',
  editor: 'blue',
  viewer: 'muted',
  operator: 'green',
};

export function TeamModule() {
  const [members, setMembers] = useState<Member[]>([
    { id: '1', email: 'admin@promobrindes.com.br', name: 'Pink', role: 'admin', status: 'active' },
    { id: '2', email: 'cerebro@promobrindes.com.br', name: 'Cerébro', role: 'admin', status: 'active' },
  ]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('editor');
  const [approvalCount, setApprovalCount] = useState('1');

  const handleInvite = () => {
    if (!inviteEmail || !inviteEmail.includes('@')) {
      toast.error('Email inválido');
      return;
    }
    if (members.some(m => m.email === inviteEmail)) {
      toast.error('Membro já existe');
      return;
    }
    setMembers([...members, {
      id: crypto.randomUUID(),
      email: inviteEmail,
      name: inviteEmail.split('@')[0],
      role: inviteRole as Member['role'],
      status: 'invited',
    }]);
    setInviteEmail('');
    toast.success('Convite enviado');
  };

  const handleRemove = (id: string) => {
    setMembers(members.filter(m => m.id !== id));
    toast.success('Membro removido');
  };

  const handleRoleChange = (id: string, role: string) => {
    setMembers(members.map(m => m.id === id ? { ...m, role: role as Member['role'] } : m));
    toast.success('Papel atualizado');
  };

  return (
    <div className="space-y-8">
      <SectionTitle icon="👥" title="Team & Permissões" subtitle="Gerencie membros do workspace e controle de acesso" />

      {/* A) Membros do Workspace */}
      <SectionTitle icon="🏢" title="Membros do Workspace" subtitle="Convide e gerencie membros da equipe" />
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <InputField label="Email" value={inviteEmail} onChange={setInviteEmail} placeholder="email@empresa.com" />
          </div>
          <div className="w-52">
            <SelectField label="Papel" value={inviteRole} onChange={setInviteRole} options={roleOptions} />
          </div>
          <button
            onClick={handleInvite}
            className="px-4 py-2 rounded-lg text-sm font-medium text-primary-foreground nexus-gradient-bg hover:opacity-90 transition-all"
            aria-label="Convidar membro"
          >
            Convidar
          </button>
        </div>

        {members.length === 0 ? (
          <EmptyState icon="👥" title="Nenhum membro" description="Convide membros para colaborar" />
        ) : (
          <div className="space-y-2 mt-4" role="list" aria-label="Lista de membros">
            {members.map((m) => (
              <div key={m.id} role="listitem" className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 transition-all">
                <div className="flex items-center gap-3">
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground nexus-gradient-bg"
                    aria-hidden="true"
                  >
                    {m.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <NexusBadge color={m.status === 'active' ? 'green' : 'yellow'}>
                    {m.status === 'active' ? 'Ativo' : 'Convidado'}
                  </NexusBadge>
                  <select
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.id, e.target.value)}
                    className="text-xs bg-card border border-border rounded-lg px-2 py-1 text-foreground"
                    aria-label={`Papel de ${m.name}`}
                  >
                    {roleOptions.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
                  </select>
                  <button
                    onClick={() => handleRemove(m.id)}
                    className="text-xs text-destructive hover:text-destructive/80 transition-colors"
                    aria-label={`Remover ${m.name}`}
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* B) Permissões por Agente */}
      <SectionTitle icon="🔐" title="Permissões por Agente" subtitle="Controle quem pode editar, deploy, ver traces e deletar cada agente" />
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Tabela de permissões por membro">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 pr-4 font-medium">Membro</th>
                <th className="text-center py-2 px-3 font-medium">Editar</th>
                <th className="text-center py-2 px-3 font-medium">Deploy</th>
                <th className="text-center py-2 px-3 font-medium">Ver Traces</th>
                <th className="text-center py-2 px-3 font-medium">Deletar</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-border/50">
                  <td className="py-2 pr-4 text-foreground">{m.name}</td>
                  <td className="text-center py-2 px-3">
                    <input type="checkbox" defaultChecked={m.role === 'admin' || m.role === 'editor'} className="accent-primary" aria-label={`${m.name} pode editar`} />
                  </td>
                  <td className="text-center py-2 px-3">
                    <input type="checkbox" defaultChecked={m.role === 'admin' || m.role === 'operator'} className="accent-primary" aria-label={`${m.name} pode fazer deploy`} />
                  </td>
                  <td className="text-center py-2 px-3">
                    <input type="checkbox" defaultChecked={m.role !== 'viewer'} className="accent-primary" aria-label={`${m.name} pode ver traces`} />
                  </td>
                  <td className="text-center py-2 px-3">
                    <input type="checkbox" defaultChecked={m.role === 'admin'} className="accent-primary" aria-label={`${m.name} pode deletar`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* C) Approval Workflows */}
      <SectionTitle icon="✅" title="Approval Workflows" subtitle="Defina quantas aprovações são necessárias para ações críticas" />
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <SelectField
          label="Aprovações necessárias para deploy em produção"
          value={approvalCount}
          onChange={setApprovalCount}
          options={[
            { value: '0', label: 'Nenhuma (auto-deploy)' },
            { value: '1', label: '1 aprovação' },
            { value: '2', label: '2 aprovações' },
            { value: '3', label: '3 aprovações' },
          ]}
        />
        <p className="text-xs text-muted-foreground">
          Quando um agente é promovido para produção, o sistema exigirá {approvalCount === '0' ? 'nenhuma' : approvalCount} aprovação(ões) de membros com permissão de deploy.
        </p>
      </div>

      {/* D) Visibilidade por Role — Canvas Colaborativo */}
      <SectionTitle icon="👁️" title="Visibilidade de Módulos por Papel" subtitle="Cada papel vê apenas os módulos relevantes para sua função" />
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-xs" aria-label="Visibilidade de módulos por papel">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 pr-4 font-medium">Módulo</th>
                <th className="text-center py-2 px-2 font-medium">Admin</th>
                <th className="text-center py-2 px-2 font-medium">Developer</th>
                <th className="text-center py-2 px-2 font-medium">PM/Ops</th>
                <th className="text-center py-2 px-2 font-medium">Compliance</th>
                <th className="text-center py-2 px-2 font-medium">Viewer</th>
              </tr>
            </thead>
            <tbody>
              {[
                { module: '🧬 Identidade', admin: true, dev: true, pm: true, compliance: false, viewer: true },
                { module: '🧠 Cérebro', admin: true, dev: true, pm: false, compliance: false, viewer: true },
                { module: '💾 Memória', admin: true, dev: true, pm: false, compliance: true, viewer: false },
                { module: '📚 RAG', admin: true, dev: true, pm: false, compliance: false, viewer: false },
                { module: '🔧 Ferramentas', admin: true, dev: true, pm: false, compliance: false, viewer: false },
                { module: '✍️ Prompts', admin: true, dev: true, pm: true, compliance: false, viewer: true },
                { module: '🎼 Orquestração', admin: true, dev: true, pm: false, compliance: false, viewer: false },
                { module: '🛡️ Guardrails', admin: true, dev: true, pm: false, compliance: true, viewer: false },
                { module: '🧪 Testes', admin: true, dev: true, pm: true, compliance: false, viewer: true },
                { module: '🔭 Observabilidade', admin: true, dev: true, pm: false, compliance: true, viewer: false },
                { module: '🚀 Deploy', admin: true, dev: true, pm: false, compliance: false, viewer: false },
                { module: '💰 Billing', admin: true, dev: false, pm: false, compliance: true, viewer: false },
                { module: '🎮 Playground', admin: true, dev: true, pm: true, compliance: false, viewer: true },
              ].map(({ module, admin, dev, pm, compliance, viewer }) => (
                <tr key={module} className="border-b border-border/30">
                  <td className="py-1.5 pr-4 text-foreground">{module}</td>
                  {[admin, dev, pm, compliance, viewer].map((v, i) => (
                    <td key={i} className="text-center py-1.5 px-2">
                      <span className={v ? 'text-emerald-400' : 'text-muted-foreground/30'}>{v ? '✓' : '—'}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          PMs e Operadores focam em Identidade, Prompts, Testes e Playground. Compliance foca em Guardrails, Observabilidade, Memória e Billing.
        </p>
      </div>
    </div>
  );
}
