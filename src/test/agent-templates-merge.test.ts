import { describe, it, expect } from "vitest";

/**
 * Testes unitários para a lógica de merge/dedupe/parsing do CreateAgentWizard.
 * Replicam exatamente as funções inline do componente (linhas 65-85, 35-41).
 */

// ── Replicas das funções puras do CreateAgentWizard ──
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function parseTools(rawTools: unknown): string[] {
  return Array.isArray(rawTools)
    ? rawTools
        .map((tool) =>
          typeof tool === "string" ? tool : (tool as { name?: string })?.name ?? ""
        )
        .filter(Boolean)
    : [];
}

interface T { id: string; name: string; category?: string }
function mergeTemplates(dbTemplates: T[], staticTemplates: T[]): T[] {
  const dbNames = new Set(dbTemplates.map((t) => norm(t.name)));
  return [...dbTemplates, ...staticTemplates.filter((t) => !dbNames.has(norm(t.name)))];
}

function categoryCount(list: T[]): Record<string, number> {
  const counts: Record<string, number> = { all: list.length };
  list.forEach((t) => {
    if (t.category) counts[t.category] = (counts[t.category] || 0) + 1;
  });
  return counts;
}

// ── Tests ──
describe("agent templates: norm()", () => {
  it("normaliza case e espaços múltiplos", () => {
    expect(norm("  Especialista  -  Vendas  ")).toBe("especialista - vendas");
    expect(norm("ESPECIALISTA - VENDAS")).toBe("especialista - vendas");
  });
  it("trata strings já normalizadas", () => {
    expect(norm("foo bar")).toBe("foo bar");
  });
});

describe("agent templates: parseTools()", () => {
  it("aceita array de strings", () => {
    expect(parseTools(["web_search", "calculator"])).toEqual(["web_search", "calculator"]);
  });
  it("aceita array de objetos { name }", () => {
    expect(parseTools([{ name: "web_search" }, { name: "calc" }])).toEqual(["web_search", "calc"]);
  });
  it("aceita array misto", () => {
    expect(parseTools(["web_search", { name: "calc" }, { name: "" }, ""])).toEqual([
      "web_search",
      "calc",
    ]);
  });
  it("retorna [] para null/undefined/string/object", () => {
    expect(parseTools(null)).toEqual([]);
    expect(parseTools(undefined)).toEqual([]);
    expect(parseTools("web_search")).toEqual([]);
    expect(parseTools({ tools: [] })).toEqual([]);
  });
});

describe("agent templates: mergeTemplates()", () => {
  it("dedupe: DB ganha sobre estático com mesmo nome (case-insensitive)", () => {
    const db = [{ id: "uuid-1", name: "Especialista - Vendas - SDR" }];
    const stat = [
      { id: "static-1", name: "ESPECIALISTA - VENDAS - SDR" },
      { id: "static-2", name: "Outro Template" },
    ];
    const merged = mergeTemplates(db, stat);
    expect(merged).toHaveLength(2);
    expect(merged[0].id).toBe("uuid-1");
    expect(merged[1].id).toBe("static-2");
  });
  it("preserva todos os estáticos quando DB está vazio", () => {
    const stat = [{ id: "s1", name: "A" }, { id: "s2", name: "B" }];
    expect(mergeTemplates([], stat)).toEqual(stat);
  });
  it("DB-only quando estáticos colidem todos", () => {
    const db = [{ id: "d1", name: "A" }];
    const stat = [{ id: "s1", name: " a " }];
    const merged = mergeTemplates(db, stat);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("d1");
  });
});

describe("agent templates: categoryCount()", () => {
  it("conta 'all' e cada categoria distinta", () => {
    const list: T[] = [
      { id: "1", name: "x", category: "Gravação" },
      { id: "2", name: "y", category: "Gravação" },
      { id: "3", name: "z", category: "Operações" },
      { id: "4", name: "w" }, // sem categoria
    ];
    const c = categoryCount(list);
    expect(c.all).toBe(4);
    expect(c["Gravação"]).toBe(2);
    expect(c["Operações"]).toBe(1);
    expect(c["undefined"]).toBeUndefined();
  });
  it("retorna { all: 0 } para lista vazia", () => {
    expect(categoryCount([])).toEqual({ all: 0 });
  });
});

describe("agent templates: dbTemplateIds (verified badge)", () => {
  it("apenas IDs do DB marcados como verificados", () => {
    const db = [{ id: "uuid-1", name: "A" }, { id: "uuid-2", name: "B" }];
    const stat = [{ id: "static-1", name: "C" }];
    const merged = mergeTemplates(db, stat);
    const verified = new Set(db.map((t) => t.id));
    expect(merged.filter((t) => verified.has(t.id)).map((t) => t.id)).toEqual([
      "uuid-1",
      "uuid-2",
    ]);
    expect(verified.has("static-1")).toBe(false);
  });
});
