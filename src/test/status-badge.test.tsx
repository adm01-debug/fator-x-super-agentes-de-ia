import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/shared/StatusBadge";

describe("StatusBadge", () => {
  it("renders known status with correct label", () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByRole("status")).toHaveTextContent("Ativo");
  });

  it("renders unknown status with raw value as label", () => {
    render(<StatusBadge status="custom_xyz" />);
    expect(screen.getByRole("status")).toHaveTextContent("custom_xyz");
  });

  it("applies success class for production status", () => {
    const { container } = render(<StatusBadge status="production" />);
    expect(container.querySelector(".nexus-badge-success")).toBeTruthy();
  });

  it("applies danger class for error status", () => {
    const { container } = render(<StatusBadge status="error" />);
    expect(container.querySelector(".nexus-badge-danger")).toBeTruthy();
  });

  it("applies warning class for pending status", () => {
    const { container } = render(<StatusBadge status="pending" />);
    expect(container.querySelector(".nexus-badge-warning")).toBeTruthy();
  });

  it("applies info class for testing status", () => {
    const { container } = render(<StatusBadge status="testing" />);
    expect(container.querySelector(".nexus-badge-info")).toBeTruthy();
  });

  it("applies muted class for draft status", () => {
    const { container } = render(<StatusBadge status="draft" />);
    expect(container.querySelector(".nexus-badge-muted")).toBeTruthy();
  });

  it("renders pulse animation for active statuses", () => {
    const { container } = render(<StatusBadge status="running" />);
    expect(container.querySelector(".animate-glow-pulse")).toBeTruthy();
  });

  it("does not render pulse for non-active statuses", () => {
    const { container } = render(<StatusBadge status="draft" />);
    expect(container.querySelector(".animate-glow-pulse")).toBeNull();
  });

  it("supports md size variant", () => {
    const { container } = render(<StatusBadge status="active" size="md" />);
    const badge = container.querySelector("[role='status']");
    expect(badge?.className).toContain("px-2.5");
  });

  it("renders all danger statuses correctly", () => {
    const dangerStatuses = ["deprecated", "archived", "error", "critical", "failed", "timeout", "disconnected", "disabled", "inactive"];
    for (const status of dangerStatuses) {
      const { container, unmount } = render(<StatusBadge status={status} />);
      expect(container.querySelector(".nexus-badge-danger")).toBeTruthy();
      unmount();
    }
  });
});
