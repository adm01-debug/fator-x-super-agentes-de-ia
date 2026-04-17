import { Handle, Position } from 'reactflow';
import { cn } from '@/lib/utils';

interface NodeProps {
  data: { label?: string; [key: string]: any };
  selected?: boolean;
}

const nodeBase = 'rounded-lg border bg-card px-4 py-2 shadow-sm min-w-[140px] text-center text-xs font-medium transition-all';

function makeNode(icon: string, label: string, color: string, hasIn: boolean, hasOut: boolean) {
  return function Node({ data, selected }: NodeProps) {
    return (
      <div className={cn(nodeBase, color, selected && 'ring-2 ring-primary')}>
        {hasIn && <Handle type="target" position={Position.Left} />}
        <div className="flex items-center justify-center gap-1.5">
          <span>{icon}</span>
          <span>{data.label || label}</span>
        </div>
        {hasOut && <Handle type="source" position={Position.Right} />}
      </div>
    );
  };
}

export const TriggerNode = makeNode('▶️', 'Trigger', 'border-green-500/50 bg-green-500/10', false, true);
export const AgentNode = makeNode('🤖', 'Agent', 'border-blue-500/50 bg-blue-500/10', true, true);
export const ToolNode = makeNode('🔧', 'Tool', 'border-purple-500/50 bg-purple-500/10', true, true);
export const ConditionNode = makeNode('🔀', 'Condition', 'border-yellow-500/50 bg-yellow-500/10', true, true);
export const TransformNode = makeNode('✨', 'Transform', 'border-pink-500/50 bg-pink-500/10', true, true);
export const OutputNode = makeNode('🎯', 'Output', 'border-red-500/50 bg-red-500/10', true, false);

export const nodeTypes = {
  trigger: TriggerNode,
  agent: AgentNode,
  tool: ToolNode,
  condition: ConditionNode,
  transform: TransformNode,
  output: OutputNode,
};

export const NODE_PALETTE = [
  { type: 'trigger', icon: '▶️', label: 'Trigger', desc: 'Entrada do fluxo' },
  { type: 'agent', icon: '🤖', label: 'Agente', desc: 'Chamada a um agente' },
  { type: 'tool', icon: '🔧', label: 'Ferramenta', desc: 'Execução de tool' },
  { type: 'condition', icon: '🔀', label: 'Condição', desc: 'Branch if/else' },
  { type: 'transform', icon: '✨', label: 'Transform', desc: 'Transforma dados' },
  { type: 'output', icon: '🎯', label: 'Output', desc: 'Saída final' },
];
