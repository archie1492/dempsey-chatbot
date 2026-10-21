// Shared browser-test helpers (Playwright + the chat widget's Shadow DOM).
import { execFileSync } from "child_process";

export const API = "http://127.0.0.1:8100";
export const sql = (q) => execFileSync("mysql", ["-N", "-B", "dd_test", "-e", q]).toString().trim();
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const waitFor = async (fn, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await sleep(200); } return false; };
export const refIn = (text) => (text.match(/DD-\d{4}-[0-9A-Z]{4}/) || [])[0];

export const makeOpen = (browser, base) => async function open({ ctx: existing, mobile = false, apiMode = "normal" } = {}) {
  const ctx = existing ?? await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1366, height: 900 }, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const errors = [];
  const apiCalls = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|net::ERR|CORS|500/.test(m.text())) errors.push(m.text()); });
  page.on("request", (r) => { if (r.url().startsWith(API)) apiCalls.push(`${r.method()} ${new URL(r.url()).pathname}`); });
  const net = { mode: apiMode };
  await page.route(`${API}/**`, async (route) => {
    if (net.mode === "offline") return route.abort("internetdisconnected");
    if (net.mode === "error") return route.fulfill({ status: 500, contentType: "application/json", body: '{"error":{"code":"server_error","message":"x"}}' });
    if (net.mode === "slow") await sleep(8000);
    return route.continue();
  });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.getElementById("dempsey-chatbot")?.style.visibility === "visible");
  const sr = page.locator("#dempsey-chatbot");
  if (await sr.locator(".rcb-toggle-button").count()) await sr.locator(".rcb-toggle-button").click(); // in-page panel has no launcher
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const bot = {
    page, sr, errors, ctx, apiCalls, net,
    async idle() {
      await page.waitForFunction(() => {
        const r = document.getElementById("dempsey-chatbot").shadowRoot;
        const ta = r.querySelector(".rcb-chat-input-textarea");
        return ta && ta.placeholder === "Type a message…" && !r.querySelector(".rcb-typing-indicator");
      }, null, { timeout: 20000 });
      await page.waitForTimeout(150);
    },
    async say(text) { await this.idle(); const ta = sr.locator(".rcb-chat-input-textarea"); await ta.fill(text); await ta.press("Enter"); await page.waitForTimeout(250); },
    async tap(label) {
      await this.idle();
      const chip = sr.locator(".rcb-options:not([style*='cursor: url'])").filter({ hasText: new RegExp(`^${esc(label)}$`) }).last();
      if (!(await chip.count())) throw new Error(`No "${label}" chip. Last message: ${await this.last()}`);
      await chip.click(); await page.waitForTimeout(250);
    },
    async check(labels) { await this.idle(); for (const l of labels) await sr.locator(".rcb-checkbox-row-container", { hasText: l }).last().click(); await sr.locator(".rcb-checkbox-next-button").last().click(); await page.waitForTimeout(250); },
    async last() { await this.idle(); return (await sr.locator(".rcb-bot-message").last().innerText()).trim(); },
    async shot(name) { await this.idle(); await page.screenshot({ path: `/tmp/claude-0/shots/${name}.png` }); },
  };
  await bot.idle();
  return bot;
}
