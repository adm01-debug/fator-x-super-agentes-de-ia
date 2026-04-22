/**
 * Hierarchical Crew — `src/lib/hierarchicalCrew.ts`
 *
 * Padrão CrewAI `Process.hierarchical` / Microsoft Magentic-One: um
 * **manager agent** recebe a tarefa e decide delegar para workers
 * especializados, coletando os resultados e sintetizando a resposta
 * final. Diferente do `metaOrchestrator` (que só roteia), aqui há
 * **delegação recursiva** com contrato (`role` + `backstory`).
 *
 * Sem dependência em runtime — este módulo define os contratos e o
 * planejador determinístico. O execução real é orquestrada pelo
 * edge `smolagent-runtime` ou `dr-orchestrator`.
 */

export interface CrewRole {
  agent_id: string;
  role: string; // ex: "Closer", "SDR", "Intel"
  backstory: string;
  tools: string[];
  reports_to?: string; // agent_id do manager
  max_delegations?: number;
}

export interface CrewTask {
  id: string;
  description: string;
  expected_output: string;
  assigned_role?: string;
  context_task_ids?: string[];
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface DelegationPlan {
  manager: CrewRole;
  assignments: Array<{
    task: CrewTask;
    assignee: CrewRole;
    reason: string;
  }>;
  unassigned: CrewTask[];
  warnings: string[];
}

export interface BuildCrewInput {
  manager: CrewRole;
  workers: CrewRole[];
  tasks: CrewTask[];
  policy?: {
    max_delegations_per_worker?: number;
    require_tool_match?: boolean; // worker precisa ter todas as tools que a task implica
  };
}

/**
 * Planejador determinístico: atribui cada task ao worker cujo `role`
 * bate (exact match) ou cujas `tools` cobrem as necessárias. Devolve
 * tasks sem assignee quando nenhum worker qualifica.
 */
export function planDelegation(input: BuildCrewInput): DelegationPlan {
  const policy = {
    max_delegations_per_worker: input.policy?.max_delegations_per_worker ?? 5,
    require_tool_match: input.policy?.require_tool_match ?? false,
  };
  const assignments: DelegationPlan['assignments'] = [];
  const unassigned: CrewTask[] = [];
  const warnings: string[] = [];
  const workerLoad = new Map<string, number>(input.workers.map((w) => [w.agent_id, 0]));

  for (const task of input.tasks) {
    let assignee: CrewRole | null = null;
    let reason = '';

    // 1. Exact role match
    if (task.assigned_role) {
      assignee =
        input.workers.find((w) => w.role.toLowerCase() === task.assigned_role!.toLowerCase()) ??
        null;
      if (assignee) reason = `Exact role match: ${task.assigned_role}`;
    }

    // 2. Keyword match nas tools
    if (!assignee) {
      const taskWords = new Set(task.description.toLowerCase().split(/\s+/));
      const scored = input.workers
        .map((w) => {
          const score = w.tools.filter((t) =>
            Array.from(taskWords).some((word) => t.includes(word)),
          ).length;
          return { w, score };
        })
        .filter(({ score }) => (policy.require_tool_match ? score > 0 : true))
        .sort((a, b) => b.score - a.score);
      if (scored.length > 0 && scored[0].score > 0) {
        assignee = scored[0].w;
        reason = `Tool match (score ${scored[0].score})`;
      }
    }

    // 3. Fallback: worker com menor carga
    if (!assignee) {
      const sortedByLoad = input.workers
        .slice()
        .sort((a, b) => (workerLoad.get(a.agent_id) ?? 0) - (workerLoad.get(b.agent_id) ?? 0));
      if (sortedByLoad.length > 0) {
        assignee = sortedByLoad[0];
        reason = `Load balancing (worker menos ocupado)`;
      }
    }

    if (!assignee) {
      unassigned.push(task);
      warnings.push(`Task ${task.id} não pôde ser atribuída: nenhum worker disponível.`);
      continue;
    }

    const currentLoad = workerLoad.get(assignee.agent_id) ?? 0;
    const maxLoad = assignee.max_delegations ?? policy.max_delegations_per_worker;
    if (currentLoad >= maxLoad) {
      warnings.push(
        `Worker ${assignee.role} atingiu max_delegations (${maxLoad}); task ${task.id} vai pra fila.`,
      );
      unassigned.push(task);
      continue;
    }

    workerLoad.set(assignee.agent_id, currentLoad + 1);
    assignments.push({ task, assignee, reason });
  }

  return { manager: input.manager, assignments, unassigned, warnings };
}

/**
 * Topological sort das tasks por `context_task_ids` — garante que
 * dependências rodem antes. Devolve null se houver ciclo.
 */
export function orderTasks(tasks: CrewTask[]): CrewTask[] | null {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const out: CrewTask[] = [];

  function visit(id: string): boolean {
    if (visited.has(id)) return true;
    if (visiting.has(id)) return false; // ciclo
    visiting.add(id);
    const t = byId.get(id);
    if (!t) {
      visiting.delete(id);
      visited.add(id);
      return true;
    }
    for (const dep of t.context_task_ids ?? []) {
      if (!visit(dep)) return false;
    }
    visiting.delete(id);
    visited.add(id);
    out.push(t);
    return true;
  }

  for (const t of tasks) if (!visit(t.id)) return null;
  return out;
}
