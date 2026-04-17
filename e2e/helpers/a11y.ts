/**
 * ═══════════════════════════════════════════════════════════════
 * Runtime A11y assertions via axe-core
 * ═══════════════════════════════════════════════════════════════
 * Complementa Lighthouse (estático) com varredura dinâmica do DOM
 * renderizado. Falha em violations `serious`/`critical`; loga
 * `moderate`/`minor` como warning.
 */
import AxeBuilder from "@axe-core/playwright";
import type { Page, TestInfo } from "@playwright/test";
import { expect } from "@playwright/test";

export interface A11yOptions {
  /** WCAG tags to check. Defaults to wcag2a + wcag2aa + wcag21aa. */
  tags?: string[];
  /** CSS selectors to exclude from scan (e.g. third-party widgets). */
  exclude?: string[];
  /** Fail only on these impact levels. Defaults to ["serious", "critical"]. */
  failOn?: Array<"minor" | "moderate" | "serious" | "critical">;
}

const DEFAULT_TAGS = ["wcag2a", "wcag2aa", "wcag21aa"];
const DEFAULT_FAIL_ON: NonNullable<A11yOptions["failOn"]> = ["serious", "critical"];

export async function expectNoA11yViolations(
  page: Page,
  testInfo?: TestInfo,
  opts: A11yOptions = {},
): Promise<void> {
  const builder = new AxeBuilder({ page }).withTags(opts.tags ?? DEFAULT_TAGS);

  for (const sel of opts.exclude ?? []) {
    builder.exclude(sel);
  }

  const results = await builder.analyze();
  const failOn = new Set(opts.failOn ?? DEFAULT_FAIL_ON);

  const blocking = results.violations.filter((v) => v.impact && failOn.has(v.impact));
  const warnings = results.violations.filter((v) => v.impact && !failOn.has(v.impact));

  if (warnings.length > 0) {
    const summary = warnings
      .map((v) => `  · [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? "" : "s"})`)
      .join("\n");
    // eslint-disable-next-line no-console
    console.warn(`[a11y] ${warnings.length} non-blocking violation(s):\n${summary}`);
  }

  if (testInfo && results.violations.length > 0) {
    await testInfo.attach("axe-violations.json", {
      body: JSON.stringify(results.violations, null, 2),
      contentType: "application/json",
    });
  }

  if (blocking.length > 0) {
    const detail = blocking
      .map(
        (v) =>
          `  · [${v.impact}] ${v.id}: ${v.help}\n    → ${v.helpUrl}\n    Affected nodes (${v.nodes.length}):\n${v.nodes
            .slice(0, 3)
            .map((n) => `      - ${n.target.join(" ")}`)
            .join("\n")}`,
      )
      .join("\n\n");
    expect(
      blocking,
      `Found ${blocking.length} blocking a11y violation(s):\n${detail}`,
    ).toHaveLength(0);
  }
}
