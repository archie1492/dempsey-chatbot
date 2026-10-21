// The questions, their order and their options for every pathway.
//
// How the order works: the engine walks QUESTIONS from the top and asks the
// first one that (1) applies to this visitor (`when`) and (2) hasn't been
// answered or skipped. Answers pulled from typed text count as answered, so
// nothing is asked twice. "optional" questions are only asked if the visitor
// chooses to continue at the checkpoint.

import type { Brief, Choice, Question, Sector, SlotId } from "../schema";

// ── helpers ────────────────────────────────────────────────────────────────
const val = (b: Brief, id: SlotId) => b.answers[id]?.value;
export const sectorOf = (b: Brief) => val(b, "sector") as Sector | undefined;
export const typeOf = (b: Brief) => val(b, "projectType") as string | undefined;
const is = (b: Brief, s: Sector) => sectorOf(b) === s;
const typeIn = (b: Brief, ...t: string[]) => t.includes(typeOf(b) ?? "");
const k = (n: number) => n * 1_000;
const M = (n: number) => n * 1_000_000;

const notSure: Choice = { label: "Not sure yet", value: null, keys: ["not sure", "unsure", "don't know", "tbd"] };
const yesNoUnsure: Choice[] = [
  { label: "Yes", value: "yes", keys: ["yes", "yeah", "yep", "correct", "we do", "there is"] },
  { label: "No", value: "no", keys: ["no", "nope", "there isn't", "none"] },
  { label: "Not sure", value: null, keys: ["not sure", "unsure", "don't know"] },
];

// ── project types ──────────────────────────────────────────────────────────
// `noun` is used in acknowledgements: "I've noted an addition in Jupiter…"
export const PROJECT_TYPES: Record<Sector, Array<Choice & { noun: string }>> = {
  residential: [
    { label: "New home", value: "new_home", noun: "a new home" },
    { label: "Addition", value: "addition", noun: "an addition" },
    { label: "Whole-home renovation", value: "renovation", noun: "a whole-home renovation" },
    { label: "Kitchen or bath", value: "kitchen_bath", noun: "a kitchen or bath project" },
    { label: "Condo interior", value: "condo", noun: "a condo interior" },
    { label: "Guest house", value: "guest_house", noun: "a guest house" },
  ],
  commercial: [
    { label: "Office", value: "office", noun: "an office" },
    { label: "Medical or clinical", value: "medical", noun: "a medical or clinical space" },
    { label: "Retail or showroom", value: "retail", noun: "a retail space" },
    { label: "Flex or light industrial", value: "flex", noun: "a flex or industrial space" },
    { label: "New commercial building", value: "new_building", noun: "a new commercial building" },
  ],
  hospitality: [
    { label: "Restaurant or bar", value: "restaurant", noun: "a restaurant or bar" },
    { label: "Hotel or boutique lodging", value: "hotel", noun: "a hotel" },
    { label: "Wellness, spa or fitness", value: "wellness", noun: "a wellness space" },
    { label: "Club or event venue", value: "venue", noun: "a club or event venue" },
    { label: "Refresh of an existing venue", value: "refresh", noun: "a refresh of an existing venue" },
  ],
  institutional: [
    { label: "Municipal or county", value: "municipal", noun: "a municipal project" },
    { label: "School or education", value: "school", noun: "an education project" },
    { label: "Cultural, museum or library", value: "cultural", noun: "a cultural project" },
    { label: "Faith-based", value: "faith", noun: "a faith-based project" },
    { label: "Nonprofit or community", value: "nonprofit", noun: "a community project" },
  ],
};

// ── numeric bands ──────────────────────────────────────────────────────────
const band = (label: string, min: number, max: number): Choice => ({ label, value: label, min, max });

export const BUDGET_BANDS = (b: Brief): Choice[] => {
  if (is(b, "residential") && typeIn(b, "kitchen_bath"))
    return [band("Under $50K", 0, k(50)), band("$50–150K", k(50), k(150)), band("$150–300K", k(150), k(300)), band("$300K+", k(300), Infinity), notSure];
  switch (sectorOf(b)) {
    case "commercial":
      return [band("Under $150K", 0, k(150)), band("$150–500K", k(150), k(500)), band("$500K–1M", k(500), M(1)), band("$1–5M", M(1), M(5)), band("$5M+", M(5), Infinity), notSure];
    case "hospitality":
      return [band("Under $250K", 0, k(250)), band("$250K–1M", k(250), M(1)), band("$1–3M", M(1), M(3)), band("$3–10M", M(3), M(10)), band("$10M+", M(10), Infinity), notSure];
    case "institutional":
      return [band("Under $500K", 0, k(500)), band("$500K–2M", k(500), M(2)), band("$2–10M", M(2), M(10)), band("$10M+", M(10), Infinity), { label: "Not yet set", value: null, keys: ["not set", "not yet", "tbd", "unknown"] }];
    default:
      return [band("Under $250K", 0, k(250)), band("$250–500K", k(250), k(500)), band("$500K–1M", k(500), M(1)), band("$1–3M", M(1), M(3)), band("$3M+", M(3), Infinity), notSure];
  }
};

const AREA_HOME = [band("Under 1,500 SF", 0, 1500), band("1,500–3,000 SF", 1500, 3000), band("3,000–5,000 SF", 3000, 5000), band("5,000+ SF", 5000, Infinity)];
const AREA_ADDITION = [band("Under 500 SF", 0, 500), band("500–1,000 SF", 500, 1000), band("1,000–2,000 SF", 1000, 2000), band("2,000+ SF", 2000, Infinity)];
const AREA_COMMERCIAL = [band("Under 2,500 SF", 0, 2500), band("2,500–5,000 SF", 2500, 5000), band("5,000–15,000 SF", 5000, 15000), band("15,000+ SF", 15000, Infinity)];
const AREA_HOSPITALITY = [band("Under 2,000 SF", 0, 2000), band("2,000–5,000 SF", 2000, 5000), band("5,000–15,000 SF", 5000, 15000), band("15,000+ SF", 15000, Infinity)];
const AREA_INSTITUTIONAL = [band("Under 5,000 SF", 0, 5000), band("5,000–20,000 SF", 5000, 20000), band("20,000–60,000 SF", 20000, 60000), band("60,000+ SF", 60000, Infinity)];
const SEATS = [band("Under 50", 0, 50), band("50–120", 50, 120), band("120–250", 120, 250), band("250+", 250, Infinity)];
const KEYS = [band("Under 30", 0, 30), band("30–80", 30, 80), band("80–150", 80, 150), band("150+", 150, Infinity)];

export const AREA_BANDS: Record<string, Choice[]> = {
  home: AREA_HOME, addition: AREA_ADDITION, commercial: AREA_COMMERCIAL,
  hospitality: AREA_HOSPITALITY, institutional: AREA_INSTITUTIONAL, seats: SEATS, keys: KEYS,
};

// ── shared option sets ─────────────────────────────────────────────────────
const TIMELINE_DEFAULT: Choice[] = [
  { label: "Within 6 months", value: "Within 6 months", keys: ["soon", "asap", "immediately", "right away"] },
  { label: "6–12 months", value: "6–12 months", keys: ["this year", "within a year"] },
  { label: "More than a year", value: "More than a year", keys: ["next year", "a year or more", "later"] },
  notSure,
];
const TIMELINE_OPENING: Choice[] = [
  { label: "Within a year", value: "Within a year" },
  { label: "1–2 years", value: "1–2 years" },
  { label: "More than 2 years", value: "More than 2 years" },
  { label: "Not set yet", value: null, keys: ["not set", "not sure", "tbd"] },
];

export const SITE_STATUS: Record<Sector, Choice[]> = {
  residential: [
    { label: "Own", value: "owned", keys: ["yes", "we do", "i do", "own it", "owned"] },
    { label: "Under contract", value: "under_contract", keys: ["contract", "closing"] },
    { label: "Still looking", value: "searching", keys: ["no", "looking", "searching", "not yet"] },
  ],
  commercial: [
    { label: "Leased", value: "leased", keys: ["lease", "signed"] },
    { label: "LOI signed", value: "loi", keys: ["loi", "letter of intent"] },
    { label: "Owned", value: "owned", keys: ["own", "we own"] },
    { label: "Still searching", value: "searching", keys: ["looking", "searching", "not yet", "no"] },
  ],
  hospitality: [
    { label: "Leased", value: "leased", keys: ["lease", "signed"] },
    { label: "LOI signed", value: "loi", keys: ["loi", "letter of intent"] },
    { label: "Owned", value: "owned", keys: ["own", "we own"] },
    { label: "Still searching", value: "searching", keys: ["looking", "searching", "not yet", "no"] },
  ],
  institutional: [
    { label: "Owned by the organization", value: "owned", keys: ["yes", "own", "we do", "owned"] },
    { label: "Leased", value: "leased", keys: ["lease"] },
    { label: "Site not yet chosen", value: "searching", keys: ["no", "not yet", "looking", "searching"] },
  ],
};

export const SITE_STATUS_LABELS: Record<string, string> = {
  owned: "Owned", under_contract: "Under contract", loi: "LOI signed", leased: "Leased",
  negotiating: "Lease in negotiation", searching: "Still looking",
};

const NONE = (label = "None of these"): Choice => ({ label, value: "none" });

export const DOCUMENTS: Record<Sector, Choice[]> = {
  residential: [
    { label: "Survey", value: "survey" }, { label: "Existing drawings", value: "drawings" },
    { label: "HOA or condo guidelines", value: "hoa_guidelines" }, { label: "Photos", value: "photos" }, NONE("None yet"),
  ],
  commercial: [
    { label: "Landlord base-building drawings", value: "base_building" }, { label: "Work letter", value: "work_letter" },
    { label: "As-builts", value: "drawings" }, { label: "Survey", value: "survey" }, NONE("None yet"),
  ],
  hospitality: [
    { label: "Existing drawings", value: "drawings" }, { label: "Landlord criteria", value: "landlord_criteria" },
    { label: "Brand standards", value: "brand_standards" }, { label: "Photos", value: "photos" }, NONE("None yet"),
  ],
  institutional: [
    { label: "Facility assessment", value: "facility_assessment" }, { label: "Prior studies", value: "prior_studies" },
    { label: "As-builts", value: "drawings" }, { label: "Survey", value: "survey" }, NONE("None yet"),
  ],
};

export const SPECIAL: (b: Brief) => Choice[] = (b) => {
  switch (sectorOf(b)) {
    case "commercial":
      return [
        { label: "Occupied during work", value: "occupied" }, { label: "ADA upgrades", value: "ada" },
        { label: "Change of use", value: "change_of_use" },
        ...(typeIn(b, "medical") ? [{ label: "Imaging, procedure rooms or medical gas", value: "medical_equipment" }] : []),
        NONE(),
      ];
    case "hospitality":
      return [
        { label: "Commercial kitchen", value: "kitchen" }, { label: "Outdoor seating", value: "outdoor" },
        { label: "Acoustics", value: "acoustics" }, { label: "Phasing while open", value: "phasing" }, NONE(),
      ];
    case "institutional":
      return [
        { label: "Phased or occupied", value: "phasing" }, { label: "Historic", value: "historic" },
        { label: "Hurricane hardening and resilience", value: "resilience" },
        { label: "Community engagement", value: "engagement" }, NONE(),
      ];
    default:
      return [
        { label: "Waterfront or flood zone", value: "flood_zone" }, { label: "Historic district", value: "historic" },
        { label: "Accessibility or aging in place", value: "accessibility" },
        { label: "Sustainability", value: "sustainability" }, NONE(),
      ];
  }
};

/** Labels for every special-requirement and document value, for the summary. */
export const OPTION_LABELS: Record<string, string> = {
  flood_zone: "Waterfront or flood zone", historic: "Historic", accessibility: "Accessibility or aging in place",
  sustainability: "Sustainability", occupied: "Occupied during work", ada: "ADA upgrades",
  change_of_use: "Change of use", medical_equipment: "Imaging, procedure rooms or medical gas",
  kitchen: "Commercial kitchen", outdoor: "Outdoor seating", acoustics: "Acoustics",
  phasing: "Phasing", resilience: "Hurricane hardening and resilience", engagement: "Community engagement",
  survey: "Survey", drawings: "Existing drawings or as-builts", hoa_guidelines: "HOA or condo guidelines",
  photos: "Photos", base_building: "Base-building drawings", work_letter: "Work letter",
  brand_standards: "Brand standards", landlord_criteria: "Landlord criteria",
  facility_assessment: "Facility assessment", prior_studies: "Prior studies",
};

// ── the questions, in order ────────────────────────────────────────────────
export interface Q extends Question {
  /** Unique key (several questions may fill the same slot). */
  key: string;
}

export const QUESTIONS: Q[] = [
  {
    key: "sector", id: "sector", stage: "entry", mode: "choice", skippable: false,
    prompt: () => "Which kind of project is it?",
    choices: () => [
      { label: "Residential", value: "residential", keys: ["home", "house", "residential"] },
      { label: "Commercial & tenant improvements", value: "commercial", keys: ["commercial", "office", "tenant"] },
      { label: "Hospitality & interiors", value: "hospitality", keys: ["hospitality", "hotel", "restaurant", "interiors"] },
      { label: "Institutional & public", value: "institutional", keys: ["institutional", "public", "civic", "school", "church"] },
    ],
  },
  {
    key: "projectType", id: "projectType", stage: "core", mode: "choice",
    prompt: (b) => ({
      residential: "What kind of residential project is it?",
      commercial: "What kind of space is it?",
      hospitality: "What kind of venue is it?",
      institutional: "What kind of organization is this for?",
    })[sectorOf(b) ?? "residential"],
    choices: (b) => PROJECT_TYPES[sectorOf(b) ?? "residential"],
    after: (b) => (typeOf(b) === "medical" ? "medical" : undefined),
  },
  // institutional: an open solicitation changes everything after it
  {
    key: "solicitation", id: "solicitation", stage: "core", mode: "choice",
    when: (b) => is(b, "institutional"),
    prompt: () => "Is there an active RFQ or RFP for this project?",
    choices: () => yesNoUnsure,
  },
  {
    key: "solicitationDetails", id: "solicitationDetails", stage: "core", mode: "text",
    when: (b) => is(b, "institutional") && val(b, "solicitation") === "yes",
    prompt: () => "What's the solicitation number and due date?",
  },
  {
    key: "description", id: "description", stage: "core", mode: "text",
    prompt: () => "In a sentence or two, tell me about it in your own words — what you'd like to do and anything that matters to you.",
  },
  {
    key: "location", id: "location", stage: "core", mode: "location",
    prompt: () => "Where is the project located? A city, county or ZIP code is fine.",
  },

  // residential
  {
    key: "workScope", id: "workScope", stage: "core", mode: "choice",
    when: (b) => is(b, "residential") && (typeIn(b, "renovation") || (b.shown.includes("ctx:historic") && !typeIn(b, "new_home", "addition", "guest_house", "kitchen_bath", "condo"))),
    prompt: (b) => b.shown.includes("ctx:historic")
      ? "Is your project primarily an interior renovation, an addition, or a more comprehensive restoration?"
      : "Is it primarily an interior renovation, an addition, or a more comprehensive restoration?",
    choices: () => [
      { label: "Interior renovation", value: "interior", keys: ["interior", "inside", "interiors", "kitchen", "bathrooms"] },
      { label: "Addition", value: "addition", keys: ["addition", "add on", "add-on", "expand", "second floor", "extension"] },
      { label: "Comprehensive restoration", value: "restoration", keys: ["restoration", "restore", "comprehensive", "everything", "full", "whole house", "gut"] },
      { label: "Not sure yet", value: null, keys: ["not sure", "unsure"] },
    ],
  },
  {
    key: "occupied", id: "occupied", stage: "core", mode: "choice",
    when: (b) => is(b, "residential") && typeIn(b, "renovation", "addition", "kitchen_bath"),
    prompt: () => "Will you be living in the home during construction?",
    choices: () => [
      { label: "Yes", value: "yes", keys: ["yes", "we will", "living there"] },
      { label: "No", value: "no", keys: ["no", "moving out", "won't"] },
      { label: "Not decided", value: null, keys: ["not sure", "undecided", "maybe"] },
    ],
  },
  {
    key: "hoa", id: "hoa", stage: "core", mode: "choice",
    when: (b) => is(b, "residential") && typeIn(b, "condo"),
    prompt: () => "Does the condo association have its own approval process for renovations?",
    choices: () => yesNoUnsure,
  },

  // commercial
  {
    key: "role", id: "role", stage: "core", mode: "choice",
    when: (b) => is(b, "commercial"),
    prompt: () => "Are you the tenant, the owner or landlord, or a broker?",
    choices: () => [
      { label: "Tenant", value: "tenant", keys: ["tenant", "leasing", "we lease", "renting"] },
      { label: "Owner or landlord", value: "owner", keys: ["owner", "landlord", "we own", "own the building"] },
      { label: "Broker", value: "broker", keys: ["broker", "agent", "representing"] },
    ],
  },
  {
    key: "leaseStatus", id: "siteStatus", stage: "core", mode: "choice",
    when: (b) => is(b, "commercial") && val(b, "role") === "tenant",
    prompt: () => "Where does the lease stand?",
    choices: () => [
      { label: "LOI signed", value: "loi", keys: ["loi", "letter of intent"] },
      { label: "Lease signed", value: "leased", keys: ["signed", "executed"] },
      { label: "Negotiating", value: "negotiating", keys: ["negotiat*"] },
      { label: "Still searching", value: "searching", keys: ["looking", "searching", "not yet"] },
    ],
  },
  {
    key: "tiAllowance", id: "tiAllowance", stage: "core", mode: "choice",
    when: (b) => is(b, "commercial") && val(b, "role") === "tenant" && ["loi", "leased", "negotiating"].includes(String(val(b, "siteStatus"))),
    prompt: (b) => `Does the ${val(b, "siteStatus") === "leased" ? "lease" : "LOI"} include a tenant-improvement allowance?`,
    choices: () => yesNoUnsure,
  },
  {
    key: "suites", id: "suites", stage: "core", mode: "choice",
    when: (b) => is(b, "commercial") && ["owner", "broker"].includes(String(val(b, "role"))),
    prompt: () => "How many suites or spaces are involved?",
    choices: () => [
      { label: "One", value: "1", keys: ["one", "single", "1"] },
      { label: "2–5", value: "2–5", keys: ["two", "three", "four", "five", "a few"] },
      { label: "6 or more", value: "6+", keys: ["six", "many", "whole building", "entire building"] },
    ],
  },

  // hospitality
  {
    key: "brand", id: "brand", stage: "core", mode: "choice",
    when: (b) => is(b, "hospitality") && !typeIn(b, "refresh"),
    prompt: () => "Is this an independent concept, or will an operator or brand be involved?",
    choices: () => [
      { label: "Independent", value: "independent", keys: ["independent", "our own", "own concept"] },
      { label: "Operator or brand", value: "brand", keys: ["brand", "brands", "operator", "flag", "franchise", "soft brand", "marriott", "hilton", "hyatt", "ihg"] },
      { label: "Not decided", value: null, keys: ["not sure", "undecided", "tbd"] },
    ],
    after: (b) => (val(b, "brand") === "brand" ? "brand" : undefined),
  },
  {
    key: "secondGen", id: "secondGen", stage: "core", mode: "choice",
    when: (b) => is(b, "hospitality") && typeIn(b, "restaurant"),
    prompt: () => "Is it a former restaurant space, with a hood and grease trap already in place?",
    choices: () => [
      { label: "Yes", value: "yes", keys: ["yes", "second generation", "second-gen", "former restaurant"] },
      { label: "No", value: "no", keys: ["no", "raw space", "vanilla shell", "cold dark shell", "shell"] },
      { label: "New construction", value: "new", keys: ["new construction", "ground up", "new building"] },
    ],
  },
  {
    key: "keys", id: "keys", stage: "core", mode: "count",
    when: (b) => is(b, "hospitality") && typeIn(b, "hotel"),
    prompt: () => "How many keys are you planning?",
    choices: () => KEYS,
  },
  {
    key: "workType", id: "workType", stage: "core", mode: "choice",
    when: (b) => is(b, "hospitality") && typeIn(b, "hotel", "wellness", "venue"),
    prompt: () => "Is this new construction, or work within an existing building?",
    choices: () => [
      { label: "New construction", value: "new", keys: ["new construction", "ground up", "new build", "new building"] },
      { label: "Existing building", value: "existing", keys: ["existing", "conversion", "renovat*", "adaptive reuse"] },
      { label: "Not decided", value: null, keys: ["not sure", "undecided"] },
    ],
  },

  // institutional
  {
    key: "stage", id: "stage", stage: "core", mode: "choice",
    when: (b) => is(b, "institutional") && val(b, "solicitation") !== "yes",
    prompt: () => "Where is the project now?",
    choices: () => [
      { label: "Needs assessment", value: "needs_assessment", keys: ["assessment", "early", "idea", "exploring"] },
      { label: "Programming", value: "programming", keys: ["programming", "program"] },
      { label: "Funding identified", value: "funded", keys: ["funding identified", "funded", "budget approved"] },
      { label: "Ready for design", value: "ready", keys: ["ready", "design"] },
    ],
  },
  {
    key: "funding", id: "funding", stage: "core", mode: "choice",
    when: (b) => is(b, "institutional") && val(b, "solicitation") !== "yes",
    prompt: () => "How is it funded?",
    choices: () => [
      { label: "Approved", value: "approved", keys: ["approved", "funded", "allocated", "budgeted"] },
      { label: "Grant or bond pending", value: "pending", keys: ["grant", "bond", "pending", "applied"] },
      { label: "Fundraising", value: "fundraising", keys: ["fundraising", "capital campaign", "donations", "raising"] },
      { label: "Not yet", value: "none", keys: ["not yet", "no", "none", "unfunded"] },
    ],
  },

  // timeline (all project paths)
  {
    key: "timeline", id: "timeline", stage: "core", mode: "timeline",
    prompt: (b) => {
      if (is(b, "hospitality")) return "What's the target opening date?";
      if (is(b, "commercial") && val(b, "role") === "tenant") return "Is there a target move-in or lease-commencement date?";
      if (is(b, "institutional")) return "When does the project need to start?";
      return "When would you like construction to start?";
    },
    choices: (b) => (is(b, "hospitality") ? TIMELINE_OPENING : TIMELINE_DEFAULT),
  },

  // ── optional: only after "Continue" at the checkpoint ──
  {
    key: "existingSf", id: "existingSf", stage: "optional", mode: "area",
    when: (b) => is(b, "residential") && typeIn(b, "renovation", "addition", "kitchen_bath", "condo"),
    prompt: (b) => (typeIn(b, "condo") ? "Roughly how large is the unit?" : "Roughly how large is the home today?"),
    choices: () => AREA_HOME,
  },
  {
    key: "proposedSf", id: "proposedSf", stage: "optional", mode: "area",
    when: (b) => is(b, "residential") && typeIn(b, "new_home", "addition", "guest_house"),
    prompt: (b) =>
      typeIn(b, "addition") ? "About how much space would the addition add?"
        : typeIn(b, "guest_house") ? "Roughly how large would the guest house be?"
          : "Roughly how large a home do you have in mind?",
    choices: (b) => (typeIn(b, "addition", "guest_house") ? AREA_ADDITION : AREA_HOME),
  },
  {
    key: "seats", id: "seats", stage: "optional", mode: "count",
    when: (b) => is(b, "hospitality") && typeIn(b, "restaurant"),
    prompt: () => "About how many seats?",
    choices: () => SEATS,
  },
  {
    key: "sizeSf", id: "sizeSf", stage: "optional", mode: "area",
    when: (b) => !is(b, "residential") && !(is(b, "hospitality") && typeIn(b, "hotel")),
    prompt: (b) => (is(b, "institutional") ? "Roughly how large is the building or project area?" : "Roughly how large is the space?"),
    choices: (b) => AREA_BANDS[sectorOf(b) ?? "commercial"] ?? AREA_COMMERCIAL,
  },
  {
    key: "budget", id: "budget", stage: "optional", mode: "budget",
    prompt: (b) => {
      if (is(b, "institutional")) return "Is there a construction budget yet? It helps us scope the work.";
      const size = (["proposedSf", "sizeSf", "existingSf"] as const).map((id) => b.answers[id]).find((a) => a && !a.skipped && typeof a.value === "number");
      const loc = b.answers.location && !b.answers.location.skipped ? b.answers.location.label : null;
      if (size && loc) return `For about ${Number(size.value).toLocaleString("en-US")} SF in ${loc}, roughly what construction budget do you have in mind? A range is fine; it isn't a commitment.`;
      return "What construction budget are you working with? It helps us scope the work; it isn't a commitment.";
    },
    choices: (b) => BUDGET_BANDS(b),
  },
  {
    key: "siteStatus", id: "siteStatus", stage: "optional", mode: "choice",
    when: (b) => !(is(b, "residential") && typeIn(b, "kitchen_bath")),
    prompt: (b) =>
      is(b, "residential") ? "Do you own the property?"
        : is(b, "institutional") ? "Does the organization own the site?"
          : "Is the site or space secured?",
    choices: (b) => SITE_STATUS[sectorOf(b) ?? "residential"],
  },
  {
    key: "documents", id: "documents", stage: "optional", mode: "multi",
    prompt: () => "Which of these do you already have? Select any that apply.",
    choices: (b) => DOCUMENTS[sectorOf(b) ?? "residential"],
  },
  {
    key: "special", id: "special", stage: "optional", mode: "multi",
    prompt: () => "Do any of these apply?",
    choices: SPECIAL,
  },

  // ── contact (required) ──
  {
    key: "contactName", id: "contactName", stage: "contact", mode: "name", skippable: false,
    prompt: () => "Who should we follow up with?",
  },
  {
    key: "contactReach", id: "contactReach", stage: "contact", mode: "reach", skippable: false,
    prompt: (b) => {
      const name = String(val(b, "contactName") ?? "").split(" ")[0];
      return name ? `Thank you, ${name}. What's the best email or phone number to reach you?` : "What's the best email or phone number to reach you?";
    },
  },
  {
    key: "whatsappOk", id: "whatsappOk", stage: "contact", mode: "choice",
    when: (b) => !!(b.answers.contactReach?.value as { phone?: string } | undefined)?.phone,
    prompt: () => "Can the studio reach you on WhatsApp at that number?",
    choices: () => [
      { label: "Yes, WhatsApp is fine", value: "yes", keys: ["yes", "whatsapp", "sure", "fine"] },
      { label: "Calls or texts only", value: "no", keys: ["no", "calls", "texts", "text", "call"] },
    ],
  },
  {
    key: "company", id: "company", stage: "contact", mode: "text",
    when: (b) => ["commercial", "hospitality", "institutional"].includes(sectorOf(b) ?? ""),
    prompt: () => "And the company or organization, if there is one? This is optional.",
  },
];

/** The short path for existing clients. */
export const CLIENT_QUESTIONS: Q[] = [
  {
    key: "client-name", id: "contactName", stage: "client", mode: "name", skippable: false,
    prompt: () => "Of course. Who am I speaking with?",
  },
  {
    key: "clientProject", id: "clientProject", stage: "client", mode: "text",
    prompt: (b) => {
      const name = String(val(b, "contactName") ?? "").split(" ")[0];
      return `${name ? `Hello, ${name}. ` : ""}Which project is this about?`;
    },
  },
  {
    key: "clientMessage", id: "clientMessage", stage: "client", mode: "text", skippable: false,
    prompt: () => "What would you like me to pass on to the studio?",
  },
  {
    key: "urgency", id: "urgency", stage: "client", mode: "choice",
    prompt: () => "Is it time-sensitive?",
    choices: () => [
      { label: "Yes, today", value: "today", keys: ["today", "urgent", "asap", "right away", "yes"] },
      { label: "This week", value: "this_week", keys: ["this week", "soon", "few days"] },
      { label: "No rush", value: "no_rush", keys: ["no rush", "no", "not urgent", "whenever"] },
    ],
  },
  {
    key: "client-reach", id: "contactReach", stage: "client", mode: "reach", skippable: false,
    prompt: () => "What's the best email or phone number to reach you?",
  },
];

/** Slots shown on the review card, in order, with their labels. */
export const REVIEW_ROWS: Array<{ id: SlotId; label: string }> = [
  { id: "projectType", label: "Project" },
  { id: "location", label: "Location" },
  { id: "workScope", label: "Scope" },
  { id: "role", label: "Your role" },
  { id: "occupied", label: "Living there during work" },
  { id: "hoa", label: "Association approval" },
  { id: "tiAllowance", label: "TI allowance" },
  { id: "suites", label: "Suites involved" },
  { id: "brand", label: "Operator or brand" },
  { id: "secondGen", label: "Former restaurant space" },
  { id: "workType", label: "Construction" },
  { id: "keys", label: "Keys" },
  { id: "seats", label: "Seats" },
  { id: "solicitation", label: "Active RFQ or RFP" },
  { id: "solicitationDetails", label: "Solicitation" },
  { id: "stage", label: "Project stage" },
  { id: "funding", label: "Funding" },
  { id: "existingSf", label: "Existing size" },
  { id: "proposedSf", label: "New space" },
  { id: "sizeSf", label: "Size" },
  { id: "budget", label: "Construction budget" },
  { id: "timeline", label: "Timeline" },
  { id: "siteStatus", label: "Site" },
  { id: "documents", label: "Documents" },
  { id: "special", label: "Special requirements" },
  { id: "description", label: "In your words" },
  { id: "clientProject", label: "Project" },
  { id: "clientMessage", label: "Message" },
  { id: "urgency", label: "Time-sensitive" },
  { id: "contactName", label: "Name" },
  { id: "contactReach", label: "Contact" },
  { id: "whatsappOk", label: "WhatsApp" },
  { id: "company", label: "Company" },
  { id: "note", label: "Note" },
];
