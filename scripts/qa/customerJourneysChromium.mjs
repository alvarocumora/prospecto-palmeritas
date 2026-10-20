/**
 * GeoCapitals public customer journeys in Chromium.
 *
 * Runs against the REAL TanStack server under test. Does not mock responses,
 * use privileged credentials, issue tickets, accept contracts or submit KYC.
 * Failures write screenshots and diagnostics to the GitHub Actions artifact.
 *
 * Local:
 *   npm run dev -- --host 127.0.0.1 --port 4173
 *   E2E_BASE_URL=http://127.0.0.1:4173 node scripts/qa/customerJourneysChromium.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { chromium } from "playwright";

const root = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";
const output = process.env.E2E_OUTPUT || "artifacts/chromium-customer-journeys";
const results = [];
let failures = 0;
const browser = await chromium.launch({ headless: true });

await fs.mkdir(output, { recursive: true });

const sanitize = (value) => value.replace(/[^a-z0-9-]+/gi, "-").slice(0, 100);
async function snapshot(page, label) {
  const file = path.join(output, sanitize(label) + ".png");
  await page.screenshot({ path: file, fullPage: true, animations: "disabled", timeout: 15000 });
  return file;
}
async function scenario(page, label, fn) {
  const started = performance.now();
  try {
    await fn();
    results.push({ label, result: "passed", durationMs: Math.round(performance.now() - started) });
    console.log("PASS", label);
  } catch (error) {
    failures++;
    const message = String(error?.stack || error).slice(0, 2500);
    results.push({ label, result: "failed", error: message, url: page.url() });
    console.error("FAIL", label, message);
    try { await snapshot(page, "failure-" + label); } catch { /* record failure even if screenshot fails */ }
  }
}
function contextFor(width) {
  return browser.newContext({
    viewport: { width, height: width < 500 ? 844 : 900 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "reduce",
    isMobile: width < 500,
    hasTouch: width < 500,
    locale: "es-CL",
  });
}
async function startAt(page, route) {
  const response = await page.goto(root + route, { waitUntil: "domcontentloaded", timeout: 30000 });
  assert.ok(response && response.status() < 500, "server response must be < 500");
  await page.locator("body").waitFor({ state: "visible" });
}
for (const width of [390, 1440]) {
  const context = await contextFor(width);
  const page = await context.newPage();
  const events = [];
  page.on("pageerror", (err) => events.push({ type: "pageerror", message: err.message.slice(0, 400) }));
  page.on("console", (msg) => { if (msg.type() === "error") events.push({ type: "console", message: msg.text().slice(0, 400) }); });
  const prefix = width === 390 ? "mobile" : "desktop";

  await scenario(page, prefix + "-landing-shows-entry-points", async () => {
    await startAt(page, "/");
    await page.getByRole("heading", { level: 1, name: /De la geología/i }).waitFor({ timeout: 15000 });
    const hero = page.getByRole("link", { name: /Ver proyectos en explotación/i });
    assert.ok(await hero.count(), "investment CTA must be discoverable");
    const sat = page.getByRole("link", { name: /Imágenes satelitales/i }).first();
    assert.equal(new URL(await sat.getAttribute("href"), root).pathname, "/satelital");
    const analysis = page.getByRole("link", { name: /Análisis de datos/i }).first();
    assert.equal(new URL(await analysis.getAttribute("href"), root).pathname, "/terminal");
    await snapshot(page, prefix + "-landing");
  });

  await scenario(page, prefix + "-investment-project-selection", async () => {
    // Follow the actual visitor CTA instead of reloading /#invertir and aborting active SSR requests.
    await page.getByRole("link", { name: /Ver proyectos en explotación/i }).click();
    await page.locator("section#invertir").scrollIntoViewIfNeeded();
    const selection = page.getByRole("button", { name: /Seleccionar Los Verdes/i });
    await selection.waitFor({ timeout: 15000 });
    await selection.click();
    assert.equal(await selection.getAttribute("aria-pressed"), "true");
    const card = page.locator('section#invertir article').filter({ has: selection });
    assert.equal(await card.locator("button a, a button").count(), 0, "no nested interactive controls");
    assert.ok(await card.getByRole("link", { name: /Ver ficha y visor 3D/i }).isVisible());
    await snapshot(page, prefix + "-investment-choice");
  });

  await scenario(page, prefix + "-public-project-terminal", async () => {
    const card = page.locator('section#invertir article').filter({
      has: page.getByRole("button", { name: /Seleccionar Los Verdes/i }),
    });
    // SPA navigation can outlive Playwright click's internal load wait on geospatial pages.
    await card.getByRole("link", { name: /Ver ficha y visor 3D/i }).click({ timeout: 15000, noWaitAfter: true });
    await page.waitForURL(/\/terminal\/losverdes/, { timeout: 20000 });
    await page.getByRole("heading", { level: 1, name: /Los Verdes/i }).waitFor({ timeout: 20000 });
    assert.ok(await page.getByRole("link", { name: "Inicio", exact: true }).isVisible(), "breadcrumb to landing");
    const tabs = page.getByRole("navigation", { name: "Secciones del proyecto" });
    await tabs.getByRole("link", { name: /Satelital|Análisis satelital/i }).click();
    await page.waitForURL(/tab=satelital/, { timeout: 20000 });
    await snapshot(page, prefix + "-satellite-tab");
  });

  await scenario(page, prefix + "-project-map-perspective", async () => {
    const tabs = page.getByRole("navigation", { name: "Secciones del proyecto" });
    await tabs.getByRole("link", { name: /Mapa/i }).click();
    await page.waitForURL(/tab=mapa/, { timeout: 20000 });
    const perspective = page.getByRole("button", { name: /Perspectiva/i }).first();
    await perspective.waitFor({ timeout: 20000 });
    await perspective.click({ noWaitAfter: true });
    await page.waitForURL(/view=3d/, { timeout: 20000 });
    await page.waitForFunction(() =>
      [...document.querySelectorAll("button")].some((button) =>
        button.textContent?.includes("Perspectiva") && button.getAttribute("aria-pressed") === "true"
      ), undefined, { timeout: 8000 });
    assert.equal(await perspective.getAttribute("aria-pressed"), "true");
    await snapshot(page, prefix + "-perspective");
  });

  await scenario(page, prefix + "-guest-cannot-access-portfolio", async () => {
    await startAt(page, "/dashboard/investments");
    await page.waitForURL(/\/auth(?:\?|$)/, { timeout: 12000 });
    assert.ok(!page.url().includes("/dashboard/investments"), "private portfolio must redirect unauthenticated visitors");
    await snapshot(page, prefix + "-auth-gate");
  });

  await scenario(page, prefix + "-investor-registration-context", async () => {
    await startAt(page, "/auth?intent=investor&mode=signup&next=%2Fdashboard%2Finvestments");
    await page.getByRole("heading", { name: /Crea tu cuenta de inversión/i }).waitFor({ timeout: 15000 });
    assert.ok(await page.getByText(/Verificación de identidad requerida/i).isVisible());
    assert.ok(await page.getByRole("button", { name: "Crear cuenta" }).isVisible());
    await snapshot(page, prefix + "-investor-registration");
  });

  await scenario(page, prefix + "-prospecting-customer-entry", async () => {
    await startAt(page, "/catastro");
    await page.getByRole("heading", { level: 1, name: /Catastro minero de Chile/i }).waitFor({ timeout: 15000 });
    const search = page.getByPlaceholder(/Codelco/i);
    assert.ok(await search.isVisible(), "professionals must find concession search without login");
    await search.fill("Codelco");
    assert.ok(await page.getByRole("button", { name: /^Buscar$/i }).isEnabled());
    // Avoid executing live search or modifying customer data in smoke checks.
    await snapshot(page, prefix + "-prospecting");
  });

  await scenario(page, prefix + "-pwa-identity-multi-role", async () => {
    const response = await page.request.get(root + "/manifest.webmanifest");
    assert.equal(response.status(), 200);
    const manifest = await response.json();
    assert.equal(manifest.start_url, "/dashboard");
    assert.ok((manifest.name || "").includes("GeoCapitals"));
    assert.notEqual(manifest.orientation, "portrait");
    const urls = new Set(manifest.shortcuts.map((item) => item.url));
    assert.ok(urls.has("/dashboard/investments") && urls.has("/proyectos"));
  });

  await scenario(page, prefix + "-no-horizontal-overflow", async () => {
    await startAt(page, "/");
    await page.getByRole("heading", { level: 1, name: /De la geología/i }).waitFor({ timeout: 15000 });
    const info = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert.ok(info.scrollWidth <= info.clientWidth + 2, JSON.stringify(info));
  });

  await fs.writeFile(path.join(output, prefix + "-console-events.json"), JSON.stringify(events, null, 2));
  await context.close();
}
await browser.close();
await fs.writeFile(path.join(output, "results.json"), JSON.stringify({ baseUrl: root, failures, results }, null, 2));
console.log(JSON.stringify({ failures, passed: results.length - failures, total: results.length }));
if (failures) process.exitCode = 1;
