import { createLovableConfig } from "lovable-agent-playwright-config/config";

export default createLovableConfig({
  // Visual regression: tolerate anti-aliasing + 1% pixel diff
  expect: {
    toHaveScreenshot: {
      threshold: 0.2,
      maxDiffPixelRatio: 0.01,
      animations: "disabled",
    },
  },
  // Baselines committed under e2e/__screenshots__/
  snapshotPathTemplate: "e2e/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}",
});

