import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationsDrawer } from "@/components/shared/NotificationsDrawer";

// Mock supabase
const mockSubscribe = vi.fn().mockReturnValue({ unsubscribe: vi.fn() });
const mockOn = vi.fn().mockReturnThis();
const mockChannel = vi.fn().mockReturnValue({ on: mockOn, subscribe: mockSubscribe });
const mockRemoveChannel = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: (...args: any[]) => mockChannel(...args),
    removeChannel: mockRemoveChannel,
    from: () => ({
      select: () => ({
        in: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    }),
  },
}));

function renderWithProviders() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NotificationsDrawer />
    </QueryClientProvider>
  );
}

describe("NotificationsDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders bell button", () => {
    renderWithProviders();
    expect(screen.getByLabelText(/Notificações/)).toBeInTheDocument();
  });

  it("subscribes to realtime channels on mount", () => {
    renderWithProviders();
    expect(mockChannel).toHaveBeenCalledWith("notifications-traces");
    expect(mockChannel).toHaveBeenCalledWith("notifications-agents");
    expect(mockChannel).toHaveBeenCalledWith("notifications-evals");
    expect(mockSubscribe).toHaveBeenCalledTimes(3);
  });

  it("opens drawer when bell is clicked", async () => {
    renderWithProviders();
    await userEvent.click(screen.getByLabelText(/Notificações/));
    expect(screen.getByText("Notificações")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma notificação")).toBeInTheDocument();
  });

  it("cleans up channels on unmount", () => {
    const { unmount } = renderWithProviders();
    unmount();
    expect(mockRemoveChannel).toHaveBeenCalledTimes(3);
  });

  it("registers correct event filters for traces", () => {
    renderWithProviders();
    expect(mockOn).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        event: "INSERT",
        schema: "public",
        table: "agent_traces",
      }),
      expect.any(Function)
    );
  });

  it("registers correct event filters for agent status", () => {
    renderWithProviders();
    expect(mockOn).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        event: "UPDATE",
        schema: "public",
        table: "agents",
      }),
      expect.any(Function)
    );
  });

  it("registers correct event filters for evaluations", () => {
    renderWithProviders();
    expect(mockOn).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        event: "UPDATE",
        schema: "public",
        table: "evaluation_runs",
      }),
      expect.any(Function)
    );
  });
});
