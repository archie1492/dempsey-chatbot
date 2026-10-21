// Browser tests for conversation quality (Phase 5, Stage C), on the offline harness.
// Needs: python3 -m http.server 4173 (repo root).
import { chromium } from "playwright";
import { makeOpen } from "./browser.mjs";

const results = [];
const ok = (name, pass, info = "") => { results.push({ name, pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${info && !pass ? "  " + info : ""}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const open = makeOpen(browser, "http://localhost:4173/test/harness.html");
const bot = async (b) => (await b.sr.locator(".rcb-bot-message").allInnerTexts()).join("\n");
const chips = async (b) => (await b.sr.locator(".rcb-options:not([style*='cursor: url'])").allInnerTexts()).map((s) => s.trim());

// ── 1. Historic renovation: considered note, scope question ─────────────────
{
  const b = await open();
  await b.say("We're renovating a historic 1920s house in West Palm Beach");
  const last = await b.last();
  ok("historic: note shown", /Historic renovations can involve some interesting design and preservation considerations/.test(last), last);
  ok("historic: scope question", /interior renovation, an addition, or a more comprehensive restoration\?/.test(last), last);
  const c = await chips(b);
  ok("historic: scope chips", ["Interior renovation", "Addition", "Comprehensive restoration", "Not sure yet"].every((x) => c.includes(x)), c.join(" | "));
  ok("acknowledgement: first is 'Thank you. I've noted'", /Thank you\. I've noted/.test(last), last);
  await b.tap("Comprehensive restoration");
  await b.shot("quality-1-historic");

  // ── 2. FAQ mid-flow, then the same question again ─────────────────────────
  const before = await b.last();
  await b.say("How do your fees work?");
  const faq = await b.last();
  ok("FAQ mid-flow: answered and back to the project", /set for each project/.test(faq) && /Back to your project:/.test(faq), faq);
  ok("FAQ mid-flow: same question asked again", before.split(" ").slice(-6).join(" ") === faq.split(" ").slice(-6).join(" "), `${before} || ${faq}`);

  // ── 3. Never 'Noted. I've noted' ──────────────────────────────────────────
  ok("no 'Noted. I've noted' anywhere", !/Noted\. I've noted|Understood\. I've noted/.test(await bot(b)));

  // ── 4. "that's all" ends the questions ────────────────────────────────────
  await b.say("that's all");
  ok("that's all: only contact details now", /just your contact details, then\. Who should we follow up with/.test(await b.last()), await b.last());
  await b.say("Ana Ruiz");
  await b.say("561 555 0101");
  ok("phone: asks whether WhatsApp is fine", /reach you on WhatsApp at that number\?/.test(await b.last()), await b.last());
  await b.tap("Yes, WhatsApp is fine");
  ok("review: WhatsApp and Scope rows shown", /WhatsApp/.test(await b.last() + await bot(b)));
  const review = await b.sr.locator(".dd-review").last().innerText().catch(() => "");
  ok("review: includes Scope and WhatsApp", /Scope/i.test(review) && /WhatsApp/i.test(review), review);
  await b.shot("quality-2-review");
  ok("no JS errors", b.errors.length === 0, b.errors.join(" | "));
  await b.ctx.close();
}

// ── 5. Misses never loop ───────────────────────────────────────────────────
{
  const b = await open();
  await b.tap("Residential");
  await b.say("qwerty asdf");
  ok("miss 1: hint", /didn't quite catch that\. Tap the closest option/.test(await b.last()), await b.last());
  await b.say("zzz zzz");
  const m2 = await b.last();
  ok("miss 2: left for the architect, moves on", /I'll leave that one for the architect/.test(m2) && !/What kind of residential/i.test(m2.split("architect.")[1] ?? ""), m2);
  await b.ctx.close();
}

// ── 6. Classifier fixes ─────────────────────────────────────────────────────
{
  const b = await open();
  await b.say("We need a medical office in Boca Raton");
  ok("medical office recognised", /medical/i.test(await b.last()), await b.last());
  await b.ctx.close();
  const c = await open();
  await c.say("kitchen renovation in Palm Beach Gardens");
  ok("kitchen renovation is residential", /kitchen/i.test(await c.last()) && !/Which of these is closest/.test(await c.last()), await c.last());
  await c.ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
