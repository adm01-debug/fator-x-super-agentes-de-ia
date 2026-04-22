import { Users, Factory, Truck, Package, UserCheck, MessageCircle } from 'lucide-react';
import { DEFAULT_CONNECTIONS } from './connections.data';

export const ENTITY_ICONS: Record<string, React.ElementType> = {
  cliente: Users,
  fornecedor: Factory,
  transportadora: Truck,
  produto: Package,
  colaborador: UserCheck,
  conversa_whatsapp: MessageCircle,
};

export function getConnectionLabel(connId: string): string {
  return DEFAULT_CONNECTIONS.find((c) => c.id === connId)?.label ?? connId;
}
