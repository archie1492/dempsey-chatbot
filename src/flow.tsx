import type { Flow, Params } from "react-chatbotify";
import {
  INTENT_KEYWORDS, LICENSED_STATES, MAIN_MENU, PROJECT_STAGES, PROJECT_TYPES,
  SERVICES, SOUTH_FLORIDA, STUDIO,
} from "./content";
import { ContactCard, LinkCard } from "./components";

type Brief = { type?: string; stage?: string; location?: string; summary?: string };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word / phrase match, case-insensitive (so "ar" never matches "park"). */
export const matchesAny = (text: string, terms: string[]) => {
  const t = ` ${text.toLowerCase().replace(/\s+/g, " ")} `;
  return terms.some((term) => {
    const re = new RegExp(`(^|[^a-z])${escapeRe(term.toLowerCase())}`, "i");
    return re.test(t);
  });
};

/** Route a free-text message to a path using keyword rules. */
export const routeText = (text: string): string => {
  const clean = text.trim();
  if (!clean) return "fallback";
  for (const intent of INTENT_KEYWORDS) {
    if (matchesAny(clean, intent.words)) return intent.path;
  }
  return "fallback";
};

const MENU_ROUTES: Record<string, string> = {
  "Start a project": "project_type",
  "Our services": "services",
  "Selected work": "work",
  "Speak with an architect": "architect",
  "Back to menu": "menu",
  "Start over": "menu",
  "Another service": "services",
};

const routeMenu = (params: Params) =>
  MENU_ROUTES[params.userInput] ?? routeText(params.userInput);

export const buildFlow = (): Flow => {
  // Per-conversation answers (reset whenever the welcome block runs).
  let brief: Brief = {};

  return {
    start: {
      message: () => {
        brief = {};
        return "Welcome to Dempsey Design. I'm the studio's automated assistant — I can help you outline a project, explore our services, or connect you with an architect.\n\nChoose an option below, or type a question.";
      },
      options: MAIN_MENU,
      path: routeMenu,
    },

    menu: {
      message: "What would you like to explore?",
      options: MAIN_MENU,
      path: routeMenu,
    },

    fallback: {
      message:
        "I'm a rule-based assistant, so I'm best with the options below. If your question needs a person, an architect is one tap away.",
      options: MAIN_MENU,
      path: routeMenu,
    },

    // ── Project intake (demonstrates conditional branching) ──────────────
    project_type: {
      message: "Wonderful. What type of project are you considering?",
      options: PROJECT_TYPES,
      chatDisabled: true,
      function: (p: Params) => { brief.type = p.userInput; },
      path: "project_stage",
    },

    project_stage: {
      message: () =>
        `${brief.type === "Something else" ? "Understood" : `${brief.type} — a good fit for the studio`}. Where does the project stand today?`,
      options: PROJECT_STAGES,
      chatDisabled: true,
      function: (p: Params) => { brief.stage = p.userInput; },
      // Branch: early-stage projects get a feasibility note first.
      path: (p: Params) => (p.userInput === "Early idea" ? "project_early" : "project_location"),
    },

    project_early: {
      message:
        "That's an ideal moment to bring in an architect. Early decisions about site, program, and budget shape everything that follows — a short feasibility study is often the right first step.",
      transition: { duration: 1400 },
      chatDisabled: true,
      path: "project_location",
    },

    project_location: {
      message: "Where is the project located? A city, county, or state is fine.",
      function: (p: Params) => { brief.location = p.userInput.trim(); },
      // Branch on free text: South Florida → licensed markets → elsewhere.
      path: (p: Params) => {
        if (matchesAny(p.userInput, SOUTH_FLORIDA)) return "loc_local";
        if (matchesAny(p.userInput, LICENSED_STATES)) return "loc_licensed";
        return "loc_other";
      },
    },

    loc_local: {
      message:
        "Excellent — that's within our core South Florida service area, minutes from our West Palm Beach studio.",
      transition: { duration: 1200 },
      chatDisabled: true,
      path: "project_brief",
    },

    loc_licensed: {
      message:
        "Good news — we're licensed in Florida, Arkansas, New York, and Washington, D.C., so that location is one we can serve directly.",
      transition: { duration: 1200 },
      chatDisabled: true,
      path: "project_brief",
    },

    loc_other: {
      message:
        "That's outside our current licensing footprint (FL, AR, NY, DC), but we regularly collaborate with local architects of record. An architect can walk you through the options.",
      transition: { duration: 1400 },
      chatDisabled: true,
      path: "project_brief",
    },

    project_brief: {
      message:
        "In a sentence or two, tell us about the project — scale, use, timing, or anything that matters to you.",
      function: (p: Params) => { brief.summary = p.userInput.trim(); },
      path: "project_summary",
    },

    project_summary: {
      message: () =>
        [
          "Thank you. Here's what I have:",
          "",
          `• Project type: ${brief.type ?? "—"}`,
          `• Stage: ${brief.stage ?? "—"}`,
          `• Location: ${brief.location ?? "—"}`,
          "",
          "(Demo version — nothing is saved or sent yet.) The quickest next step is a conversation with an architect.",
        ].join("\n"),
      options: ["Speak with an architect", "Start over"],
      chatDisabled: true,
      path: routeMenu,
    },

    // ── Services ─────────────────────────────────────────────────────────
    services: {
      message: "Dempsey Design is a full-service studio. Which area interests you?",
      options: [...Object.keys(SERVICES), "Back to menu"],
      chatDisabled: true,
      path: (p: Params) => (SERVICES[p.userInput] ? "service_detail" : routeMenu(p)),
    },

    service_detail: {
      message: (p: Params) => SERVICES[p.userInput] ?? "",
      options: ["Another service", "Start a project", "Speak with an architect"],
      chatDisabled: true,
      path: routeMenu,
    },

    // ── Work ─────────────────────────────────────────────────────────────
    work: {
      message:
        "Our portfolio spans hospitality, wellness, civic, cultural, and commercial work across South Florida and abroad.",
      component: (
        <LinkCard href={STUDIO.portfolioUrl} label="View the portfolio" sub="dempsey-design.com/portfolio" />
      ),
      options: ["Start a project", "Speak with an architect", "Back to menu"],
      chatDisabled: true,
      path: routeMenu,
    },

    fees: {
      message:
        "Fees depend on scope, scale, and delivery approach, so every proposal is tailored. A brief call with an architect is the fastest route to an accurate number.",
      options: ["Speak with an architect", "Start a project", "Back to menu"],
      chatDisabled: true,
      path: routeMenu,
    },

    // ── Human handoff (links only in Phase 1) ────────────────────────────
    architect: {
      message: "Of course. Choose whichever is easiest and an architect will take it from there:",
      component: <ContactCard />,
      options: ["Back to menu"],
      chatDisabled: true,
      path: routeMenu,
    },
  };
};
