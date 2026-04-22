import {
  TriggerNode,
  AgentNode,
  ToolNode,
  ConditionNode,
  TransformNode,
  OutputNode,
} from './CustomNodes';

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
