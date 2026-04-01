import { useState, useCallback } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Trash2, X, UserPlus, Shield, Crown, Eye, Edit } from "lucide-react";
import { toast } from "sonner";

interface TeamMember { id: string; name: string; email: string; role: 'admin' | 'editor' | 'viewer' | 'operator'; status: 'active' | 'invited' | 'disabled'; lastActive: string; avatar: string; }
const ROLE_LABELS: Record<string, { label: string; color: string }> = { admin: { label: 'Admin', color: 'bg-rose-500/20 text-rose-400' }, editor: { label: 'Editor', color: 'bg-blue-500/20 text-blue-400' }, viewer: { label: 'Viewer', color: 'bg-muted text-muted-foreground' }, operator: { label: 'Operador', color: 'bg-emerald-500/20 text-emerald-400' } };

const SEED: TeamMember[] = [
  { id: 'm1', name: 'Pink', email: 'pink@promobrindes.com.br', role: 'admin', status: 'active', lastActive: '2 min atrás', avatar: '👑' },
  { id: 'm2', name: 'Cérebro', email: 'cerebro@promobrindes.com.br', role: 'admin', status: 'active', lastActive: 'Agora', avatar: '🧠' },
  { id: 'm3', name: 'Joaquim Ataides', email: 'joaquim@promobrindes.com.br', role: 'editor', status: 'active', lastActive: '1h atrás', avatar: '👨‍💼' },
  { id: 'm4', name: 'Ana Silva', email: 'ana@promobrindes.com.br', role: 'operator', status: 'active', lastActive: '3h atrás', avatar: '👩‍💻' },
  { id: 'm5', name: 'Carlos Mendes', email: 'carlos@promobrindes.com.br', role: 'viewer', status: 'invited', lastActive: 'Nunca', avatar: '👤' },
];

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>(SEED);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState(''); const [inviteEmail, setInviteEmail] = useState(''); const [inviteRole, setInviteRole] = useState<TeamMember['role']>('viewer');

  const invite = useCallback(() => {
    if (!inviteEmail.includes('@')) { toast.error('Email válido obrigatório'); return; }
    setMembers(prev => [...prev, { id: `m-${Date.now()}`, name: inviteName || inviteEmail.split('@')[0], email: inviteEmail, role: inviteRole, status: 'invited', lastActive: 'Nunca', avatar: '👤' }]);
    setShowInvite(false); setInviteName(''); setInviteEmail('');
    toast.success(`Convite enviado para ${inviteEmail}`);
  }, [inviteName, inviteEmail, inviteRole]);

  const changeRole = useCallback((id: string, role: TeamMember['role']) => { setMembers(prev => prev.map(m => m.id === id ? { ...m, role } : m)); toast.success('Função atualizada'); }, []);
  const removeMember = useCallback((id: string) => {
    const m = members.find(x => x.id === id);
    if (m?.role === 'admin' && members.filter(x => x.role === 'admin').length <= 1) { toast.error('Último admin'); return; }
    if (!confirm(`Remover ${m?.name}?`)) return;
    setMembers(prev => prev.filter(x => x.id !== id)); toast.info('Removido');
  }, [members]);
  const toggleStatus = useCallback((id: string) => { setMembers(prev => prev.map(m => m.id === id ? { ...m, status: m.status === 'active' ? 'disabled' as const : 'active' as const } : m)); }, []);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="Team & Roles" description="Gerencie membros, funções e permissões" actions={<Button className="nexus-gradient-bg text-primary-foreground gap-2" onClick={() => setShowInvite(true)}><UserPlus className="h-4 w-4" /> Convidar</Button>} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[{ l: 'Membros', v: members.length, c: 'text-foreground' }, { l: 'Ativos', v: members.filter(m => m.status === 'active').length, c: 'text-emerald-400' }, { l: 'Pendentes', v: members.filter(m => m.status === 'invited').length, c: 'text-amber-400' }, { l: 'Admins', v: members.filter(m => m.role === 'admin').length, c: 'text-rose-400' }].map(k => (
          <div key={k.l} className="nexus-card text-center py-3"><p className={`text-2xl font-heading font-bold ${k.c}`}>{k.v}</p><p className="text-[10px] text-muted-foreground">{k.l}</p></div>
        ))}
      </div>
      <div className="nexus-card overflow-hidden p-0">
        <table className="w-full text-xs"><thead><tr className="border-b border-border bg-muted/20 text-muted-foreground"><th className="text-left px-4 py-3">Membro</th><th className="text-left px-3 py-3">Email</th><th className="text-center px-3 py-3">Função</th><th className="text-center px-3 py-3">Status</th><th className="text-center px-3 py-3">Último acesso</th><th className="text-center px-3 py-3">Ações</th></tr></thead>
        <tbody>{members.map(m => { const r = ROLE_LABELS[m.role]; return (
          <tr key={m.id} className={`border-b border-border/30 ${m.status === 'disabled' ? 'opacity-40' : ''}`}>
            <td className="px-4 py-3"><div className="flex items-center gap-2"><span className="text-lg">{m.avatar}</span><span className="font-medium text-foreground">{m.name}</span></div></td>
            <td className="px-3 py-3 text-muted-foreground font-mono">{m.email}</td>
            <td className="px-3 py-3 text-center"><select value={m.role} onChange={e => changeRole(m.id, e.target.value as TeamMember['role'])} className={`px-2 py-0.5 rounded text-[10px] font-medium border-0 ${r.color}`}><option value="admin">Admin</option><option value="editor">Editor</option><option value="operator">Operador</option><option value="viewer">Viewer</option></select></td>
            <td className="px-3 py-3 text-center"><button onClick={() => toggleStatus(m.id)} className={`px-2 py-0.5 rounded text-[10px] ${m.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : m.status === 'invited' ? 'bg-amber-500/20 text-amber-400' : 'bg-muted text-muted-foreground'}`}>{m.status === 'active' ? 'Ativo' : m.status === 'invited' ? 'Pendente' : 'Desabilitado'}</button></td>
            <td className="px-3 py-3 text-center text-muted-foreground">{m.lastActive}</td>
            <td className="px-3 py-3 text-center"><button onClick={() => removeMember(m.id)} className="p-1 rounded hover:bg-destructive/20"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button></td>
          </tr>); })}</tbody></table>
      </div>
      <div className="nexus-card"><h3 className="text-sm font-semibold text-foreground mb-3">Matriz de Permissões</h3>
        <div className="overflow-x-auto"><table className="w-full text-[10px]"><thead><tr className="border-b border-border text-muted-foreground"><th className="text-left py-2 pr-4">Módulo</th>{Object.values(ROLE_LABELS).map(r => <th key={r.label} className="text-center py-2 px-2">{r.label}</th>)}</tr></thead>
        <tbody>{['Agent Builder', 'Dashboard', 'Deployments', 'Evaluations', 'Knowledge', 'Security', 'Settings', 'Team', 'Billing', 'Monitoring', 'DataHub', 'DB Manager'].map(mod => (
          <tr key={mod} className="border-b border-border/30"><td className="py-1.5 pr-4 text-foreground">{mod}</td>
            {['admin', 'editor', 'operator', 'viewer'].map(role => (<td key={role} className="py-1.5 text-center">{role === 'admin' ? '✅' : role === 'editor' && !['Settings','Team','Billing'].includes(mod) ? '✅' : role === 'operator' && ['Dashboard','Monitoring','Deployments','Evaluations'].includes(mod) ? '✅' : role === 'viewer' && ['Dashboard','Monitoring'].includes(mod) ? '👁️' : '—'}</td>))}
          </tr>))}</tbody></table></div>
      </div>
      {showInvite && (<div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowInvite(false)}><div className="bg-card border border-border rounded-xl p-6 max-w-md w-full space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-foreground">Convidar Membro</h3><button onClick={() => setShowInvite(false)}><X className="h-4 w-4 text-muted-foreground" /></button></div>
        <div className="space-y-3"><input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Nome" className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground" /><input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} type="email" placeholder="email@empresa.com" className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
        <select value={inviteRole} onChange={e => setInviteRole(e.target.value as TeamMember['role'])} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground"><option value="viewer">Viewer</option><option value="operator">Operador</option><option value="editor">Editor</option><option value="admin">Admin</option></select></div>
        <div className="flex gap-2 justify-end"><Button variant="outline" size="sm" onClick={() => setShowInvite(false)}>Cancelar</Button><Button size="sm" onClick={invite}><UserPlus className="h-3.5 w-3.5 mr-1" /> Enviar</Button></div>
      </div></div>)}
    </div>
  );
}
