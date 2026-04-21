/**
 * Compila o system prompt final do agente, interpolando variáveis comuns
 * e adicionando um cabeçalho de identidade quando faz sentido.
 *
 * Variáveis suportadas (case-insensitive):
 *   {{name}} {{agent_name}}   → nome
 *   {{mission}}               → missão
 *   {{description}}           → descrição
 *   {{type}} {{persona}}      → tipo
 *   {{model}}                 → modelo
 *   {{emoji}} {{avatar}}      → emoji
 *   {{date}} {{today}}        → data atual (YYYY-MM-DD)
 *   {{datetime}}              → data + hora ISO
 */

export interface CompilePromptInput {
  name: string;
  emoji: string;
  mission: string;
  description?: string;
  type: string;
  model: string;
  prompt: string;
}

export interface CompiledPrompt {
  text: string;
  detectedVariables: string[];
  unresolvedVariables: string[];
  stats: {
    chars: number;
    words: number;
    lines: number;
    estimatedTokens: number;
  };
}

const VAR_REGEX = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildVarMap(input: CompilePromptInput): Record<string, string> {
  const date = todayISO();
  return {
    name: input.name.trim(),
    agent_name: input.name.trim(),
    mission: input.mission.trim(),
    description: (input.description ?? '').trim(),
    type: input.type,
    persona: input.type,
    model: input.model,
    emoji: input.emoji,
    avatar: input.emoji,
    date,
    today: date,
    datetime: new Date().toISOString(),
  };
}

export function compilePrompt(input: CompilePromptInput): CompiledPrompt {
  const vars = buildVarMap(input);
  const detected = new Set<string>();
  const unresolved = new Set<string>();

  const interpolated = input.prompt.replace(VAR_REGEX, (_match, key: string) => {
    const k = key.toLowerCase();
    detected.add(k);
    const value = vars[k];
    if (value === undefined || value === '') {
      unresolved.add(k);
      return `{{${key}}}`;
    }
    return value;
  });

  const promptMentionsName =
    input.name.trim().length > 0 &&
    interpolated.toLowerCase().includes(input.name.trim().toLowerCase());

  const headerLines: string[] = [];
  if (input.name.trim() && !promptMentionsName) {
    headerLines.push(`# ${input.emoji || '🤖'} ${input.name.trim()}`);
    if (input.mission.trim()) headerLines.push(`> ${input.mission.trim()}`);
    headerLines.push('');
  }

  const metaLine = `<!-- meta: tipo=${input.type} · modelo=${input.model} · data=${vars.date} -->`;

  const text = [headerLines.join('\n'), interpolated.trim(), '', metaLine]
    .filter((s) => s.length > 0)
    .join('\n')
    .trim();

  const words = text.split(/\s+/).filter(Boolean).length;
  const lines = text.split('\n').length;

  return {
    text,
    detectedVariables: Array.from(detected).sort(),
    unresolvedVariables: Array.from(unresolved).sort(),
    stats: {
      chars: text.length,
      words,
      lines,
      estimatedTokens: Math.ceil(text.length / 4),
    },
  };
}
