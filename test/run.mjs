// End-to-end tests in a real browser against test/harness.html.
// Usage: python3 -m http.server 4173 (repo root), then node test/run.mjs [url] [shotsDir]
import { chromium } from "playwright";
import fs from "fs";

const base = process.argv[2] || "http://localhost:4173/test/harness.html";
const out = process.argv[3] || "/tmp/claude-0/shots";
fs.mkdirSync(out, { recursive: true });
const results = [];
const ok = (name, pass, info = "") => { results.push({ name, pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${info && !pass ? "  " + info : ""}`); };

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

async function open(viewport, mobile) {
  const ctx = await browser.newContext({
    viewport, isMobile: mobile, hasTouch: mobile,
    userAgent: mobile ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" : undefined,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.getElementById("dempsey-chatbot")?.style.visibility === "visible");
  const sr = page.locator("#dempsey-chatbot");
  await sr.locator(".rcb-toggle-button").click();
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const bot = {
    page, sr, errors, ctx,
    async idle() {
      await page.waitForFunction(() => {
        const r = document.getElementById("dempsey-chatbot").shadowRoot;
        const ta = r.querySelector(".rcb-chat-input-textarea");
        return ta && ta.placeholder === "Type a message…" && !r.querySelector(".rcb-typing-indicator");
      }, null, { timeout: 15000 });
      await page.waitForTimeout(150);
    },
    async say(text) {
      await this.idle();
      const ta = sr.locator(".rcb-chat-input-textarea");
      await ta.fill(text);
      await ta.press("Enter");
      await page.waitForTimeout(250);
    },
    async tap(label) {
      await this.idle();
      await sr.locator(".rcb-options:not([style*='cursor: url'])").filter({ hasText: new RegExp(`^${esc(label)}$`) }).last().click();
      await page.waitForTimeout(250);
    },
    async check(labels) {
      await this.idle();
      for (const l of labels) await sr.locator(".rcb-checkbox-row-container", { hasText: l }).last().click();
      await sr.locator(".rcb-checkbox-next-button").last().click();
      await page.waitForTimeout(250);
    },
    async last() {
      await this.idle();
      return (await sr.locator(".rcb-bot-message").last().innerText()).trim();
    },
    async all() { return sr.locator(".rcb-chat-body-container").innerText(); },
    async shot(name) { await this.idle(); await page.screenshot({ path: `${out}/${name}.png` }); },
  };
  await bot.idle();
  return bot;
}

const count = (text, needle) => text.split(needle).length - 1;

// ── Residential: one typed sentence, checkpoint, optional, review, edit, send ──
{
  const b = await open({ width: 1366, height: 900 }, false);
  ok("welcome identifies the virtual assistant", (await b.last()).includes("studio's virtual assistant"));
  await b.say("We just bought a 1960s house in Jupiter and want to add a second floor, maybe 1,200 sf.");
  let msg = await b.last();
  ok("residential: acknowledges what was typed", /addition in Jupiter/.test(msg) && /South Florida/.test(msg), msg);
  ok("residential: skips straight to the sector question", /living in the home/.test(msg), msg);
  await b.shot("res-1-ack");
  await b.tap("Not decided");
  ok("residential: timeline asked next", /construction to start/.test(await b.last()));
  await b.say("hopefully next fall");
  ok("residential: checkpoint offered", /enough for an architect/.test(await b.last()));
  await b.tap("Continue — about a minute");
  ok("residential: existing size asked", /how large is the home today/.test(await b.last()));
  await b.say("2,400");
  ok("residential: budget next (size and ownership not re-asked)", /construction budget/.test(await b.last()), await b.last());
  await b.tap("Skip");
  msg = await b.last();
  ok("residential: skip acknowledged, documents next", /That's fine/.test(msg) && /already have/.test(msg), msg);
  await b.shot("res-2-checkboxes");
  await b.check(["Survey"]);
  { const m = await b.last(); ok("residential: special requirements next", /Do any of these apply/.test(m), m); await b.shot("res-2b-after-docs"); }
  await b.check(["Waterfront or flood zone"]);
  ok("residential: contact name", /follow up with/.test(await b.last()));
  await b.say("Ana Ruiz");
  ok("residential: reach asks by first name", /Thank you, Ana/.test(await b.last()));
  await b.say("not telling");
  ok("residential: invalid contact re-asked", /doesn't look like an email/.test(await b.last()));
  await b.say("ana@example.com");
  { await b.sr.locator(".dd-review").first().waitFor({ timeout: 5000 }).catch(() => {}); const n = await b.sr.locator(".dd-review").count(); ok("residential: review card shown", n === 1, `count=${n} last=${await b.last()}`); }
  const review = await b.sr.locator(".dd-review").last().innerText();
  ok("review: contains answers", /Jupiter/.test(review) && /1,200 SF/.test(review) && /Not provided/.test(review) && /ana@example.com/.test(review), review.replace(/\n/g, " | "));
  await b.shot("res-3-review");
  await b.sr.locator(".dd-review-edit[aria-label='Edit Location']").last().click();
  ok("edit: re-asks location", /Where is the project located/.test(await b.last()));
  await b.say("Palm Beach Gardens");
  ok("edit: returns to review with new value", /Updated/.test(await b.last()) && /Palm Beach Gardens/.test(await b.sr.locator(".dd-review").last().innerText()));
  await b.tap("Send to the studio");
  ok("send: email link prefilled", (await b.sr.locator(".dd-contact a").first().getAttribute("href")).startsWith("mailto:info@dempsey-design.com?subject="));
  await b.shot("res-4-sent");
  const all = await b.all();
  ok("no question asked twice", count(all, "Roughly how large is the home today?") === 1 && count(all, "Who should we follow up with?") === 1);
  ok("spent chips are dimmed", (await b.sr.locator(".rcb-options[style*='cursor: url']").count()) > 3);
  ok("residential: no JS errors", b.errors.length === 0, b.errors.join(" | "));
  await b.ctx.close();
}

// ── Commercial tenant ──
{
  const b = await open({ width: 1366, height: 900 }, false);
  await b.tap("Commercial & tenant improvements");
  await b.tap("Medical or clinical");
  ok("commercial: medical note", /Clinical space/.test(await b.last()));
  await b.tap("Skip");
  await b.say("Boca Raton");
  ok("commercial: role", /tenant, the owner or landlord/.test(await b.last()));
  await b.say("Tenant. We signed an LOI last week for about 3,800 rsf.");
  const msg = await b.last();
  ok("commercial: LOI + size captured, TI asked", /LOI signed/.test(msg) && /3,800 SF/.test(msg) && /tenant-improvement allowance/.test(msg), msg);
  await b.say("yes, $60/sf I think");
  ok("commercial: move-in timeline", /move-in or lease-commencement/.test(await b.last()));
  await b.say("March 2027");
  await b.tap("Review and send");
  ok("commercial: fast path to contact", /follow up with/.test(await b.last()));
  ok("commercial: no JS errors", b.errors.length === 0, b.errors.join(" | "));
  await b.ctx.close();
}

// ── Hospitality, mobile ──
{
  const b = await open({ width: 390, height: 844 }, true);
  await b.say("Boutique hotel, 40 keys, new construction in Delray, opening 2028");
  const msg = await b.last();
  ok("hospitality (mobile): one sentence → brand question", /40-key hotel in Delray/.test(msg) && /operator or brand/.test(msg), msg);
  await b.shot("hosp-mobile-1");
  await b.say("Brand, probably a soft brand.");
  const m2 = await b.last();
  ok("hospitality: brand note then checkpoint", /Brand standards/.test(m2) && /enough for an architect/.test(m2), m2);
  const box = await b.sr.locator(".rcb-chat-window").boundingBox();
  ok("mobile: full-screen window", box && box.width === 390 && box.height === 844, JSON.stringify(box));
  ok("hospitality: no JS errors", b.errors.length === 0, b.errors.join(" | "));
  await b.ctx.close();
}

// ── Institutional RFQ ──
{
  const b = await open({ width: 1366, height: 900 }, false);
  await b.tap("Institutional & public");
  await b.tap("School or education");
  ok("institutional: RFQ asked first", /active RFQ or RFP/.test(await b.last()));
  await b.tap("Yes");
  await b.say("RFQ 26-112, due November 14");
  const msg = await b.last();
  ok("institutional: procurement note, straight to contact", /procurement contact/.test(msg) && /follow up with/.test(msg), msg);
  ok("institutional: no JS errors", b.errors.length === 0, b.errors.join(" | "));
  await b.ctx.close();
}

// ── Existing client, general question, commands, fallback ──
{
  const b = await open({ width: 1366, height: 900 }, false);
  await b.say("hi, it's Maria Lopez — we're working with you on the Lake Worth residence and need to move Thursday's site visit");
  const m1 = await b.last();
  ok("client: greeted by name, urgency asked", /Hello, Maria/.test(m1) && /time-sensitive/.test(m1), m1);
  await b.tap("This week");
  ok("client: reach asked", /email or phone/.test(await b.last()));
  await b.say("561-555-0134");
  await b.sr.locator(".dd-review").first().waitFor({ timeout: 5000 });
  const review = await b.sr.locator(".dd-review").last().innerText();
  ok("client: message review", /Lake Worth residence/.test(review) && /site visit/.test(review), review);
  await b.tap("Start over");
  ok("start over: welcome again", /studio's virtual assistant/.test(await b.last()));
  await b.say("Do you work in Broward?");
  ok("general: areas answer", /licensed in Florida, Arkansas, New York/.test(await b.last()));
  await b.tap("Ask something else");
  await b.tap("Fees");
  ok("general: fees answer (no invented structure)", /set for each project/.test(await b.last()));
  await b.say("menu");
  ok("command: menu", /What would you like to do/.test(await b.last()));
  await b.say("asdf qwerty");
  ok("fallback: honest", /didn't quite catch that/.test(await b.last()));
  await b.say("zzzz");
  ok("fallback twice: offers architect", /An architect is one tap away/.test(await b.last()));
  await b.sr.locator(".dd-architect-btn").click();
  await b.idle();
  ok("footer architect: contact options", (await b.sr.locator(".dd-contact").count()) >= 1);
  await b.sr.locator("[aria-label='Restart conversation']").click();
  await b.page.waitForTimeout(800);
  ok("header restart: clears conversation", (await b.sr.locator(".rcb-bot-message").count()) === 1);
  ok("client/general: no JS errors", b.errors.length === 0, b.errors.join(" | "));
  await b.ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
