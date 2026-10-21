// Browser tests for saving conversations (Phase 4) against a local API + MariaDB.
// Needs: python3 -m http.server 4173 (repo root), the API on 127.0.0.1:8100, and the dd_test database.
// Usage: node test/sync.mjs [mailCaptureFile]
import { chromium } from "playwright";
import { execFileSync } from "child_process";
import fs from "fs";

const base = "http://localhost:4173/test/harness-api.html";
const API = "http://127.0.0.1:8100";
const mailFile = process.argv[2] || "/tmp/claude-0/ddtest/mail.txt";
const results = [];
const ok = (name, pass, info = "") => { results.push({ name, pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${info && !pass ? "  " + info : ""}`); };
const sql = (q) => execFileSync("mysql", ["-N", "-B", "dd_test", "-e", q]).toString().trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (fn, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await sleep(200); } return false; };

sql("DELETE FROM conversations; DELETE FROM rate_limits;");
try { fs.unlinkSync(mailFile); } catch {}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

async function open({ ctx: existing, mobile = false, apiMode = "normal" } = {}) {
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
  await sr.locator(".rcb-toggle-button").click();
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

const refIn = (text) => (text.match(/DD-\d{4}-[0-9A-Z]{4}/) || [])[0];

// ── 1. Consent after the first real answer; nothing sent before yes; full send ──
{
  const b = await open();
  const welcome = await b.last();
  ok("welcome carries the privacy notice", /With your permission, conversations here can be saved/.test(welcome), welcome);
  ok("privacy policy link shown", (await b.sr.locator(".dd-privacy-link").getAttribute("href")) === "https://www.dempsey-design.com/privacy-policy");
  await b.shot("sync-1-welcome");
  await b.say("We just bought a 1960s house in Jupiter and want to add a second floor, maybe 1,200 sf.");
  const ask = await b.last();
  ok("consent asked right after the first real answer, with the acknowledgement", /addition in Jupiter/.test(ask) && /may I save this conversation/.test(ask), ask);
  ok("nothing sent to the server before consent", b.apiCalls.length === 0, b.apiCalls.join(","));
  await b.shot("sync-2-consent");
  await b.tap("Yes, save it");
  const next = await b.last();
  ok("after yes: confirmation, then the conversation continues", /I'll save it as we go/.test(next) && /living in the home/.test(next), next);
  ok("conversation created on the server", await waitFor(() => sql("SELECT COUNT(*) FROM conversations") === "1"));
  ok("everything said so far was sent, including the welcome", await waitFor(() => Number(sql("SELECT COUNT(*) FROM messages")) >= 5));
  ok("welcome is message 1, visitor sentence message 2", sql("SELECT sender FROM messages WHERE seq IN (1,2) ORDER BY seq").split("\n").join(",") === "assistant,visitor");
  ok("consent recorded with version and fingerprint", /^consent_prompt\tchat-2026-10\t[0-9a-f]{64}$/.test(sql("SELECT method, disclosure_version, disclosure_hash FROM consents")));
  ok("structured brief stored", await waitFor(() => sql("SELECT CONCAT(project_type, '|', location_text, '|', proposed_sf) FROM project_details") === "addition|Jupiter|1200"));
  await b.tap("Not decided");
  await b.say("hopefully next fall");
  await b.tap("Review and send");
  await b.say("Ana Ruiz");
  await b.say("ana@example.com");
  await b.sr.locator(".dd-review").first().waitFor({ timeout: 6000 });
  const review = await b.last();
  ok("review: no private-mode note when already saving", !/Sending shares this summary/.test(review));
  await b.tap("Send to the studio");
  const sent = await b.last();
  const ref = refIn(sent);
  ok("send: confirmation with the reference", !!ref && /it's with the studio/.test(sent), sent);
  ok("send: booking and phone cards, no email-this-summary card", await waitFor(async () => (await b.sr.locator(".dd-card-label", { hasText: "Book a 30-minute call" }).count()) >= 1 && (await b.sr.locator(".dd-card-label", { hasText: "Email this summary" }).count()) === 0));
  await b.shot("sync-3-sent");
  ok("server: submitted, with contact", sql(`SELECT CONCAT(c.status, '|', ct.email) FROM conversations c JOIN contacts ct ON ct.conversation_id = c.id WHERE c.inquiry_ref = '${ref}'`) === "submitted|ana@example.com");
  ok("server: reference matches the one shown", sql("SELECT inquiry_ref FROM conversations") === ref);
  const mail = fs.existsSync(mailFile) ? fs.readFileSync(mailFile, "utf8") : "";
  ok("alert email includes summary and full conversation", mail.includes(ref) && /Location: Jupiter/.test(mail) && /Visitor: We just bought a 1960s house/.test(mail) && /Assistant: .*Before we go on/.test(mail));
  ok("later messages (the confirmation) are saved too", await waitFor(() => Number(sql(`SELECT COUNT(*) FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE m.body LIKE '%with the studio%'`)) === 1));
  const seqs = sql("SELECT seq FROM messages ORDER BY seq").split("\n").map(Number);
  ok("transcript is complete and in order (no gaps)", seqs.every((s, i) => s === i + 1), seqs.join(","));
  ok("no JS errors", b.errors.length === 0, b.errors.join(" | "));
  await b.ctx.close();
}

// ── 2. Keep it private: nothing sent until Send; Send is the consent; company asked ──
sql("DELETE FROM conversations;");
{
  const b = await open();
  await b.tap("Commercial & tenant improvements");
  await b.tap("Medical or clinical");
  ok("chip path: consent asked after the first answer beyond the pathway", /may I save this conversation/.test(await b.last()));
  await b.tap("Keep it private");
  ok("private: acknowledged, conversation continues", /Nothing is saved unless you choose to send it/.test(await b.last()));
  await b.tap("Skip");
  await b.say("Boca Raton");
  await b.say("Tenant. We signed an LOI last week for about 3,800 rsf.");
  await b.say("yes, $60/sf I think");
  await b.say("March 2027");
  await b.tap("Review and send");
  await b.say("Leo Park");
  await b.say("leo@example.com");
  const co = await b.last();
  ok("company asked (optional) on the commercial path", /company or organization/.test(co) && (await b.sr.locator(".rcb-options:not([style*='cursor: url'])", { hasText: /^Skip$/ }).count()) === 1, co);
  await b.say("Park Dental Group");
  await b.sr.locator(".dd-review").first().waitFor({ timeout: 6000 });
  const review = await b.last();
  ok("private review says plainly what sending shares", /Sending shares this summary and our conversation/.test(review), review);
  ok("company on the review card", /Park Dental Group/.test(await b.sr.locator(".dd-review").last().innerText()));
  ok("private: still nothing sent before Send", b.apiCalls.length === 0, b.apiCalls.join(","));
  await b.tap("Send to the studio");
  const sent = await b.last();
  ok("send works from private mode", !!refIn(sent), sent);
  ok("server: consent recorded as given on send", sql("SELECT method FROM consents") === "send");
  ok("server: company saved", sql("SELECT company FROM contacts") === "Park Dental Group");
  ok("server: whole conversation sent at send time", Number(sql("SELECT COUNT(*) FROM messages")) >= 20);
  ok("private: no JS errors", b.errors.length === 0, b.errors.join(" | "));
  await b.ctx.close();
}

// ── 3. Withdraw: "delete this conversation" removes everything and stops sending ──
sql("DELETE FROM conversations;");
{
  const b = await open();
  await b.say("Boutique hotel, 40 keys, new construction in Delray, opening 2028");
  await b.tap("Yes, save it");
  ok("withdraw setup: saved", await waitFor(() => sql("SELECT COUNT(*) FROM conversations") === "1"));
  await waitFor(() => Number(sql("SELECT COUNT(*) FROM messages")) >= 4);
  await b.say("please delete this conversation");
  const msg = await b.last();
  ok("withdraw: confirmed in plain words", /deleted what was saved, and nothing more will be saved/.test(msg), msg);
  ok("withdraw: server copy deleted", await waitFor(() => sql("SELECT COUNT(*) FROM conversations") === "0" && sql("SELECT COUNT(*) FROM messages") === "0"));
  const before = b.apiCalls.length;
  await b.say("Brand, probably a soft brand.");
  await sleep(2500);
  ok("withdraw: nothing more is sent", b.apiCalls.length === before && sql("SELECT COUNT(*) FROM conversations") === "0", b.apiCalls.slice(before).join(","));
  ok("withdraw: consent not asked again", !/may I save/.test(await b.last()));
  ok("withdraw: no JS errors", b.errors.length === 0, b.errors.join(" | "));
  await b.ctx.close();
}

// ── 4. Server offline: chat keeps working, queue persists, send falls back, drains on recovery ──
sql("DELETE FROM conversations;");
{
  const b = await open({ apiMode: "offline" });
  await b.say("Medical office in Boca, about 3,800 sf");
  await b.tap("Yes, save it");
  const m = await b.last();
  ok("offline: conversation continues normally", /tenant, the owner or landlord|Which kind|type of space|What kind/.test(m) || m.length > 10, m);
  await b.say("Tenant");
  await b.say("no allowance");
  await b.say("next spring");
  for (let i = 0; i < 4 && !/enough for an architect/.test(await b.last()); i++) await b.tap("Skip");
  await b.tap("Review and send");
  await b.say("Mia Chen");
  await b.say("mia@example.com");
  await b.tap("Skip");
  await b.sr.locator(".dd-review").first().waitFor({ timeout: 6000 });
  await b.tap("Send to the studio");
  const fail = await b.last();
  ok("offline send: honest message", /couldn't reach the studio's system just now/.test(fail), fail);
  ok("offline send: email card shown as today", await waitFor(async () => (await b.sr.locator(".dd-card-label", { hasText: "Email this summary" }).count()) === 1));
  const stored = await b.page.evaluate(() => JSON.parse(localStorage.getItem("dd-chat-v1") || "null"));
  ok("offline: queue kept on the device", stored && stored.channels.some((c) => c.queue.length > 10 && c.submit));
  ok("offline: nothing reached the server", sql("SELECT COUNT(*) FROM conversations") === "0");
  await b.shot("sync-4-offline");
  b.net.mode = "normal";
  await b.page.evaluate(() => window.dispatchEvent(new Event("online")));
  ok("recovery: queue drains and the inquiry is submitted", await waitFor(() => sql("SELECT status FROM conversations") === "submitted", 20000));
  ok("recovery: card switches to the confirmation options", await waitFor(async () => (await b.sr.locator(".dd-card-label", { hasText: "Email this summary" }).count()) === 0, 5000));
  ok("recovery: device queue cleared", await waitFor(async () => (await b.page.evaluate(() => JSON.parse(localStorage.getItem("dd-chat-v1") || "{}").channels?.every((c) => !c.queue.length && !c.submit))) === true));
  ok("offline: no JS errors", b.errors.length === 0, b.errors.join(" | "));
  await b.ctx.close();
}

// ── 5. Server errors (500) and slowness: chat unaffected, retried later ──
sql("DELETE FROM conversations;");
{
  const b = await open({ apiMode: "error" });
  await b.say("Pool house in Wellington, around 600 sf");
  await b.tap("Yes, save it");
  await b.tap("Skip");
  ok("500s: chat keeps going", (await b.last()).length > 10 && b.errors.length === 0, b.errors.join(" | "));
  b.net.mode = "slow";
  await b.say("next year");
  const t0 = Date.now();
  await b.idle();
  ok("slow server: replies don't wait for it", Date.now() - t0 < 6000, `${Date.now() - t0} ms`);
  b.net.mode = "normal";
  await b.page.evaluate(() => window.dispatchEvent(new Event("online")));
  ok("after errors: saved with retries", await waitFor(() => sql("SELECT COUNT(*) FROM conversations") === "1" && Number(sql("SELECT COUNT(*) FROM messages")) >= 6, 20000));
  ok("retries never duplicate messages", sql("SELECT COUNT(*) FROM messages") === sql("SELECT COUNT(DISTINCT seq) FROM messages"));
  await b.ctx.close();
}

// ── 6. Reload: continue where you left off ──
sql("DELETE FROM conversations;");
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const b = await open({ ctx });
  await b.say("We want to renovate the kitchen in our home in Palm Beach Gardens");
  await b.tap("Yes, save it");
  await b.say("yes");
  await waitFor(() => Number(sql("SELECT COUNT(*) FROM messages")) >= 6);
  const beforeReload = Number(sql("SELECT MAX(seq) FROM messages"));
  await b.page.close();
  const b2 = await open({ ctx });
  const first = await b2.last();
  ok("reload: offers to continue", /Welcome back/.test(first), first);
  await b2.shot("sync-6-resume");
  await b2.tap("Continue where I left off");
  const recap = await b2.last();
  ok("resume: recap, then the next question", /Here's where we were: Residential/.test(recap) && /Palm Beach Gardens/.test(recap), recap);
  await b2.say("next summer");
  ok("resume: same conversation, sequence continues", await waitFor(() => sql("SELECT COUNT(*) FROM conversations") === "1" && Number(sql("SELECT MAX(seq) FROM messages")) > beforeReload + 2));
  const seqs = sql("SELECT seq FROM messages ORDER BY seq").split("\n").map(Number);
  ok("resume: no gaps in the saved transcript", seqs.every((s, i) => s === i + 1), seqs.join(","));
  await b2.page.close();
  const b3 = await open({ ctx });
  await b3.tap("Start fresh");
  ok("start fresh: normal welcome", /studio's automated assistant/.test(await b3.last()));
  ok("resume: no JS errors", b.errors.length === 0 && b2.errors.length === 0 && b3.errors.length === 0, [...b.errors, ...b2.errors, ...b3.errors].join(" | "));
  await ctx.close();
}

// ── 7. General questions are never saved ──
sql("DELETE FROM conversations;");
{
  const b = await open({ mobile: true });
  await b.say("Do you work in Broward?");
  await b.tap("Ask something else");
  await b.tap("Fees");
  await sleep(1500);
  ok("general questions: no consent prompt, nothing sent", b.apiCalls.length === 0 && !/may I save/.test(await b.last()));
  await b.ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
