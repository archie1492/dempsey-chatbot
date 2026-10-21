// Everything the assistant says that isn't a question prompt.
// Question prompts and options live in pathways.ts.
//
// Voice: calm, precise, brief. One or two sentences per message, the question
// last. No exclamation marks, no "Great question". The assistant is "the
// studio's automated assistant" — never an architect, a person or an AI.

export const STUDIO = {
  name: "Dempsey Design",
  phone: "561-889-0348",
  phoneHref: "tel:+15618890348",
  email: "info@dempsey-design.com",
  bookingUrl: "https://calendly.com/ericjdempsey/30min",
  portfolioUrl: "https://www.dempsey-design.com/portfolio",
  contactUrl: "https://www.dempsey-design.com/contact",
};

export const COPY = {
  welcome:
    "Welcome to Dempsey Design. I'm the studio's automated assistant. Tell me a little about your project in your own words, or choose where to start.",
  menu: "What would you like to do?",
  generalMenu: "Of course. Are you an existing client, or do you have a general question?",
  infoMenu: "What would you like to know?",
  fallback: "I didn't quite catch that.",
  fallbackPickOne: "I didn't quite catch that. Which of these is closest?",
  fallbackHuman:
    "I'm a rule-based assistant, so I'm best with the options shown. An architect is one tap away if that's easier.",
  closeCall: "Which of these is closest?",
  checkpoint:
    "That's enough for an architect to begin the conversation. I can send it now, or ask a few short questions that help us prepare.",
  checkpointContinue: "Continue — about a minute",
  checkpointFast: "Review and send",
  review: "Here's what I have. Edit anything that isn't right, then send it to the studio.",
  reviewClient: "Here's the message for the studio. Edit anything that isn't right, then send it.",
  sent:
    "Thank you. To deliver it, choose Email this summary — your email app opens with everything filled in. If you'd rather speak now, book a time or call the studio.",
  architect: "Of course. Choose whichever is easiest and an architect will take it from there:",
  architectWithBrief:
    "Of course. You can send what you've shared so far, or contact an architect directly:",
  reachInvalid:
    "That doesn't look like an email address or a phone number. Could you check it?",
  reachRequired:
    "We'll need an email or phone number to follow up. If you'd rather not share it here, you can contact the studio directly at any time.",
  nameRequired: "A first name is enough.",
  restartNote: "Starting over.",
  editNote: "Updated.",
  skipped: "That's fine.",
};

/** Acknowledgements rotate so the same one never appears twice in a row. */
export const ACKS = ["Thank you.", "Noted.", "Understood."];

/** One-off notes. Each is shown at most once per conversation. */
export const NOTES = {
  southFlorida: "That's within our core South Florida area.",
  licensed:
    "We're licensed in Florida, Arkansas, New York and Washington, D.C., so that's a location we can serve directly.",
  outside:
    "That's outside the states where we're licensed — Florida, Arkansas, New York and Washington, D.C. — but we regularly work alongside local architects of record, so it's still worth a conversation.",
  feasibility:
    "Early conversations about site, program and budget are often the most valuable; a short feasibility study is a common first step.",
  sbe:
    "For reference, Dempsey Design is SBE-certified with the City of West Palm Beach, Palm Beach County and the School District of Palm Beach County.",
  rfq: (details: string) =>
    `I've recorded ${details}. While a solicitation is open, communication usually has to go through the procurement contact it names, so I won't ask about the project here. An architect will confirm whether the studio is responding.`,
  brand: "Brand standards will shape the design, so I've flagged that for the architect.",
  medical: "Clinical space comes with specific requirements, so a few details help.",
};

/** General-question answers. Keys match TOPIC_TERMS in lexicon.ts. */
export const INFO: Record<string, { label: string; answer: string }> = {
  services: {
    label: "Services",
    answer:
      "Dempsey Design provides architecture, interior design, master planning and construction administration — from early feasibility through the end of construction — for hospitality, wellness, civic, cultural, commercial and residential clients.",
  },
  phases: {
    label: "Design phases",
    answer:
      "Most projects move through feasibility and programming, schematic design, design development, construction documents and permitting, then construction administration. The scope of each phase is tailored to the project.",
  },
  fees: {
    // TODO(studio): replace with your own wording on how fees are structured.
    label: "Fees",
    answer:
      "Fees are set for each project once we understand its scope, delivery approach and schedule, so there isn't a single rate to quote here. A short call with an architect is the quickest way to an accurate proposal.",
  },
  areas: {
    label: "Areas served",
    answer:
      "The studio is based in West Palm Beach and works throughout South Florida, and is licensed in Florida, Arkansas, New York and Washington, D.C.",
  },
  permitting: {
    label: "Permitting",
    answer:
      "Permit drawings are part of the construction-documents phase, and the architect stays involved through plan review. Review times vary by jurisdiction; an architect can give you a realistic estimate for yours.",
  },
  portfolio: {
    label: "Portfolio",
    answer: "Selected hospitality, wellness, civic, cultural, commercial and residential work is on the portfolio page.",
  },
  vendors: {
    label: "Consultants, vendors and careers",
    answer: `For consultant, vendor or career inquiries, please email ${STUDIO.email} with a short introduction.`,
  },
};

export const INFO_FOLLOWUPS = ["Ask something else", "Start a project", "Speak with an architect"];

export const ENTRY_CHOICES = [
  { label: "Residential", value: "residential" },
  { label: "Commercial & tenant improvements", value: "commercial" },
  { label: "Hospitality & interiors", value: "hospitality" },
  { label: "Institutional & public", value: "institutional" },
  { label: "Existing client or general question", value: "general" },
] as const;

export const GENERAL_CHOICES = [
  { label: "I'm an existing client", value: "client" },
  { label: "A general question", value: "info" },
  { label: "Consultants, vendors and careers", value: "vendors" },
] as const;

export const SECTOR_LABELS = {
  residential: "Residential",
  commercial: "Commercial & tenant improvements",
  hospitality: "Hospitality & interiors",
  institutional: "Institutional & public",
} as const;
