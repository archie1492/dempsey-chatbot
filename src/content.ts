// Placeholder conversation content for the Phase 1 demo.
// Everything a non-developer may want to edit lives in this one file.

export const STUDIO = {
  name: "Dempsey Design",
  phone: "561-889-0348",
  phoneHref: "tel:+15618890348",
  email: "info@dempsey-design.com",
  bookingUrl: "https://calendly.com/ericjdempsey/30min",
  portfolioUrl: "https://www.dempsey-design.com/portfolio",
  contactUrl: "https://www.dempsey-design.com/contact",
};

export const MAIN_MENU = [
  "Start a project",
  "Our services",
  "Selected work",
  "Speak with an architect",
];

export const PROJECT_TYPES = [
  "Hospitality",
  "Commercial & workplace",
  "Civic & cultural",
  "Wellness",
  "Residential",
  "Something else",
];

export const PROJECT_STAGES = [
  "Early idea",
  "Property identified",
  "Design underway",
  "Ready for permitting",
];

export const SERVICES: Record<string, string> = {
  Architecture:
    "Full architectural services from concept through construction documents — buildings shaped by site, climate, and the people who use them.",
  "Interior design":
    "Interiors developed alongside the architecture, so materials, light, and furnishings read as one considered whole.",
  "Master planning":
    "Site and campus strategies that set out phasing, circulation, and long-term growth before the first building is drawn.",
  "Construction administration":
    "We stay engaged through construction — reviewing submittals, answering RFIs, and protecting design intent on site.",
};

// Keyword routing for free-text input (rule-based, no AI).
export const INTENT_KEYWORDS: Array<{ path: string; words: string[] }> = [
  { path: "architect", words: ["architect", "human", "person", "talk", "speak", "call", "phone", "meet", "consult", "contact", "email"] },
  { path: "fees", words: ["fee", "fees", "cost", "price", "pricing", "budget", "quote", "estimate", "how much"] },
  { path: "services", words: ["service", "services", "interior", "planning", "permit", "construction", "offer"] },
  { path: "work", words: ["portfolio", "work", "projects", "examples", "experience", "past"] },
  { path: "project_type", words: ["project", "build", "new", "renovat", "remodel", "design my", "start", "hire"] },
];

// Location rules for conditional branching.
export const SOUTH_FLORIDA = [
  "palm beach", "west palm", "boca", "delray", "jupiter", "wellington", "boynton", "lake worth",
  "broward", "fort lauderdale", "ft lauderdale", "hollywood", "pompano", "miami", "dade", "sunny isles",
  "golden beach", "aventura", "coral gables", "doral", "hialeah", "homestead", "keys", "south florida",
  "martin county", "stuart", "port st. lucie", "port st lucie",
];

export const LICENSED_STATES = [
  "florida", "fl", "arkansas", "ar", "new york", "ny", "nyc", "washington dc", "washington, dc",
  "district of columbia", "d.c.", "dc", "orlando", "tampa", "jacksonville", "naples", "sarasota",
  "little rock", "fayetteville", "bentonville", "brooklyn", "manhattan",
];
