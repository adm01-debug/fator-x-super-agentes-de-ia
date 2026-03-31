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

interface AgentPerm {
  userId: string;
  canEdit: boolean;
  canDeploy: boolean;
  canViewTraces: boolean;
  canDelete: boolean;
}

const roleOptions = [
  { value: 'admin', label: 'Admin — Acesso total' },
  { value: 'editor', label: 'Editor — Criar e editar agentes' },
  { value: 'viewer', label: 'Viewer — Somente leitura' },
  { value: 'operator', label: 'Operador — Deploy e monitoramento' },
];

const roleColors: Record<string, string> = {
  admin: '#FF6B6B',
  editor: '#4D96FF',
  viewer: '#888888',
  operator: '#6BCB77',
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
      <div className="rounded-xl border border-[#222244] bg-[#111122] p-6 space-y-4">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <InputField label="Email" value={inviteEmail} onChange={setInviteEmail} placeholder="email@empresa.com" />
          </div>
          <div className="w-52">
            <SelectField label="Papel" value={inviteRole} onChange={setInviteRole} options={roleOptions} />
          </div>
          <button
            onClick={handleInvite}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #4D96FF, #6BCB77)' }}
          >
            Convidar
          </button>
        </div>

        {members.length === 0 ? (
          <EmptyState icon="👥" title="Nenhum membro" description="Convide membros para colaborar" />
        ) : (
          <div className="space-y-2 mt-4">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-[#222244] bg-[#0a0a1a] hover:bg-[#16162a] transition-all">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: roleColors[m.role] }}>
                    {m.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{m.name}</p>
                    <p className="text-xs text-[#888888]">{m.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <NexusBadge color={m.status === 'active' ? '#6BCB77' : '#FFD93D'}>
                    {m.status === 'active' ? 'Ativo' : 'Convidado'}
                  </NexusBadge>
                  <select
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.id, e.target.value)}
                    className="text-xs bg-[#111122] border border-[#222244] rounded-lg px-2 py-1 text-[#E0E0E0]"
                  >
                    {roleOptions.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
                  </select>
                  <button
                    onClick={() => handleRemove(m.id)}
                    className="text-xs text-[#FF6B6B] hover:text-red-400 transition-colors"
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
      <div className="rounded-xl border border-[#222244] bg-[#111122] p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#222244] text-[#888888]">
                <th className="text-left py-2 pr-4 font-medium">Membro</th>
                <th className="text-center py-2 px-3 font-medium">Editar</th>
                <th className="text-center py-2 px-3 font-medium">Deploy</th>
                <th className="text-center py-2 px-3 font-medium">Ver Traces</th>
                <th className="text-center py-2 px-3 font-medium">Deletar</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-[#222244]/50">
                  <td className="py-2 pr-4 text-white">{m.name}</td>
                  <td className="text-center py-2 px-3">
                    <input type="checkbox" defaultChecked={m.role === 'admin' || m.role === 'editor'} className="accent-[#4D96FF]" />
                  </td>
                  <td className="text-center py-2 px-3">
                    <input type="checkbox" defaultChecked={m.role === 'admin' || m.role === 'operator'} className="accent-[#4D96FF]" />
                  </td>
                  <td className="text-center py-2 px-3">
                    <input type="checkbox" defaultChecked={m.role !== 'viewer'} className="accent-[#4D96FF]" />
                  </td>
                  <td className="text-center py-2 px-3">
                    <input type="checkbox" defaultChecked={m.role === 'admin'} className="accent-[#4D96FF]" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* C) Approval Workflows */}
      <SectionTitle icon="✅" title="Approval Workflows" subtitle="Defina quantas aprovações são necessárias para ações críticas" />
      <div className="rounded-xl border border-[#222244] bg-[#111122] p-6 space-y-4">
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
        <p className="text-xs text-[#888888]">
          Quando um agente é promovido para produção, o sistema exigirá {approvalCount === '0' ? 'nenhuma' : approvalCount} aprovação(ões) de membros com permissão de deploy.
        </p>
      </div>
    </div>
  );
}
