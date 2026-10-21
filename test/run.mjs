import { chromium } from "playwright";
const base = process.argv[2] || "http://localhost:4173/test/harness.html";
const out = process.argv[3] || "/tmp/claude-0/shots";
import fs from "fs"; fs.mkdirSync(out, { recursive: true });
const results = []; const ok = (name, pass, info="") => { results.push({ name, pass, info }); console.log(`${pass ? "PASS" : "FAIL"}  ${name} ${info}`); };

async function send(page, ta, text) {
  await page.waitForFunction(el => el.placeholder === "Type a message…", await ta.elementHandle(), { timeout: 10000 });
  await ta.fill(text); await ta.press("Enter");
}
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
async function session(viewport, isMobile, tag) {
  const ctx = await browser.newContext({ viewport, isMobile, hasTouch: isMobile,
    userAgent: isMobile ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" : undefined });
  const page = await ctx.newPage();
  const errors = [];
  page.on("response", r => { if (r.status() >= 400) errors.push("http " + r.status() + " " + r.url()); });
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.goto(base, { waitUntil: "networkidle" });
  const host = page.locator("#dempsey-chatbot");
  await host.waitFor({ state: "attached" });
  await page.waitForFunction(() => document.getElementById("dempsey-chatbot").style.visibility === "visible");
  ok(`[${tag}] host mounted once`, await page.locator("#dempsey-chatbot").count() === 1);
  ok(`[${tag}] site button style untouched`, await page.$eval("#site-btn", b => getComputedStyle(b).fontSize) === "30px");
  const sr = page.locator("#dempsey-chatbot");
  const btn = sr.locator(".rcb-toggle-button");
  ok(`[${tag}] launcher visible`, await btn.isVisible());
  await page.screenshot({ path: `${out}/${tag}-0-closed.png` });
  await btn.click();
  const win = sr.locator(".rcb-chat-window");
  await sr.getByText("or type a question", { exact: false }).waitFor({ timeout: 8000 });
  ok(`[${tag}] opens + welcome identifies automated assistant`, (await sr.locator(".rcb-bot-message").first().innerText()).includes("automated assistant"));
  await sr.locator(".rcb-options", { hasText: "Start a project" }).first().waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${tag}-1-welcome.png` });
  const box = await win.boundingBox();
  ok(`[${tag}] window size`, !!box, JSON.stringify(box));
  ok(`[${tag}] bot button not red (isolation)`, await sr.locator(".dd-architect-btn").evaluate(b => getComputedStyle(b).backgroundColor) !== "rgb(255, 0, 0)");

  // multiple choice + branching path A (Early idea -> feasibility note -> location local)
  await sr.locator(".rcb-options", { hasText: "Start a project" }).first().click();
  await sr.locator(".rcb-options", { hasText: "Hospitality" }).first().click();
  await sr.getByText("Where does the project stand today?", { exact: false }).waitFor();
  await sr.locator(".rcb-options", { hasText: "Early idea" }).first().click();
  await sr.getByText("feasibility study", { exact: false }).waitFor();
  ok(`[${tag}] branch: Early idea -> feasibility note`, true);
  await sr.getByText("Where is the project located?", { exact: false }).waitFor({ timeout: 8000 });
  const ta = sr.locator("textarea, input.rcb-chat-input-textarea").first();
  await send(page, ta, "Delray Beach");
  await sr.getByText("core South Florida service area", { exact: false }).waitFor({ timeout: 8000 });
  ok(`[${tag}] free text + branch: South Florida`, true);
  await sr.getByText("In a sentence or two", { exact: false }).waitFor({ timeout: 8000 });
  await send(page, ta, "Boutique 40-key hotel, opening 2028.");
  await sr.getByText("conversation with an architect", { exact: false }).waitFor({ timeout: 10000 });
  const sum = await sr.locator(".rcb-bot-message", { hasText: "Here's what I have" }).last().innerText();
  ok(`[${tag}] summary captures answers`, sum.includes("Hospitality") && sum.includes("Early idea") && sum.includes("Delray Beach"));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${tag}-2-summary.png` });

  // restart via header button
  await sr.locator(".dd-icon-btn[aria-label='Restart conversation']").click();
  await page.waitForTimeout(1500);
  const n = await sr.locator(".rcb-bot-message").count();
  ok(`[${tag}] restart clears conversation`, n <= 2 && (await sr.locator(".rcb-bot-message").first().innerText()).includes("Welcome"), `bot messages=${n}`);

  // branch path B: other location + licensed
  await sr.locator(".rcb-options", { hasText: "Start a project" }).first().click();
  await sr.locator(".rcb-options", { hasText: "Civic & cultural" }).first().click();
  await sr.locator(".rcb-options", { hasText: "Design underway" }).first().click();
  await sr.getByText("Where is the project located?", { exact: false }).waitFor({ timeout: 8000 });
  const notEarly = await sr.getByText("feasibility study", { exact: false }).count();
  ok(`[${tag}] branch: non-early skips feasibility note`, notEarly === 0);
  await send(page, ta, "Little Rock, Arkansas");
  await sr.getByText("licensed in Florida, Arkansas", { exact: false }).waitFor({ timeout: 8000 });
  ok(`[${tag}] branch: licensed state`, true);

  // keyword routing from free text at menu
  await sr.locator(".dd-icon-btn[aria-label='Restart conversation']").click();
  await page.waitForTimeout(1500);
  await send(page, ta, "how much do your fees cost?");
  await sr.getByText("every proposal is tailored", { exact: false }).waitFor({ timeout: 8000 });
  ok(`[${tag}] free-text keyword routing (fees)`, true);
  await sr.locator(".rcb-options", { hasText: "Back to menu" }).last().click();
  await sr.getByText("What would you like to explore?", { exact: false }).waitFor({ timeout: 8000 });
  await send(page, ta, "asdf qwerty");
  await sr.getByText("rule-based assistant", { exact: false }).waitFor({ timeout: 8000 });
  ok(`[${tag}] unknown text -> fallback`, true);

  // architect button
  await sr.locator(".dd-architect-btn").click();
  await sr.locator(".dd-contact").last().waitFor({ timeout: 8000 });
  const links = await sr.locator(".dd-contact").last().locator("a").evaluateAll(as => as.map(a => a.getAttribute("href")));
  ok(`[${tag}] architect handoff links`, links.length === 3 && links[0].includes("calendly") && links[1].startsWith("mailto:") && links[2].startsWith("tel:"), links.join(" | "));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${tag}-3-architect.png` });

  // close
  await sr.locator("[aria-label='close chat']").first().click();
  await page.waitForTimeout(700);
  ok(`[${tag}] closes`, await win.evaluate(w => getComputedStyle(w).visibility) === "hidden");
  await btn.click(); await page.waitForTimeout(700);
  ok(`[${tag}] reopens with conversation kept`, (await sr.locator(".dd-contact").count()) >= 1);
  ok(`[${tag}] no JS errors`, errors.length === 0, errors.join(" || "));
  await ctx.close();
}
await session({ width: 1366, height: 860 }, false, "desktop");
await session({ width: 390, height: 844 }, true, "mobile");
await browser.close();
const failed = results.filter(r => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
