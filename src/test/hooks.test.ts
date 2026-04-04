import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebounce } from "@/hooks/use-debounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("returns initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("hello", 300));
    expect(result.current).toBe("hello");
  });

  it("debounces value updates", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "initial", delay: 300 } }
    );

    expect(result.current).toBe("initial");

    rerender({ value: "updated", delay: 300 });
    expect(result.current).toBe("initial"); // Not yet updated

    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current).toBe("updated");
  });

  it("cancels previous timer on rapid changes", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "a", delay: 500 } }
    );

    rerender({ value: "b", delay: 500 });
    act(() => { vi.advanceTimersByTime(200); });
    rerender({ value: "c", delay: 500 });
    act(() => { vi.advanceTimersByTime(200); });

    // Should still be "a" since no timer completed
    expect(result.current).toBe("a");

    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current).toBe("c"); // Final value after full delay
  });

  it("handles zero delay", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "fast", delay: 0 } }
    );

    rerender({ value: "instant", delay: 0 });
    act(() => { vi.advanceTimersByTime(0); });
    expect(result.current).toBe("instant");
  });

  it("works with numeric values", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 0, delay: 100 } }
    );

    rerender({ value: 42, delay: 100 });
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe(42);
  });

  it("works with object values", () => {
    const obj1 = { key: "a" };
    const obj2 = { key: "b" };
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: obj1, delay: 100 } }
    );

    rerender({ value: obj2, delay: 100 });
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toEqual({ key: "b" });
  });
});
