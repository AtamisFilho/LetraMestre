// Global test setup. Loaded by every vitest run via `setupFiles` in
// vitest.config.ts.
//
// 1. jest-dom matchers (toBeInTheDocument, toHaveAttribute, …) — needed by
//    the board-adversarial component tests. Imported for side-effects only.
// 2. RTL auto-cleanup after each test — vitest.config.ts uses `globals: false`
//    so @testing-library/react's auto afterEach() registration (which relies
//    on global `afterEach`) does NOT fire. We wire it explicitly here so every
//    component test file gets cleanup without per-file boilerplate.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
