import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockSubscribe = vi.fn().mockReturnValue({ unsubscribe: vi.fn() });
const mockOn = vi.fn().mockReturnThis();
const mockChannel = vi.fn().mockReturnValue({ on: mockOn, subscribe: mockSubscribe });
const mockRemoveChannel = vi.fn();

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      channel: (...args: any[]) => {
        const { mockChannel: mc } = vi.hoisted(() => ({ mockChannel: null as any }));
        // We can't use hoisted vars inside factory easily, so use a simpler approach
        return {
          on: (...onArgs: any[]) => {
            return {
              on: (...onArgs2: any[]) => {
                return {
                  on: (...onArgs3: any[]) => {
                    return { subscribe: () => ({}) };
                  },
                  subscribe: () => ({}),
                };
              },
              subscribe: () => ({}),
            };
          },
          subscribe: () => ({}),
        };
      },
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
  };
});

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders bell button", () => {
    renderWithProviders();
    expect(screen.getByLabelText(/Notificações/)).toBeInTheDocument();
  });

  it("opens drawer and shows empty state when clicked", async () => {
    renderWithProviders();
    await userEvent.click(screen.getByLabelText(/Notificações/));
    expect(screen.getByText("Notificações")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma notificação")).toBeInTheDocument();
  });

  it("shows 'Marcar como lidas' button is not visible when no notifications", async () => {
    renderWithProviders();
    await userEvent.click(screen.getByLabelText(/Notificações/));
    expect(screen.queryByText("Marcar como lidas")).not.toBeInTheDocument();
  });

  it("renders without crashing on unmount", () => {
    const { unmount } = renderWithProviders();
    expect(() => unmount()).not.toThrow();
  });
});
