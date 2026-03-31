import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";

function renderSidebar(route = "/") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <SidebarProvider defaultOpen={true}>
        <AppSidebar />
      </SidebarProvider>
    </MemoryRouter>
  );
}

describe("AppSidebar", () => {
  it("renders all section labels", () => {
    renderSidebar();
    expect(screen.getByText("Geral")).toBeInTheDocument();
    expect(screen.getByText("Desenvolvimento")).toBeInTheDocument();
    expect(screen.getByText("Operações")).toBeInTheDocument();
    expect(screen.getByText("Administração")).toBeInTheDocument();
  });

  it("renders navigation items", () => {
    renderSidebar();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Agents")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders the brand name", () => {
    renderSidebar();
    expect(screen.getByText("Fator X")).toBeInTheDocument();
  });

  it("renders the collapse button with aria-label", () => {
    renderSidebar();
    expect(screen.getByLabelText("Recolher sidebar")).toBeInTheDocument();
  });

  it("renders workspace info", () => {
    renderSidebar();
    expect(screen.getByText("Workspace Free")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });
});
