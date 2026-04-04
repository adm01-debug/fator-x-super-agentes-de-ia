import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AnimatedCounter } from "@/components/shared/AnimatedCounter";

describe("AnimatedCounter", () => {
  it("renders initial value", () => {
    const { container } = render(<AnimatedCounter value={100} />);
    expect(container.textContent).toContain("100");
  });

  it("renders with prefix and suffix", () => {
    const { container } = render(<AnimatedCounter value={50} prefix="$" suffix=" USD" />);
    expect(container.textContent).toContain("$");
    expect(container.textContent).toContain("USD");
  });

  it("renders with decimals", () => {
    const { container } = render(<AnimatedCounter value={3.14} decimals={2} />);
    expect(container.textContent).toContain("3.14");
  });

  it("applies custom className", () => {
    const { container } = render(<AnimatedCounter value={0} className="my-class" />);
    expect(container.querySelector(".my-class")).toBeTruthy();
  });

  it("renders zero correctly", () => {
    const { container } = render(<AnimatedCounter value={0} />);
    expect(container.textContent).toContain("0");
  });
});
