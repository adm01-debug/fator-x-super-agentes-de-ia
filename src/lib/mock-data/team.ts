export interface TeamMember { id: string; name: string; email: string; role: 'owner' | 'admin' | 'engineer' | 'analyst' | 'viewer'; avatar: string; lastActive: string; status: 'active' | 'invited' | 'disabled'; }

export const teamMembers: TeamMember[] = [
  { id: '1', name: 'Marina Costa', email: 'marina@nexus.ai', role: 'owner', avatar: 'MC', lastActive: 'Agora', status: 'active' },
  { id: '2', name: 'Rafael Mendes', email: 'rafael@nexus.ai', role: 'admin', avatar: 'RM', lastActive: '5 min atrás', status: 'active' },
  { id: '3', name: 'Juliana Santos', email: 'juliana@nexus.ai', role: 'engineer', avatar: 'JS', lastActive: '1h atrás', status: 'active' },
  { id: '4', name: 'Bruno Almeida', email: 'bruno@nexus.ai', role: 'engineer', avatar: 'BA', lastActive: '2h atrás', status: 'active' },
  { id: '5', name: 'Carlos Ferreira', email: 'carlos@nexus.ai', role: 'analyst', avatar: 'CF', lastActive: '3h atrás', status: 'active' },
  { id: '6', name: 'Ana Oliveira', email: 'ana@nexus.ai', role: 'viewer', avatar: 'AO', lastActive: '1 dia atrás', status: 'invited' },
];
