import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

function ProblemChild() {
  throw new Error("Test error from ProblemChild");
}

function GoodChild() {
  return <div>All good</div>;
}

describe("ErrorBoundary", () => {
  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <GoodChild />
      </ErrorBoundary>
    );
    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("renders error UI when a child throws", () => {
    // Suppress console.error from React's error boundary logging
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>
    );

    expect(screen.getByText("Algo deu errado")).toBeInTheDocument();
    expect(screen.getByText("Test error from ProblemChild")).toBeInTheDocument();
    expect(screen.getByText("Tentar novamente")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();

    spy.mockRestore();
  });

  it("renders custom fallback when provided", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ProblemChild />
      </ErrorBoundary>
    );

    expect(screen.getByText("Custom fallback")).toBeInTheDocument();
    spy.mockRestore();
  });
});
