// Browser tests for the in-page panel (contact page): data-dempsey-chat slot, form fallback.
// Needs: python3 -m http.server 4173 (repo root) and the API on 127.0.0.1:8100.
import { chromium } from "playwright";
import { makeOpen, sql } from "./browser.mjs";

const results = [];
const ok = (name, pass, info = "") => { results.push({ name, pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${info && !pass ? "  " + info : ""}`); };
sql("DELETE FROM rate_limits; UPDATE settings SET value = '0' WHERE name = 'live_chat_available';");
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const open = makeOpen(browser, "http://localhost:4173/test/harness-inline.html");

for (const mobile of [false, true]) {
  const tag = mobile ? "mobile" : "desktop";
  const b = await open({ mobile });
  const info = await b.page.evaluate(() => {
    const sr = document.getElementById("dempsey-chatbot").shadowRoot;
    const win = sr.querySelector(".rcb-chat-window").getBoundingClientRect();
    return { scrollY, inSlot: !!document.querySelector("[data-dempsey-chat] > #dempsey-chatbot"), launcher: sr.querySelectorAll(".rcb-toggle-button").length,
      close: sr.querySelectorAll(".rcb-close-chat-button, [class*=close-chat]").length, h: win.height, w: win.width, slotW: document.querySelector("[data-dempsey-chat]").getBoundingClientRect().width,
      formHidden: document.querySelector(".contact-form-block").hidden, hosts: document.querySelectorAll("#dempsey-chatbot").length };
  });
  ok(`${tag}: renders inside the page slot, once, with no bubble or close button`, info.inSlot && info.hosts === 1 && info.launcher === 0 && info.close === 0, JSON.stringify(info));
  ok(`${tag}: fills the slot width`, Math.abs(info.w - info.slotW) < 2, JSON.stringify(info));
  ok(`${tag}: sensible height`, mobile ? info.h <= 844 * 0.8 && info.h > 400 : Math.round(info.h) === 620, String(info.h));
  ok(`${tag}: page does not jump on load`, info.scrollY === 0, String(info.scrollY));
  ok(`${tag}: the old form is hidden behind a link`, info.formHidden && (await b.page.getByText("Prefer a simple form?").count()) === 1);
  await b.say("Boutique hotel, 40 keys in Delray");
  await b.idle();
  ok(`${tag}: conversation works in the panel`, /hotel/i.test(await b.last()), await b.last());
  // On phones the footer hides while typing (keyboard open); dismiss the keyboard first.
  await b.page.evaluate(() => document.getElementById("dempsey-chatbot").shadowRoot.activeElement?.blur());
  ok(`${tag}: footer visible once the keyboard is dismissed`, await b.sr.locator(".dd-architect-btn").isVisible());
  await b.sr.locator(".dd-architect-btn").click();
  await b.idle();
  ok(`${tag}: contact options work in the panel`, (await b.sr.locator(".dd-contact").last().locator(".dd-card-label").count()) === 3);
  if (mobile) {
    await b.sr.locator(".rcb-chat-input-textarea").focus();
    ok("mobile: footer hides while typing, input text is 16px (no iOS zoom)", !(await b.sr.locator(".dd-architect-btn").isVisible())
      && (await b.sr.locator(".rcb-chat-input-textarea").evaluate((e) => getComputedStyle(e).fontSize)) === "16px");
    await b.page.evaluate(() => document.getElementById("dempsey-chatbot").shadowRoot.activeElement?.blur());
  }
  if (!mobile) await b.shot("inline-desktop");
  else await b.shot("inline-mobile");
  await b.page.getByText("Prefer a simple form?").click();
  await b.page.waitForTimeout(500);
  ok(`${tag}: link reveals the form and focuses it`, await b.page.evaluate(() => !document.querySelector(".contact-form-block").hidden && document.activeElement?.id === "name"));
  ok(`${tag}: no JS errors`, b.errors.length === 0, b.errors.join(" | "));
  await b.ctx.close();
}

// Pages without a slot keep the corner bubble.
{
  const b = await makeOpen(browser, "http://localhost:4173/test/harness-api.html")();
  ok("other pages: still the corner bubble", (await b.sr.locator(".rcb-toggle-button").count()) === 1);
  await b.ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
