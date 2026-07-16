import { test, expect } from "@playwright/test";

/**
 * Golden-path E2E specs for LetraMestre.
 *
 * (a) and (b) only need the Next.js dev server (Zustand client-side state,
 * no game-server round-trip). (c) needs the game-server on :3003 — it is
 * `test.skip`-ed by default; un-skip when the CI e2e job guarantees the
 * game-server is running (see worklog 5-d §CI).
 */

test.describe("LetraMestre golden path", () => {
  test("home page renders core elements", async ({ page }) => {
    await page.goto("/");
    // H1 brand
    await expect(page.locator("h1")).toHaveText(/LetraMestre/i);
    // 3 primary buttons
    await expect(page.getByRole("button", { name: /Criar Partida/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Entrar em Partida/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Painel Administrativo/ })).toBeVisible();
  });

  test("admin login screen is reachable from home", async ({ page }) => {
    await page.goto("/");
    // Client-side Zustand transition — no network needed.
    await page.getByRole("button", { name: /Painel Administrativo/ }).click();
    await expect(page.getByRole("heading", { name: /Painel Admin/ })).toBeVisible();
    await expect(page.getByLabel(/Usuário/)).toBeVisible();
    await expect(page.getByLabel(/Senha/)).toBeVisible();
  });

  test("creating a game shows a 6-char lobby code", async ({ page }) => {
    // Skipped: requires the game-server on :3003 which playwright.config.ts
    // does NOT start. Un-skip in CI once the e2e job starts the game-server.
    test.skip(true, "requires game-server on :3003 — not started by playwright.config.ts webServer");
  });
});
