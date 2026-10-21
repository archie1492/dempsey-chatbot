import { createRoot } from "react-dom/client";
import App from "./App";
import "./chatbot.css";
import { sync } from "./sync";

/**
 * Dempsey Design chatbot loader.
 *
 * Embed on any page with:
 *   <script src=".../dempsey-chatbot.js" defer></script>
 * The stylesheet is resolved next to the script (override with data-css="...").
 * Add data-api="https://api.dempsey-design.com" to save conversations (with consent);
 * without it the assistant works exactly as before and nothing leaves the browser.
 * The bot renders inside a Shadow DOM so site styles and bot styles never collide.
 *
 * In-page panel: if the page has an element with data-dempsey-chat, the assistant
 * renders inside it (open, no launcher bubble) instead of in the corner. Optional:
 *   data-form="<selector>"  an existing form to hide behind a "Prefer a simple form?" link
 *   data-height="640"       panel height in pixels on wider screens
 */
const HOST_ID = "dempsey-chatbot";

const currentScript = document.currentScript as HTMLScriptElement | null;

function resolveCssUrl(): string | null {
  const explicit = currentScript?.dataset.css;
  if (explicit) return explicit;
  const src = currentScript?.src;
  if (!src) return null;
  return src.replace(/\.js(\?.*)?$/, ".css$1");
}

/** Hide the page's own form behind a quiet link under the panel. */
function formFallback(slot: HTMLElement) {
  const sel = slot.dataset.form;
  const form = sel ? document.querySelector<HTMLElement>(sel) : null;
  if (!form) return;
  form.hidden = true;
  form.style.display = "none";
  const link = document.createElement("button");
  link.type = "button";
  link.textContent = "Prefer a simple form?";
  link.style.cssText = "display:inline-block;margin-top:14px;padding:0;background:none;border:0;font:inherit;font-size:14px;color:inherit;text-decoration:underline;text-underline-offset:3px;cursor:pointer;";
  link.addEventListener("click", () => {
    form.hidden = false;
    form.style.display = "";
    link.remove();
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    form.querySelector<HTMLElement>("input:not([type=hidden]), textarea")?.focus({ preventScroll: true });
  });
  slot.insertAdjacentElement("afterend", link);
}

function mount() {
  if (document.getElementById(HOST_ID)) return; // never mount twice
  sync.configure(currentScript?.dataset.api);

  const slot = document.querySelector<HTMLElement>("[data-dempsey-chat]");
  const inline = !!slot;
  const host = document.createElement("div");
  host.id = HOST_ID;
  host.setAttribute("data-lenis-prevent", ""); // let the chat scroll natively under Lenis smooth-scroll
  if (slot) {
    const h = Number(slot.dataset.height) || 640;
    host.style.cssText = `position:relative;width:100%;visibility:hidden;--dd-inline-height:${h}px;`;
    slot.appendChild(host);
    formFallback(slot);
  } else {
    host.style.cssText = "position:relative;z-index:2147483000;visibility:hidden;";
    document.body.appendChild(host);
  }

  const shadow = host.attachShadow({ mode: "open" });

  const cssUrl = resolveCssUrl();
  const reveal = () => { host.style.visibility = "visible"; };
  if (cssUrl) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssUrl;
    link.addEventListener("load", reveal, { once: true });
    link.addEventListener("error", reveal, { once: true });
    shadow.appendChild(link);
    window.setTimeout(reveal, 4000); // fail-safe
  } else {
    reveal();
  }

  const container = document.createElement("div");
  container.className = "dd-root";
  shadow.appendChild(container);

  container.classList.toggle("dd-inline", inline);
  createRoot(container).render(<App inline={inline} />);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount, { once: true });
} else {
  mount();
}
