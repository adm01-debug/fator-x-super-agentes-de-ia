import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner, FullPageLoader } from "@/components/shared/LoadingSpinner";
import { PageLoading } from "@/components/shared/PageLoading";

describe("Accessibility", () => {
  describe("EmptyState", () => {
    it("has role=status and aria-label", () => {
      render(<EmptyState title="Nenhum agente" description="Crie seu primeiro agente" />);
      const status = screen.getByRole("status");
      expect(status).toHaveAttribute("aria-label", "Nenhum agente");
    });

    it("hides icon from assistive tech", () => {
      const { container } = render(<EmptyState title="Vazio" />);
      expect(container.querySelector("[aria-hidden='true']")).toBeTruthy();
    });
  });

  describe("LoadingSpinner", () => {
    it("has role=status and sr-only label", () => {
      render(<LoadingSpinner />);
      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(screen.getByText("Carregando...")).toHaveClass("sr-only");
    });

    it("accepts custom label", () => {
      render(<LoadingSpinner label="Salvando..." />);
      expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Salvando...");
    });
  });

  describe("FullPageLoader", () => {
    it("renders with visible label", () => {
      render(<FullPageLoader label="Processando..." />);
      expect(screen.getByText("Processando...")).toBeInTheDocument();
    });
  });

  describe("PageLoading", () => {
    it("has accessible status role", () => {
      render(<PageLoading />);
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
  });
});
