/**
 * Detector de regras contraditórias no system prompt do wizard rápido.
 *
 * Heurísticas (sem LLM, 100% offline):
 *   1. Polaridade — pares de "regras" com marcadores opostos (nunca/sempre,
 *      proíbe/exige) que compartilham ≥2 tokens significativos PT-BR.
 *   2. Numérico — limites min/max na mesma unidade onde min > max,
 *      ou dois valores exatos diferentes para a mesma unidade.
 *   3. Idioma — duas instruções "responda em <X>" com idiomas diferentes.
 */

export type ContradictionKind = 'polarity' | 'numeric' | 'language';

export interface PromptContradiction {
  kind: ContradictionKind;
  /** Linha 1-indexed da primeira regra. */
  lineA: number;
  /** Linha 1-indexed da segunda regra. */
  lineB: number;
  snippetA: string;
  snippetB: string;
  /** Mensagem PT-BR explicando o conflito. */
  reason: string;
}

const STRIP_ACCENTS_RE = /[\u0300-\u036f]/g;
function norm(s: string): string {
  return s.normalize('NFD').replace(STRIP_ACCENTS_RE, '').toLowerCase();
}

/* ----------------------------- polarity ----------------------------- */

const NEGATIVE_MARKERS = [
  'nunca', 'jamais', 'evite', 'evitar', 'proibido', 'proibida', 'proibidos',
  'em hipotese alguma', 'nao pode', 'nao deve', 'nao devera', 'nao podera',
  'nao compartilhe', 'nao revele', 'nao mencione', 'nao use', 'nao utilize',
  'nao responda', 'nao envie', 'nao gere', 'nao escreva', 'nao faca',
  'nao fale', 'nao informe', 'nao cite', 'nao ofereca',
];

const POSITIVE_MARKERS = [
  'sempre', 'obrigatoriamente', 'obrigatorio', 'obrigatoria',
  'deve ', 'devera', 'tem que', 'precisa ', 'somente ', 'apenas ',
];

const STOPWORDS = new Set([
  'a','o','os','as','um','uma','uns','umas','de','da','do','das','dos',
  'em','no','na','nos','nas','com','sem','para','por','pra','pro',
  'que','se','ou','mas','quando','pois','porque','como','qual','quais',
  'ao','aos','la','las','lo','los','ser','estar','foi','sera','seja','sejam',
  'sao','eh','voce','voces','seu','sua','seus','suas','meu','minha',
  'isso','isto','aquilo','este','esta','esse','essa','aqui','ali',
  'mais','menos','muito','pouco','bem','mal','tao','tanto','sobre','entre',
  'todo','toda','todos','todas','cada','algum','alguma','nenhum','nenhuma',
  // marcadores de polaridade — não devem contar como tokens compartilhados
  'sempre','nunca','jamais','nao','obrigatoriamente','obrigatorio','obrigatoria',
  'somente','apenas','so','deve','devera','precisa','tem','que','pode','podera',
  'evite','evitar','proibido','proibida','revele','compartilhe','mencione',
  'use','utilize','responda','envie','gere','escreva','informe','cite','fale',
  'faca','ofereca','hipotese','alguma',
]);

function tokenize(line: string): string[] {
  return norm(line)
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

function hasMarker(line: string, markers: string[]): boolean {
  const n = ' ' + norm(line) + ' ';
  return markers.some((m) => n.includes(m.endsWith(' ') ? m : ' ' + m + ' ') || n.includes(m));
}

interface RuleLine {
  line: number;
  text: string;
  polarity: 'neg' | 'pos' | 'neutral';
  tokens: Set<string>;
}

function extractRules(prompt: string): RuleLine[] {
  const out: RuleLine[] = [];
  const lines = prompt.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.match(/^\s{0,3}#{1,6}\s/)) continue;
    let text = raw.trim();
    if (text.length < 4) continue;

    const isBullet = !!raw.match(/^\s*[-*•]\s+/) || !!raw.match(/^\s*\d+[.)]\s+/);
    text = text.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '');
    if (text.length < 4) continue;

    const neg = hasMarker(text, NEGATIVE_MARKERS);
    const pos = hasMarker(text, POSITIVE_MARKERS);
    const polarity: RuleLine['polarity'] =
      neg && !pos ? 'neg' : pos && !neg ? 'pos' : neg && pos ? 'neg' : 'neutral';

    if (!isBullet && polarity === 'neutral') continue;

    out.push({ line: i + 1, text, polarity, tokens: new Set(tokenize(text)) });
  }
  return out;
}

function sharedTokens(a: Set<string>, b: Set<string>): string[] {
  const out: string[] = [];
  for (const t of a) if (b.has(t)) out.push(t);
  return out;
}

/* ------------------------------ numeric ------------------------------ */

const NUMERIC_RE =
  /\b(maximo|max|ate|no\s*maximo|menos\s*de|inferior\s*a|min(?:imo)?|pelo\s*menos|ao\s*menos|mais\s*de|superior\s*a|exatamente)\s+(\d{1,5})\s*(palavras?|caracteres?|chars?|linhas?|frases?|paragrafos?|tokens?|minutos?|segundos?)/g;

interface NumericClaim {
  line: number;
  bound: 'min' | 'max' | 'eq';
  value: number;
  unit: string;
  snippet: string;
}

function extractNumericClaims(prompt: string): NumericClaim[] {
  const out: NumericClaim[] = [];
  const lines = prompt.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const n = norm(lines[i]);
    NUMERIC_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = NUMERIC_RE.exec(n)) !== null) {
      const word = m[1];
      const value = parseInt(m[2], 10);
      const unit = m[3].replace(/s$/, '');
      let bound: NumericClaim['bound'];
      if (/^(min|pelo|ao|mais|superior)/.test(word)) bound = 'min';
      else if (/^(max|ate|no|menos|inferior)/.test(word)) bound = 'max';
      else bound = 'eq';
      out.push({ line: i + 1, bound, value, unit, snippet: lines[i].trim() });
    }
  }
  return out;
}

/* ------------------------------ language ------------------------------ */

const LANG_NAMES: Record<string, string> = {
  'portugues': 'português',
  'portuguesa': 'português',
  'pt-br': 'português',
  'pt br': 'português',
  'ingles': 'inglês',
  'english': 'inglês',
  'en-us': 'inglês',
  'espanhol': 'espanhol',
  'spanish': 'espanhol',
  'frances': 'francês',
  'french': 'francês',
  'alemao': 'alemão',
  'german': 'alemão',
  'italiano': 'italiano',
  'japones': 'japonês',
  'chines': 'chinês',
};

interface LangClaim {
  line: number;
  language: string;
  snippet: string;
}

function extractLanguageClaims(prompt: string): LangClaim[] {
  const out: LangClaim[] = [];
  const lines = prompt.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const n = norm(lines[i]);
    if (!/(\bidioma\b|\blingua\b|\bem\s+(portugues|ingles|espanhol|frances|alemao|italiano|japones|chines)|\b(in|respond\s+in|answer\s+in)\s+(english|spanish|french|german|portuguese))/.test(n)) {
      continue;
    }
    for (const key of Object.keys(LANG_NAMES)) {
      if (n.includes(key)) {
        out.push({ line: i + 1, language: LANG_NAMES[key], snippet: lines[i].trim() });
        break;
      }
    }
  }
  return out;
}

/* ------------------------------- main ------------------------------- */

const MIN_SHARED_TOKENS = 2;

export function detectPromptContradictions(prompt: string): PromptContradiction[] {
  const conflicts: PromptContradiction[] = [];

  // 1) Polaridade.
  const rules = extractRules(prompt);
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const a = rules[i];
      const b = rules[j];
      if (a.polarity === 'neutral' || b.polarity === 'neutral') continue;
      if (a.polarity === b.polarity) continue;
      const shared = sharedTokens(a.tokens, b.tokens);
      if (shared.length < MIN_SHARED_TOKENS) continue;
      conflicts.push({
        kind: 'polarity',
        lineA: a.line,
        lineB: b.line,
        snippetA: a.text,
        snippetB: b.text,
        reason: `Regras com polaridade oposta sobre "${shared.slice(0, 3).join(', ')}" — uma exige, a outra proíbe.`,
      });
    }
  }

  // 2) Numérico.
  const nums = extractNumericClaims(prompt);
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      const a = nums[i];
      const b = nums[j];
      if (a.unit !== b.unit) continue;
      if (a.bound === 'eq' && b.bound === 'eq' && a.value !== b.value) {
        conflicts.push({
          kind: 'numeric',
          lineA: a.line,
          lineB: b.line,
          snippetA: a.snippet,
          snippetB: b.snippet,
          reason: `Dois valores exatos diferentes para ${a.unit}: ${a.value} vs ${b.value}.`,
        });
        continue;
      }
      const min = a.bound === 'min' ? a : b.bound === 'min' ? b : null;
      const max = a.bound === 'max' ? a : b.bound === 'max' ? b : null;
      if (!min || !max) continue;
      if (min.value > max.value) {
        conflicts.push({
          kind: 'numeric',
          lineA: min.line,
          lineB: max.line,
          snippetA: min.snippet,
          snippetB: max.snippet,
          reason: `Mínimo (${min.value} ${min.unit}) é maior que o máximo (${max.value} ${max.unit}).`,
        });
      }
    }
  }

  // 3) Idioma.
  const langs = extractLanguageClaims(prompt);
  for (let i = 0; i < langs.length; i++) {
    for (let j = i + 1; j < langs.length; j++) {
      const a = langs[i];
      const b = langs[j];
      if (a.language === b.language) continue;
      conflicts.push({
        kind: 'language',
        lineA: a.line,
        lineB: b.line,
        snippetA: a.snippet,
        snippetB: b.snippet,
        reason: `Idiomas distintos exigidos: ${a.language} vs ${b.language}.`,
      });
    }
  }

  return conflicts;
}

export function countContradictions(prompt: string): number {
  return detectPromptContradictions(prompt).length;
}

export function getContradictionLines(prompt: string): number[] {
  const set = new Set<number>();
  for (const c of detectPromptContradictions(prompt)) {
    set.add(c.lineA);
    set.add(c.lineB);
  }
  return Array.from(set).sort((a, b) => a - b);
}

export const CONTRADICTION_KIND_LABEL: Record<ContradictionKind, string> = {
  polarity: 'Polaridade',
  numeric: 'Numérico',
  language: 'Idioma',
};
