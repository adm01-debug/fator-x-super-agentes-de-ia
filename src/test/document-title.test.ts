import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { createElement } from "react";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return actual;
});

import { useDocumentTitle } from "@/hooks/use-document-title";

function createWrapper(route: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(MemoryRouter, { initialEntries: [route] }, children);
  };
}

describe("useDocumentTitle", () => {
  it("sets title for dashboard", () => {
    renderHook(() => useDocumentTitle(), { wrapper: createWrapper("/") });
    expect(document.title).toBe("Dashboard — Fator X");
  });

  it("sets title for agents page", () => {
    renderHook(() => useDocumentTitle(), { wrapper: createWrapper("/agents") });
    expect(document.title).toBe("Agentes — Fator X");
  });

  it("sets title for oracle page", () => {
    renderHook(() => useDocumentTitle(), { wrapper: createWrapper("/oracle") });
    expect(document.title).toBe("Oráculo — Fator X");
  });

  it("sets title for brain page", () => {
    renderHook(() => useDocumentTitle(), { wrapper: createWrapper("/brain") });
    expect(document.title).toBe("Super Cérebro — Fator X");
  });

  it("sets title for nested agent route", () => {
    renderHook(() => useDocumentTitle(), { wrapper: createWrapper("/agents/some-id") });
    expect(document.title).toBe("Agentes — Fator X");
  });

  it("falls back to app name for unknown routes", () => {
    renderHook(() => useDocumentTitle(), { wrapper: createWrapper("/unknown-route") });
    expect(document.title).toBe("Fator X");
  });

  it("sets title for auth page", () => {
    renderHook(() => useDocumentTitle(), { wrapper: createWrapper("/auth") });
    expect(document.title).toBe("Login — Fator X");
  });

  it("handles all major routes", () => {
    const routes: [string, string][] = [
      ["/knowledge", "Knowledge / RAG"],
      ["/workflows", "Workflows"],
      ["/security", "Security & Guardrails"],
      ["/billing", "Billing / Usage"],
      ["/settings", "Settings"],
      ["/monitoring", "Monitoring"],
    ];

    for (const [path, expectedTitle] of routes) {
      renderHook(() => useDocumentTitle(), { wrapper: createWrapper(path) });
      expect(document.title).toBe(`${expectedTitle} — Fator X`);
    }
  });
});
