/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — Pre-Execution Validation Service
 * ═══════════════════════════════════════════════════════════════
 * Validates a complete workflow execution plan against compliance
 * rules, budget limits, guardrails, and security policies BEFORE
 * any step runs. Prevents costly mistakes and policy violations.
 *
 * Inspired by: AWS Step Functions pre-flight checks,
 * LangGraph plan validation, Microsoft Agent Framework policies.
 */

import { logger } from '@/lib/logger';
import { detectPromptInjection, detectAndRedactPII } from '@/lib/securityGuards';

// ──────── Types ────────

export interface ExecutionPlan {
  workflow_id: string;
  workflow_name: string;
  steps: ExecutionStep[];
  estimated_cost_usd: number;
  estimated_duration_ms: number;
  input: Record<string, unknown>;
  environment: 'development' | 'staging' | 'production';
}

export interface ExecutionStep {
  step_index: number;
  node_id: string;
  node_type: 'llm_call' | 'tool_call' | 'condition' | 'loop' | 'handoff' | 'human_approval' | 'data_transform';
  agent_id?: string;
  model?: string;
  tool_name?: string;
  estimated_tokens?: number;
  estimated_cost_usd?: number;
  requires_approval?: boolean;
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  category: ValidationCategory;
  enabled: boolean;
  validate: (plan: ExecutionPlan, config: ValidationConfig) => ValidationIssue[];
}

export type ValidationCategory =
  | 'budget'
  | 'security'
  | 'compliance'
  | 'guardrails'
  | 'performance'
  | 'data_governance'
  | 'architecture';

export interface ValidationIssue {
  rule_id: string;
  severity: 'error' | 'warning' | 'info';
  category: ValidationCategory;
  message: string;
  step_index?: number;
  suggestion?: string;
  auto_fixable?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  plan_id: string;
  issues: ValidationIssue[];
  errors: number;
  warnings: number;
  infos: number;
  validated_at: string;
  duration_ms: number;
}

export interface ValidationConfig {
  budget_limit_usd: number;
  max_steps: number;
  max_tokens_per_step: number;
  max_total_tokens: number;
  allowed_models: string[];
  allowed_tools: string[];
  blocked_tools: string[];
  require_human_approval_above_usd: number;
  max_loop_iterations: number;
  allow_external_api_calls: boolean;
  pii_check_enabled: boolean;
  injection_check_enabled: boolean;
  environment_restrictions: Record<string, string[]>; // env -> blocked_tools
}

// ──────── Default Config ────────

const DEFAULT_CONFIG: ValidationConfig = {
  budget_limit_usd: 10.0,
  max_steps: 50,
  max_tokens_per_step: 128_000,
  max_total_tokens: 1_000_000,
  allowed_models: [],  // empty = all allowed
  allowed_tools: [],   // empty = all allowed
  blocked_tools: ['execute_sql_raw', 'shell_exec', 'file_delete_recursive'],
  require_human_approval_above_usd: 5.0,
  max_loop_iterations: 10,
  allow_external_api_calls: true,
  pii_check_enabled: true,
  injection_check_enabled: true,
  environment_restrictions: {
    production: ['debug_tool', 'test_runner', 'mock_api'],
  },
};

// ──────── Built-in Validation Rules ────────

const BUILT_IN_RULES: ValidationRule[] = [
  // Budget rules
  {
    id: 'budget_total_limit',
    name: 'Total budget limit',
    description: 'Estimated total cost must not exceed budget limit',
    severity: 'error',
    category: 'budget',
    enabled: true,
    validate: (plan, config) => {
      if (plan.estimated_cost_usd > config.budget_limit_usd) {
        return [{
          rule_id: 'budget_total_limit',
          severity: 'error',
          category: 'budget',
          message: `Custo estimado ($${plan.estimated_cost_usd.toFixed(2)}) excede limite ($${config.budget_limit_usd.toFixed(2)})`,
          suggestion: 'Reduza o número de steps ou use modelos mais econômicos',
        }];
      }
      return [];
    },
  },
  {
    id: 'budget_human_approval',
    name: 'Human approval threshold',
    description: 'Plans above cost threshold require human approval step',
    severity: 'warning',
    category: 'budget',
    enabled: true,
    validate: (plan, config) => {
      if (plan.estimated_cost_usd > config.require_human_approval_above_usd) {
        const hasApproval = plan.steps.some(s => s.node_type === 'human_approval');
        if (!hasApproval) {
          return [{
            rule_id: 'budget_human_approval',
            severity: 'warning',
            category: 'budget',
            message: `Custo > $${config.require_human_approval_above_usd} requer step de aprovação humana`,
            suggestion: 'Adicione um node human_approval antes das etapas de alto custo',
            auto_fixable: true,
          }];
        }
      }
      return [];
    },
  },

  // Architecture rules
  {
    id: 'max_steps_limit',
    name: 'Maximum steps limit',
    description: 'Workflow must not exceed maximum step count',
    severity: 'error',
    category: 'architecture',
    enabled: true,
    validate: (plan, config) => {
      if (plan.steps.length > config.max_steps) {
        return [{
          rule_id: 'max_steps_limit',
          severity: 'error',
          category: 'architecture',
          message: `Workflow tem ${plan.steps.length} steps (máximo: ${config.max_steps})`,
          suggestion: 'Simplifique o workflow ou divida em sub-workflows',
        }];
      }
      return [];
    },
  },
  {
    id: 'loop_iteration_limit',
    name: 'Loop iteration limit',
    description: 'Loop nodes must have bounded iterations',
    severity: 'error',
    category: 'architecture',
    enabled: true,
    validate: (plan, config) => {
      const issues: ValidationIssue[] = [];
      for (const step of plan.steps) {
        if (step.node_type === 'loop') {
          const maxIter = (step.metadata?.max_iterations as number) ?? Infinity;
          if (maxIter > config.max_loop_iterations || maxIter === Infinity) {
            issues.push({
              rule_id: 'loop_iteration_limit',
              severity: 'error',
              category: 'architecture',
              message: `Loop no step ${step.step_index} sem limite de iterações`,
              step_index: step.step_index,
              suggestion: `Defina max_iterations ≤ ${config.max_loop_iterations}`,
              auto_fixable: true,
            });
          }
        }
      }
      return issues;
    },
  },

  // Security rules
  {
    id: 'blocked_tools_check',
    name: 'Blocked tools check',
    description: 'Workflow must not use blocked/dangerous tools',
    severity: 'error',
    category: 'security',
    enabled: true,
    validate: (plan, config) => {
      const issues: ValidationIssue[] = [];
      for (const step of plan.steps) {
        if (step.tool_name && config.blocked_tools.includes(step.tool_name)) {
          issues.push({
            rule_id: 'blocked_tools_check',
            severity: 'error',
            category: 'security',
            message: `Tool "${step.tool_name}" está bloqueada por política de segurança`,
            step_index: step.step_index,
            suggestion: 'Use uma alternativa segura para esta operação',
          });
        }
      }
      return issues;
    },
  },
  {
    id: 'environment_restrictions',
    name: 'Environment-specific restrictions',
    description: 'Certain tools are blocked in specific environments',
    severity: 'error',
    category: 'compliance',
    enabled: true,
    validate: (plan, config) => {
      const issues: ValidationIssue[] = [];
      const blocked = config.environment_restrictions[plan.environment] ?? [];
      for (const step of plan.steps) {
        if (step.tool_name && blocked.includes(step.tool_name)) {
          issues.push({
            rule_id: 'environment_restrictions',
            severity: 'error',
            category: 'compliance',
            message: `Tool "${step.tool_name}" não permitida em ${plan.environment}`,
            step_index: step.step_index,
          });
        }
      }
      return issues;
    },
  },
  {
    id: 'token_limit_per_step',
    name: 'Token limit per step',
    description: 'Each step must not exceed token limits',
    severity: 'warning',
    category: 'performance',
    enabled: true,
    validate: (plan, config) => {
      const issues: ValidationIssue[] = [];
      let totalTokens = 0;
      for (const step of plan.steps) {
        const tokens = step.estimated_tokens ?? 0;
        totalTokens += tokens;
        if (tokens > config.max_tokens_per_step) {
          issues.push({
            rule_id: 'token_limit_per_step',
            severity: 'warning',
            category: 'performance',
            message: `Step ${step.step_index}: ${tokens} tokens estimados (máximo: ${config.max_tokens_per_step})`,
            step_index: step.step_index,
            suggestion: 'Reduza o contexto ou use sumarização',
          });
        }
      }
      if (totalTokens > config.max_total_tokens) {
        issues.push({
          rule_id: 'token_limit_per_step',
          severity: 'error',
          category: 'performance',
          message: `Total de tokens estimados (${totalTokens}) excede limite (${config.max_total_tokens})`,
          suggestion: 'Reduza steps ou use modelos mais eficientes',
        });
      }
      return issues;
    },
  },

  // Data governance rules
  {
    id: 'pii_in_input',
    name: 'PII in workflow input',
    description: 'Workflow input should not contain unmasked PII',
    severity: 'warning',
    category: 'data_governance',
    enabled: true,
    validate: (plan, config) => {
      if (!config.pii_check_enabled) return [];
      const inputStr = JSON.stringify(plan.input);
      const piiResult = detectAndRedactPII(inputStr);
      if (piiResult.hasAnyPII) {
        const types = piiResult.detected.map(d => d.type).join(', ');
        return [{
          rule_id: 'pii_in_input',
          severity: 'warning',
          category: 'data_governance',
          message: `Input contém PII não mascarado: ${types}`,
          suggestion: 'Mascare dados sensíveis antes de enviar ao workflow',
          auto_fixable: true,
        }];
      }
      return [];
    },
  },

  // Guardrail rules
  {
    id: 'injection_in_input',
    name: 'Prompt injection in input',
    description: 'Workflow input must not contain prompt injection attempts',
    severity: 'error',
    category: 'guardrails',
    enabled: true,
    validate: (plan, config) => {
      if (!config.injection_check_enabled) return [];
      const inputStr = JSON.stringify(plan.input);
      const result = detectPromptInjection(inputStr);
      if (result.isInjection) {
        const patterns = result.detectedPatterns.map(p => p.name).join(', ');
        return [{
          rule_id: 'injection_in_input',
          severity: 'error',
          category: 'guardrails',
          message: `Possível injeção de prompt detectada: ${patterns} (risco: ${result.riskLevel})`,
          suggestion: 'Sanitize o input ou rejeite a requisição',
        }];
      }
      return [];
    },
  },

  // Model allowlist
  {
    id: 'allowed_models_check',
    name: 'Allowed models check',
    description: 'Only approved models can be used',
    severity: 'error',
    category: 'compliance',
    enabled: true,
    validate: (plan, config) => {
      if (config.allowed_models.length === 0) return []; // empty = all allowed
      const issues: ValidationIssue[] = [];
      for (const step of plan.steps) {
        if (step.model && !config.allowed_models.includes(step.model)) {
          issues.push({
            rule_id: 'allowed_models_check',
            severity: 'error',
            category: 'compliance',
            message: `Modelo "${step.model}" não está na lista de modelos aprovados`,
            step_index: step.step_index,
            suggestion: `Use um dos modelos aprovados: ${config.allowed_models.join(', ')}`,
          });
        }
      }
      return issues;
    },
  },
];

// ──────── Validation Engine ────────

/**
 * Validate an execution plan against all rules before running.
 */
export function validateExecutionPlan(
  plan: ExecutionPlan,
  configOverrides?: Partial<ValidationConfig>,
  customRules?: ValidationRule[],
): ValidationResult {
  const startTime = Date.now();
  const config = { ...DEFAULT_CONFIG, ...configOverrides };
  const allRules = [...BUILT_IN_RULES, ...(customRules ?? [])].filter(r => r.enabled);

  const issues: ValidationIssue[] = [];

  for (const rule of allRules) {
    try {
      const ruleIssues = rule.validate(plan, config);
      issues.push(...ruleIssues);
    } catch (err) {
      logger.warn(`Validation rule ${rule.id} failed`, { error: err instanceof Error ? err.message : String(err) });
      issues.push({
        rule_id: rule.id,
        severity: 'warning',
        category: rule.category,
        message: `Regra de validação "${rule.name}" falhou: ${err instanceof Error ? err.message : 'unknown'}`,
      });
    }
  }

  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;
  const infos = issues.filter(i => i.severity === 'info').length;
  const durationMs = Date.now() - startTime;

  const result: ValidationResult = {
    valid: errors === 0,
    plan_id: `${plan.workflow_id}-${Date.now()}`,
    issues,
    errors,
    warnings,
    infos,
    validated_at: new Date().toISOString(),
    duration_ms: durationMs,
  };

  logger.info('Pre-execution validation complete', {
    workflow: plan.workflow_name,
    valid: result.valid,
    errors,
    warnings,
    durationMs,
  });

  return result;
}

/**
 * Get all available validation rules with their status.
 */
export function listValidationRules(): Array<{ id: string; name: string; description: string; category: string; severity: string; enabled: boolean }> {
  return BUILT_IN_RULES.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    severity: r.severity,
    enabled: r.enabled,
  }));
}

/**
 * Get the default validation config (for UI display).
 */
export function getDefaultValidationConfig(): ValidationConfig {
  return { ...DEFAULT_CONFIG };
}
