import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetricCard } from "@/components/shared/MetricCard";
import { Activity } from "lucide-react";

describe("MetricCard", () => {
  it("renders title and value", () => {
    render(<MetricCard title="Total Agents" value={42} icon={Activity} />);
    expect(screen.getByText("Total Agents")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders string value", () => {
    render(<MetricCard title="Cost" value="$12.50" icon={Activity} />);
    expect(screen.getByText("$12.50")).toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    render(<MetricCard title="Agents" value={5} icon={Activity} subtitle="Last 30 days" />);
    expect(screen.getByText("Last 30 days")).toBeInTheDocument();
  });

  it("renders positive trend", () => {
    render(<MetricCard title="Usage" value={100} icon={Activity} trend={{ value: "+12%", positive: true }} />);
    expect(screen.getByText(/\+12%/)).toBeInTheDocument();
    expect(screen.getByText(/↑/)).toBeInTheDocument();
  });

  it("renders negative trend", () => {
    render(<MetricCard title="Errors" value={3} icon={Activity} trend={{ value: "-5%", positive: false }} />);
    expect(screen.getByText(/-5%/)).toBeInTheDocument();
    expect(screen.getByText(/↓/)).toBeInTheDocument();
  });

  it("renders icon with aria-hidden", () => {
    const { container } = render(<MetricCard title="Test" value={0} icon={Activity} />);
    expect(container.querySelector("[aria-hidden='true']")).toBeTruthy();
  });

  it("applies custom className", () => {
    const { container } = render(<MetricCard title="Test" value={0} icon={Activity} className="custom-class" />);
    expect(container.firstChild).toHaveClass("custom-class");
  });
});
