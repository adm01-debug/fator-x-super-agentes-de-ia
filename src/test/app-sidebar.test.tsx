import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";

// Mock auth context
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { email: "test@test.com" },
    signOut: vi.fn(),
  }),
}));

// Mock agentService
vi.mock("@/lib/agentService", () => ({
  getWorkspaceInfo: () =>
    Promise.resolve({
      name: "Test WS",
      plan: "free",
      maxAgents: 5,
      agentCount: 2,
      userName: "Test User",
      email: "test@test.com",
    }),
}));

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
    expect(screen.getByText("FATOR")).toBeInTheDocument();
  });

  it("renders the collapse button with aria-label", () => {
    renderSidebar();
    expect(screen.getByLabelText("Recolher sidebar")).toBeInTheDocument();
  });

  it("renders workspace info", () => {
    renderSidebar();
    expect(screen.getByText(/Workspace Free/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });
});
