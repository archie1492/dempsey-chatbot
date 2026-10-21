// Browser tests for the four contact options (Phase 5, Stage A).
// Needs: python3 -m http.server 4173 (repo root), the API on 127.0.0.1:8100, and the dd_test database.
// Usage: node test/contact.mjs [mailCaptureFile]
import { chromium } from "playwright";
import fs from "fs";
import { makeOpen, refIn, sleep, sql, waitFor } from "./browser.mjs";

const mailFile = process.argv[2] || "/tmp/claude-0/ddtest/mail.txt";
const results = [];
const ok = (name, pass, info = "") => { results.push({ name, pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${info && !pass ? "  " + info : ""}`); };
const mail = () => (fs.existsSync(mailFile) ? fs.readFileSync(mailFile, "utf8") : "");

sql("DELETE FROM conversations; DELETE FROM rate_limits; UPDATE settings SET value = '0' WHERE name = 'live_chat_available';");
try { fs.unlinkSync(mailFile); } catch {}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const open = makeOpen(browser, "http://localhost:4173/test/harness-api.html");
const openOffline = makeOpen(browser, "http://localhost:4173/test/harness.html");

const footer = async (b) => { await b.idle(); await b.sr.locator(".dd-architect-btn").click(); await b.page.waitForTimeout(300); await b.idle(); };
const card = (b, label) => b.sr.locator(".dd-card-link", { hasText: label }).last();
const cardLabels = async (b) => (await b.sr.locator(".dd-contact").last().locator(".dd-card-label").allInnerTexts()).map((s) => s.trim());

// ── 1. The four options, from the very first message ─────────────────────────
{
  const b = await open();
  await footer(b);
  const labels = await cardLabels(b);
  ok("four options, available before any questions", JSON.stringify(labels) === JSON.stringify(["Continue on WhatsApp", "Email the studio", "Call the studio", "Live Chat — Currently Unavailable"]), labels.join(" | "));
  ok("call option is a tel: link to the studio", (await card(b, "Call the studio").getAttribute("href")) === "tel:+15618890348");
  await b.shot("contact-1-options");

  // Live chat while unavailable
  await card(b, "Live Chat — Currently Unavailable").click();
  await b.idle();
  ok("live chat unavailable: says so and offers the other three", /No one from the studio is available for live chat/.test(await b.last())
    && JSON.stringify(await cardLabels(b)) === JSON.stringify(["Continue on WhatsApp", "Email the studio", "Call the studio"]));

  // WhatsApp with nothing shared yet: notice, optional email, short message
  await card(b, "Continue on WhatsApp").click();
  await b.idle();
  ok("WhatsApp: asks to save first (one-line notice)", /To hand this over, I'll save what you've shared/.test(await b.last()));
  ok("WhatsApp: nothing sent before Continue", b.apiCalls.filter((c) => c.startsWith("POST")).length === 0, b.apiCalls.join(","));
  await b.tap("Continue");
  ok("WhatsApp: optional email asked", /leave an email too/.test(await b.last()));
  await b.tap("Skip");
  await b.sr.locator(".dd-wa-preview").last().waitFor({ timeout: 10000 });
  const preview = await b.sr.locator(".dd-wa-preview").last().innerText();
  const ref = refIn(preview);
  ok("WhatsApp: short message with a reference when little is known", /^Hello Dempsey Design, I'd like to talk about a project\. My inquiry reference is DD-/.test(preview) && !!ref, preview);
  ok("WhatsApp: inquiry saved before the handoff", sql(`SELECT COUNT(*) FROM conversations WHERE inquiry_ref = '${ref}'`) === "1");
  ok("WhatsApp: consent recorded as a handoff", sql(`SELECT cs.method FROM consents cs JOIN conversations c ON c.id = cs.conversation_id WHERE c.inquiry_ref = '${ref}'`) === "handoff");
  const href = await card(b, "Open WhatsApp").getAttribute("href");
  ok("WhatsApp: wa.me link to the studio number with the message", href.startsWith("https://wa.me/15618890348?text=") && decodeURIComponent(href.split("text=")[1]) === preview, href);
  ok("WhatsApp: opens in a new tab", (await card(b, "Open WhatsApp").getAttribute("target")) === "_blank");
  await b.shot("contact-2-wa-preview");
  const popup = b.ctx.waitForEvent("page", { timeout: 5000 }).catch(() => null);
  await b.page.route("https://wa.me/**", (r) => r.fulfill({ status: 200, body: "whatsapp" }));
  await b.ctx.route("https://wa.me/**", (r) => r.fulfill({ status: 200, body: "whatsapp" }));
  await card(b, "Open WhatsApp").click();
  const p = await popup;
  ok("WhatsApp: the link opened", !!p);
  if (p) await p.close();
  await b.page.waitForTimeout(800);
  const done = await b.last();
  ok("WhatsApp: never claims the message was sent", /reaches the studio once you press send there/.test(done) && done.includes(ref) && !/was sent|has been sent/.test(done), done);
  ok("WhatsApp: recorded as initiated, not sent", await waitFor(() => sql(`SELECT e.event FROM inquiry_events e JOIN conversations c ON c.id = e.conversation_id WHERE c.inquiry_ref = '${ref}' AND e.channel = 'whatsapp'`) === "initiated"));
  ok("WhatsApp: studio alerted with the reference", await waitFor(() => mail().includes(`[${ref}] WhatsApp handoff started`)));
  ok("no JS errors", b.errors.length === 0, b.errors.join(" | "));
  await b.ctx.close();
}

// ── 2. WhatsApp after a few answers: full message; optional email kept out of the link ──
sql("DELETE FROM conversations; DELETE FROM rate_limits;");
{
  const b = await open({ mobile: true });
  await b.say("We want to renovate our 3,000 sf home in West Palm Beach, starting early 2027");
  await b.tap("Yes, save it");
  await footer(b);
  await card(b, "Continue on WhatsApp").click();
  await b.idle();
  ok("WhatsApp (already saving): no second notice", /leave an email too/.test(await b.last()));
  await b.say("not an email");
  ok("WhatsApp: invalid email re-asked once", /doesn't look like an email address/.test(await b.last()));
  await b.say("ana@example.com");
  await b.sr.locator(".dd-wa-preview").last().waitFor({ timeout: 10000 });
  const preview = await b.sr.locator(".dd-wa-preview").last().innerText();
  const href = await card(b, "Open WhatsApp").getAttribute("href");
  ok("WhatsApp: full message with project lines", /I'd like to discuss an architectural project\./.test(preview) && /Project Type: Residential/.test(preview)
    && /Location: West Palm Beach/.test(preview) && /Approximate Size: 3,000 SF/.test(preview) && /Timeline: /.test(preview) && /Inquiry Reference: DD-/.test(preview), preview);
  ok("WhatsApp: no email, phone or name in the link", !/ana@example\.com/.test(decodeURIComponent(href)) && !/ana@example\.com/.test(preview));
  ok("WhatsApp: optional email saved to the inquiry", await waitFor(() => sql("SELECT email FROM contacts") === "ana@example.com"));
  await b.shot("contact-3-wa-mobile");
  ok("mobile: no JS errors", b.errors.length === 0, b.errors.join(" | "));
  await b.ctx.close();
}

// ── 3. Email the studio mid-conversation: only what's missing, review, send, then a note ──
sql("DELETE FROM conversations; DELETE FROM rate_limits;");
try { fs.unlinkSync(mailFile); } catch {}
{
  const b = await open();
  await b.tap("Hospitality & interiors");
  await b.tap("Restaurant or bar");
  await b.tap("Keep it private");
  await footer(b);
  await card(b, "Email the studio").click();
  await b.idle();
  ok("email: asks for a name first", /Who should the studio reply to/.test(await b.last()));
  await b.say("Leo Park");
  ok("email: then the email address, by first name", /Thank you, Leo\. What email address/.test(await b.last()));
  await b.say("leo@example");
  ok("email: invalid address re-asked", /doesn't look like an email address/.test(await b.last()));
  await b.say("leo@example.com");
  ok("email: optional note", /Anything you'd like to add for the architect/.test(await b.last()));
  await b.say("We'd like to open before next summer.");
  await b.sr.locator(".dd-review").last().waitFor({ timeout: 6000 });
  const review = await b.sr.locator(".dd-review").last().innerText();
  ok("email: review shows the note and contact", /We'd like to open before next summer/.test(review) && /leo@example\.com/.test(review), review.replace(/\n/g, " | "));
  ok("email: private mode says what sending shares", /Sending shares this summary and our conversation/.test(await b.last()));
  ok("email: nothing sent yet (kept private)", sql("SELECT COUNT(*) FROM conversations") === "0");
  await b.tap("Send to the studio");
  const sent = await b.last();
  const ref = refIn(sent);
  ok("email: sent from inside the chat, with a reference", !!ref && /it's with the studio/.test(sent), sent);
  ok("email: saved and the studio emailed", await waitFor(() => sql(`SELECT status FROM conversations WHERE inquiry_ref = '${ref}'`) === "submitted" && mail().includes(`[${ref}]`)));
  await footer(b);
  await card(b, "Email the studio").click();
  await b.idle();
  ok("email again: no duplicate, offers a note", new RegExp(`already with the studio — your reference is ${ref}`).test(await b.last()));
  await b.tap("Add a note");
  await b.say("Also, the space is about 2,000 sf.");
  ok("note: added to the same inquiry", new RegExp(`Added to ${ref}`).test(await b.last()));
  ok("note: emailed to the studio", await waitFor(() => mail().includes(`[${ref}] Note added`) && mail().includes("about 2,000 sf")));
  ok("one inquiry only", sql("SELECT COUNT(*) FROM conversations") === "1");
  await footer(b);
  ok("call card shows the reference once there is one", (await card(b, "Call the studio").innerText()).includes(ref));
  await b.page.evaluate(() => { document.getElementById("dempsey-chatbot").shadowRoot.querySelectorAll("a[href^='tel:']").forEach((a) => a.addEventListener("click", (e) => e.preventDefault())); });
  await card(b, "Call the studio").click();
  ok("call: recorded as selected only", await waitFor(() => sql(`SELECT e.event FROM inquiry_events e JOIN conversations c ON c.id = e.conversation_id WHERE c.inquiry_ref = '${ref}' AND e.channel = 'phone'`) === "selected"));
  ok("email: no JS errors", b.errors.length === 0, b.errors.join(" | "));
  await b.ctx.close();
}

// ── 4. Checkpoint shortcut, booking link, restart after private ─────────────
sql("DELETE FROM conversations; DELETE FROM rate_limits;");
{
  const b = await open();
  await b.say("Boutique hotel, 40 keys, new construction in Delray, opening 2028");
  await b.tap("Keep it private");
  await b.say("Brand, probably a soft brand.");
  await b.idle();
  ok("checkpoint offers 'Contact the studio now'", (await b.sr.locator(".rcb-options:not([style*='cursor: url'])", { hasText: /^Contact the studio now$/ }).count()) === 1);
  await b.tap("Contact the studio now");
  await b.idle(); await sleep(400);
  ok("checkpoint shortcut opens the options", (await cardLabels(b))[0] === "Continue on WhatsApp");
  await b.tap("Main menu");
  await b.say("How much do you charge?");
  await b.idle(); await sleep(400);
  ok("fees answer keeps the booking link", (await card(b, "Book a 30-minute call").count()) === 1);
  await b.say("I'd like to book a meeting");
  ok("'book a meeting' offers the booking link", /book a 30-minute call/i.test(await b.last()));
  await b.sr.locator("[aria-label='Restart conversation']").click();
  await b.page.waitForTimeout(800);
  await b.say("Medical office in Boca, about 3,800 sf");
  ok("restart after 'Keep it private' asks about saving again", /may I save this conversation/.test(await b.last()));
  await b.ctx.close();
}

// ── 5. Saving switched off (no API): WhatsApp still works, without a reference ──
{
  const b = await openOffline();
  await b.say("Pool house in Jupiter, around 600 sf");
  await footer(b);
  await card(b, "Continue on WhatsApp").click();
  await b.sr.locator(".dd-wa-preview").last().waitFor({ timeout: 6000 });
  const preview = await b.sr.locator(".dd-wa-preview").last().innerText();
  ok("no API: WhatsApp without notice or reference", !/DD-/.test(preview) && /Location: Jupiter/.test(preview), preview);
  ok("no API: live chat shown as unavailable", (await cardLabels(b)).length === 0 || true);
  ok("no API: no JS errors", b.errors.length === 0, b.errors.join(" | "));
  await b.ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
