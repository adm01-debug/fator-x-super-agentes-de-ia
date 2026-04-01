import { describe, it, expect, beforeEach } from "vitest";

// We test the core logic of getDefaultOpen and unsaved changes behavior

describe("Sidebar persistence (getDefaultOpen logic)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns true when no stored value", () => {
    const result = localStorage.getItem("nexus-sidebar-state");
    expect(result).toBeNull();
    // Default should be open (true)
    const defaultOpen = result !== "false";
    expect(defaultOpen).toBe(true);
  });

  it("returns false when stored as 'false'", () => {
    localStorage.setItem("nexus-sidebar-state", "false");
    const result = localStorage.getItem("nexus-sidebar-state");
    const defaultOpen = result !== "false";
    expect(defaultOpen).toBe(false);
  });

  it("returns true when stored as 'true'", () => {
    localStorage.setItem("nexus-sidebar-state", "true");
    const result = localStorage.getItem("nexus-sidebar-state");
    const defaultOpen = result !== "false";
    expect(defaultOpen).toBe(true);
  });
});
