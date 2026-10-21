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

function mount() {
  if (document.getElementById(HOST_ID)) return; // never mount twice
  sync.configure(currentScript?.dataset.api);

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.setAttribute("data-lenis-prevent", ""); // let the chat scroll natively under Lenis smooth-scroll
  host.style.cssText = "position:relative;z-index:2147483000;visibility:hidden;";
  document.body.appendChild(host);

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

  createRoot(container).render(<App />);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount, { once: true });
} else {
  mount();
}
