import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("sonner", () => {
  return {
    toast: {
      error: vi.fn(),
      dismiss: vi.fn(),
      success: vi.fn(),
    },
  };
});

import { toast } from "sonner";
import { useNetworkStatus } from "@/hooks/use-network-status";

describe("useNetworkStatus", () => {
  let addListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    addListenerSpy = vi.spyOn(window, "addEventListener");
    removeListenerSpy = vi.spyOn(window, "removeEventListener");
    Object.defineProperty(navigator, "onLine", { value: true, writable: true, configurable: true });
  });

  afterEach(() => {
    addListenerSpy.mockRestore();
    removeListenerSpy.mockRestore();
  });

  it("registers offline and online event listeners", () => {
    renderHook(() => useNetworkStatus());
    expect(addListenerSpy).toHaveBeenCalledWith("offline", expect.any(Function));
    expect(addListenerSpy).toHaveBeenCalledWith("online", expect.any(Function));
  });

  it("cleans up event listeners on unmount", () => {
    const { unmount } = renderHook(() => useNetworkStatus());
    unmount();
    expect(removeListenerSpy).toHaveBeenCalledWith("offline", expect.any(Function));
    expect(removeListenerSpy).toHaveBeenCalledWith("online", expect.any(Function));
  });

  it("shows error toast when initially offline", () => {
    Object.defineProperty(navigator, "onLine", { value: false, writable: true, configurable: true });
    renderHook(() => useNetworkStatus());
    expect(toast.error).toHaveBeenCalledWith(
      "Sem conexão com a internet",
      expect.objectContaining({ id: "network-offline" })
    );
  });

  it("does not show error toast when initially online", () => {
    renderHook(() => useNetworkStatus());
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows error toast on offline event", () => {
    renderHook(() => useNetworkStatus());
    const offlineHandler = addListenerSpy.mock.calls.find(c => c[0] === "offline")?.[1] as EventListener;
    offlineHandler(new Event("offline"));
    expect(toast.error).toHaveBeenCalledWith(
      "Sem conexão com a internet",
      expect.objectContaining({ id: "network-offline", duration: Infinity })
    );
  });

  it("dismisses offline toast and shows success on online event", () => {
    renderHook(() => useNetworkStatus());
    const onlineHandler = addListenerSpy.mock.calls.find(c => c[0] === "online")?.[1] as EventListener;
    onlineHandler(new Event("online"));
    expect(toast.dismiss).toHaveBeenCalledWith("network-offline");
    expect(toast.success).toHaveBeenCalledWith(
      "Conexão restaurada",
      expect.objectContaining({ id: "network-online" })
    );
  });
});
