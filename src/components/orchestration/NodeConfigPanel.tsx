import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Flag } from 'lucide-react';
import type { GraphNode } from '@/services/agentGraphService';

interface AgentLite {
  id: string;
  name: string;
}

interface Props {
  node: GraphNode | null;
  agents: AgentLite[];
  isEntry: boolean;
  onChange: (patch: Partial<GraphNode>) => void;
  onDelete: () => void;
  onSetEntry: () => void;
}

export function NodeConfigPanel({ node, agents, isEntry, onChange, onDelete, onSetEntry }: Props) {
  const [label, setLabel] = useState(node?.label ?? '');
  const [role, setRole] = useState(node?.role ?? '');
  const [agentId, setAgentId] = useState(node?.agent_id ?? '');

  useEffect(() => {
    setLabel(node?.label ?? '');
    setRole(node?.role ?? '');
    setAgentId(node?.agent_id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id]);

  if (!node) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-sm">Nó</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Selecione um nó no canvas para configurar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Configurar Nó</CardTitle>
        {isEntry && (
          <span className="text-[10px] font-semibold text-primary flex items-center gap-1">
            <Flag className="h-3 w-3" /> Entrada
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs">Rótulo</Label>
          <Input
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              onChange({ label: e.target.value });
            }}
            placeholder="Ex: Pesquisador"
            className="h-8"
          />
        </div>
        <div>
          <Label className="text-xs">Papel / Role</Label>
          <Input
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              onChange({ role: e.target.value });
            }}
            placeholder="Ex: pesquisar dados"
            className="h-8"
          />
        </div>
        <div>
          <Label className="text-xs">Agente vinculado</Label>
          <Select
            value={agentId || 'none'}
            onValueChange={(v) => {
              const id = v === 'none' ? null : v;
              setAgentId(id ?? '');
              onChange({ agent_id: id });
            }}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Nenhum (genérico) —</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 pt-2">
          {!isEntry && (
            <Button size="sm" variant="outline" className="flex-1" onClick={onSetEntry}>
              <Flag className="h-3 w-3 mr-1" /> Entrada
            </Button>
          )}
          <Button size="sm" variant="destructive" className="flex-1" onClick={onDelete}>
            <Trash2 className="h-3 w-3 mr-1" /> Remover
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
