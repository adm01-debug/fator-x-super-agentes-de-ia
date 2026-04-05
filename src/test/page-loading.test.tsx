import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PageLoading } from "@/components/shared/PageLoading";

describe("PageLoading", () => {
  it("renders loading indicator with accessible role", () => {
    render(<MemoryRouter><PageLoading /></MemoryRouter>);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Carregando...")).toBeInTheDocument();
  });
});
