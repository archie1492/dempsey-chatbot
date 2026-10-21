// Browser tests for live chat (Phase 5, Stage B): a visitor and a studio member in two browsers.
// Needs: python3 -m http.server 4173 (repo root), the API on 127.0.0.1:8100, the dd_test database
// with an admin eric@example.com / "correct horse battery" (created by the API tests).
import { chromium } from "playwright";
import { makeOpen, sleep, sql, waitFor } from "./browser.mjs";

const ADMIN = "http://127.0.0.1:8100";
const results = [];
const ok = (name, pass, info = "") => { results.push({ name, pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${info && !pass ? "  " + info : ""}`); };

sql("DELETE FROM conversations; DELETE FROM rate_limits; UPDATE admin_users SET display_name = 'Eric', failed_attempts = 0, locked_until = NULL WHERE email = 'eric@example.com';");
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const open = makeOpen(browser, "http://localhost:4173/test/harness-api.html");

// ── studio member signs in and opens the live-chat page ─────────────────────
const actx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const admin = await actx.newPage();
const adminErrors = [];
admin.on("pageerror", (e) => adminErrors.push(e.message));
admin.on("dialog", (d) => d.accept());
await admin.goto(`${ADMIN}/admin/login`);
await admin.fill("input[name=email]", "eric@example.com");
await admin.fill("input[name=password]", "correct horse battery");
await admin.click("button[type=submit]");
await admin.waitForURL("**/admin");
await admin.goto(`${ADMIN}/admin/live`);
await admin.click("[data-set-available='1']");
ok("dashboard: switched to Available", await waitFor(async () => (await admin.getAttribute("[data-set-available='1']", "aria-pressed")) === "true"));
ok("header pill shows On", await waitFor(async () => (await admin.textContent("[data-live-state]")) === "On"));

const footer = async (b) => { await b.idle(); await b.sr.locator(".dd-architect-btn").click(); await b.page.waitForTimeout(400); await b.idle(); };
const card = (b, label) => b.sr.locator(".dd-card-link", { hasText: label }).last();
const botTexts = async (b) => (await b.sr.locator(".rcb-bot-message, .dd-live-joined, .dd-live-msg").allInnerTexts()).map((t) => t.trim());
const lastLabels = async (b) => (await b.sr.locator(".dd-contact").last().locator(".dd-card-label").allInnerTexts()).map((s) => s.trim());
const waitBot = (b, re, ms = 15000) => waitFor(async () => (await botTexts(b)).some((t) => re.test(t)), ms);

// ── 1. Request → accept → messages both ways → studio ends ──────────────────
{
  const v = await open();
  await v.say("We need a 2,500 sf medical office fit-out in West Palm Beach");
  await footer(v);
  ok("visitor: live option offered while available", await waitFor(async () => (await card(v, "Connect with a live agent").count()) === 1));
  await card(v, "Connect with a live agent").click();
  await v.idle();
  ok("visitor: save notice before live chat", /To hand this over, I'll save/.test(await v.last()));
  await v.tap("Continue");
  ok("visitor: optional email for disconnections", /in case we get disconnected|if we get disconnected/.test(await v.last()));
  await v.say("ana@example.com");
  ok("visitor: waiting message", await waitBot(v, /checking whether someone from the studio is available/));
  await v.shot("live-1-waiting");

  ok("dashboard: request appears with project and countdown", await waitFor(async () => (await admin.locator(".session.status-requested").count()) === 1, 10000));
  ok("dashboard: tab title counts the request", /\(1\) Live chat request/.test(await admin.title()));
  await admin.screenshot({ path: "/tmp/claude-0/shots/live-dash-pending.png" });
  await admin.locator(".session.status-requested button", { hasText: "Accept" }).click();
  ok("dashboard: chat opens with the assistant history and summary", await waitFor(async () => (await admin.locator("[data-transcript] .msg.visitor").count()) >= 1 && (await admin.locator("[data-summary] div").count()) >= 2));

  ok("visitor: sees who joined", await waitBot(v, /Eric from Dempsey Design has joined the chat\./));
  await admin.fill("[data-reply-text]", "Hello, this is Eric. Happy to help with the clinic.");
  await admin.press("[data-reply-text]", "Enter");
  ok("visitor: studio message with name and time", await waitFor(async () => {
    const who = await v.sr.locator(".dd-live-who").allInnerTexts();
    const body = await v.sr.locator(".dd-live-body").allInnerTexts();
    return who.some((w) => /^Eric · \d{1,2}:\d{2}/.test(w)) && body.includes("Hello, this is Eric. Happy to help with the clinic.");
  }));
  await v.say("Thanks Eric — <img src=x onerror=alert(1)> we'd like to start in March.");
  ok("dashboard: visitor message arrives, shown as text", await waitFor(async () => (await admin.locator("[data-transcript] .msg.visitor .body").allInnerTexts()).some((t) => t.includes("<img src=x onerror=alert(1)>"))));
  ok("dashboard: no HTML injected", (await admin.locator("[data-transcript] img").count()) === 0);
  await v.shot("live-2-chatting");
  await admin.screenshot({ path: "/tmp/claude-0/shots/live-dash-chat.png" });
  const liveRows = sql("SELECT CONCAT(sender, ':', channel) FROM messages WHERE seq >= 1000000 ORDER BY seq").split("\n");
  ok("saved: both sides of the live chat, in order", JSON.stringify(liveRows) === JSON.stringify(["studio:live", "visitor:live"]), liveRows.join(","));
  ok("saved: live messages not duplicated in the assistant transcript", sql("SELECT COUNT(*) FROM messages WHERE seq < 1000000 AND body LIKE '%we''d like to start in March%'") === "0");

  await admin.click("[data-end]");
  ok("visitor: told the studio ended it, then offered options", await waitBot(v, /Eric has ended the chat\. It's saved with your inquiry\./) && await waitBot(v, /Anything else\? You can reach the studio here/));
  ok("visitor: no JS errors", v.errors.length === 0, v.errors.join(" | "));
  await v.ctx.close();
}

// ── 2. Nobody answers: the visitor is never left waiting ────────────────────
{
  const v = await open();
  await v.say("Boutique hotel, 40 keys in Delray");
  await footer(v);
  await card(v, "Connect with a live agent").click();
  await v.tap("Continue");
  await v.tap("Skip");
  ok("timeout: waiting", await waitBot(v, /checking whether someone/));
  sql("UPDATE live_sessions SET requested_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 61 SECOND) WHERE status = 'requested'");
  ok("timeout: alternatives offered after 60 seconds", await waitBot(v, /No one from the studio could join just now/, 15000));
  ok("timeout: WhatsApp and email shown, not live chat", await waitFor(async () => JSON.stringify(await lastLabels(v)) === JSON.stringify(["Continue on WhatsApp", "Email the studio", "Call the studio"])));
  await v.shot("live-3-missed");
  await v.ctx.close();
}

// ── 3. Declined, and the visitor ending the chat ────────────────────────────
{
  const v = await open();
  await v.say("Kitchen renovation in our home in Jupiter");
  await v.tap("Yes, save it");
  await footer(v);
  await card(v, "Connect with a live agent").click();
  await v.tap("Skip");
  await waitFor(async () => (await admin.locator(".session.status-requested").count()) === 1, 10000);
  await admin.locator(".session.status-requested button", { hasText: "Decline" }).click();
  ok("decline: visitor offered alternatives (not told 'declined')", await waitBot(v, /No one from the studio could join just now/) && !(await botTexts(v)).some((t) => /declin/i.test(t)));
  await v.ctx.close();

  const w = await open();
  await w.say("Pool house in Wellington");
  await w.tap("Yes, save it");
  await footer(w);
  await card(w, "Connect with a live agent").click();
  await w.tap("Skip");
  await waitFor(async () => (await admin.locator(".session.status-requested").count()) === 1, 10000);
  await admin.locator(".session.status-requested button", { hasText: "Accept" }).click();
  await waitBot(w, /has joined the chat/);
  await w.say("end chat");
  ok("visitor ends the chat: confirmed and saved", await waitBot(w, /You've ended the chat\. It's saved with your inquiry\./));
  ok("dashboard: shows it ended", await waitFor(async () => (await admin.locator("[data-panel-sub]").innerText()).includes("Ended"), 8000));
  await w.ctx.close();
}

// ── 4. Visitor closes the tab mid-chat ──────────────────────────────────────
{
  const v = await open();
  await v.say("Restaurant fit-out in Boca");
  await v.tap("Yes, save it");
  await footer(v);
  await card(v, "Connect with a live agent").click();
  await v.tap("Skip");
  await waitFor(async () => (await admin.locator(".session.status-requested").count()) === 1, 10000);
  await admin.locator(".session.status-requested button", { hasText: "Accept" }).click();
  await waitBot(v, /has joined the chat/);
  await v.ctx.close();
  sql("UPDATE live_sessions SET visitor_seen_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 50 SECOND) WHERE status = 'accepted'");
  ok("dashboard: visitor shown as disconnected", await waitFor(async () => (await admin.locator("[data-panel-sub]").innerText()).includes("disconnected"), 8000));
  sql("UPDATE live_sessions SET visitor_seen_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 6 MINUTE), accepted_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 7 MINUTE) WHERE status = 'accepted'");
  ok("dashboard: chat ends after 5 minutes away, with a follow-up hint", await waitFor(async () => /Ended/.test(await admin.locator("[data-panel-sub]").innerText()), 8000));
}

// ── 5. Unavailable ─────────────────────────────────────────────────────────
await admin.click("[data-set-available='0']");
await waitFor(async () => (await admin.textContent("[data-live-state]")) === "Off");
{
  const v = await open();
  await footer(v);
  ok("unavailable: shown as 'Live Chat — Currently Unavailable'", await waitFor(async () => (await card(v, "Live Chat — Currently Unavailable").count()) === 1));
  await v.ctx.close();
}
ok("dashboard: no JS errors", adminErrors.length === 0, adminErrors.join(" | "));
await actx.close();
await browser.close();
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
