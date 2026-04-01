import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: () => ({
      on: () => ({
        on: () => ({
          on: () => ({ subscribe: () => ({}) }),
          subscribe: () => ({}),
        }),
        subscribe: () => ({}),
      }),
      subscribe: () => ({}),
    }),
    removeChannel: () => {},
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

import { NotificationsDrawer } from "@/components/shared/NotificationsDrawer";

function renderWithProviders() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NotificationsDrawer />
    </QueryClientProvider>
  );
}

describe("NotificationsDrawer", () => {
  it("renders bell button", () => {
    renderWithProviders();
    expect(screen.getByLabelText(/Notificações/)).toBeInTheDocument();
  });

  it("opens drawer and shows empty state", async () => {
    renderWithProviders();
    await userEvent.click(screen.getByLabelText(/Notificações/));
    expect(screen.getByText("Notificações")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma notificação")).toBeInTheDocument();
  });

  it("does not show mark-all-read when empty", async () => {
    renderWithProviders();
    await userEvent.click(screen.getByLabelText(/Notificações/));
    expect(screen.queryByText("Marcar como lidas")).not.toBeInTheDocument();
  });

  it("unmounts without errors", () => {
    const { unmount } = renderWithProviders();
    expect(() => unmount()).not.toThrow();
  });
});
