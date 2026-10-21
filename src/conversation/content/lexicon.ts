// Word lists the assistant uses to understand typed messages. No AI: a term
// either appears in the message or it doesn't.
//
// Editing rules
// - Terms are lowercase. Whole words/phrases match by default.
// - End a term with * to match any word starting with it ("renovat*").
// - When deciding the kind of project or topic, words of 6+ letters also
//   match with one typo ("renovaton"). Details (flood, survey…) must match exactly.
// - Numbers after a term are weights: 3 = strong signal, 1 = weak hint.

import type { Sector } from "../schema";

export type Weighted = Array<[string, number]>;

export const SECTOR_TERMS: Record<Sector, Weighted> = {
  residential: [
    ["house", 2], ["home", 2], ["residence", 3], ["residential", 3], ["condo", 2], ["apartment", 2],
    ["townhouse", 2], ["villa", 2], ["kitchen", 2], ["renovat*", 1], ["bathroom", 2], ["master bath", 2], ["bedroom", 2],
    ["addition", 2], ["second floor", 2], ["second story", 2], ["guest house", 3], ["guesthouse", 3],
    ["adu", 3], ["pool house", 3], ["cabana", 2], ["garage", 1], ["remodel*", 1], ["family", 1],
  ],
  commercial: [
    ["office", 3], ["offices", 3], ["tenant improvement*", 3], ["buildout", 2], ["build-out", 2],
    ["build out", 2], ["ti", 2], ["suite", 2], ["retail", 3], ["showroom", 3], ["store", 2],
    ["medical", 3], ["clinic", 2], ["dental", 3], ["dentist", 3], ["dermatology", 3], ["physician", 3],
    ["warehouse", 3], ["industrial", 3], ["flex space", 3], ["commercial", 3], ["landlord", 2],
    ["tenant", 2], ["rsf", 2], ["usf", 2], ["storefront", 2], ["headquarters", 3], ["coworking", 3],
  ],
  hospitality: [
    ["hotel", 3], ["restaurant", 3], ["bar", 2], ["cafe", 3], ["café", 3], ["coffee shop", 3],
    ["bistro", 3], ["lounge", 2], ["spa", 3], ["wellness", 3], ["fitness", 2], ["gym", 2],
    ["resort", 3], ["inn", 2], ["keys", 2], ["seats", 2], ["club", 2], ["event venue", 3], ["venue", 2],
    ["hospitality", 3], ["brewery", 3], ["bakery", 2], ["f&b", 3], ["food hall", 3], ["yoga", 2],
  ],
  institutional: [
    ["municipal", 3], ["city hall", 3], ["town hall", 3], ["school", 3], ["university", 3],
    ["college", 3], ["campus", 2], ["museum", 3], ["library", 3], ["church", 3], ["chapel", 3],
    ["synagogue", 3], ["mosque", 3], ["temple", 2], ["ministry", 2], ["congregation", 3],
    ["fellowship hall", 3], ["sanctuary", 2], ["nonprofit", 3], ["non-profit", 3],
    ["community center", 3], ["fire station", 3], ["police", 2], ["public", 2], ["rfq", 3],
    ["rfp", 3], ["itb", 3], ["solicitation", 3], ["auditorium", 3], ["civic", 3], ["cultural", 2],
    ["government", 3], ["county", 1], ["city of", 2], ["school district", 3], ["foundation", 1],
  ],
};

/** Project-type terms per sector. Keys must match the choice values in pathways.ts. */
export const TYPE_TERMS: Record<Sector, Record<string, Weighted>> = {
  residential: {
    new_home: [["new home", 3], ["new house", 3], ["custom home", 3], ["build a house", 3], ["build a home", 3], ["ground up", 2], ["new construction", 2], ["build our home", 3]],
    addition: [["addition", 3], ["second floor", 3], ["second story", 3], ["add a", 2], ["expand*", 2], ["extension", 2]],
    renovation: [["renovat*", 2], ["remodel*", 2], ["gut", 2], ["whole house", 3], ["whole home", 3], ["whole-home", 3], ["restor*", 2]],
    kitchen_bath: [["kitchen", 3], ["bathroom", 3], ["master bath", 3], ["bath", 2]],
    condo: [["condo", 3], ["apartment", 3], ["penthouse", 3], ["unit", 1]],
    guest_house: [["guest house", 3], ["guesthouse", 3], ["adu", 3], ["pool house", 3], ["cabana", 3], ["in-law", 3]],
  },
  commercial: {
    office: [["office", 3], ["offices", 3], ["headquarters", 3], ["hq", 3], ["coworking", 3], ["workspace", 2]],
    medical: [["medical", 3], ["medical office", 4], ["dental office", 4], ["doctor's office", 4], ["doctors office", 4], ["clinic", 3], ["dental", 3], ["dentist", 3], ["dermatology", 3], ["physician", 3], ["urgent care", 3], ["veterinary", 3], ["surgery center", 3], ["imaging", 2]],
    retail: [["retail", 3], ["store", 3], ["shop", 2], ["showroom", 3], ["salon", 3], ["storefront", 3]],
    flex: [["warehouse", 3], ["industrial", 3], ["flex", 3], ["distribution", 3], ["manufacturing", 3]],
    new_building: [["new building", 3], ["ground up", 3], ["ground-up", 3], ["new construction", 2], ["shell building", 3]],
  },
  hospitality: {
    restaurant: [["restaurant", 3], ["bar", 3], ["cafe", 3], ["café", 3], ["coffee", 2], ["bistro", 3], ["lounge", 2], ["brewery", 3], ["bakery", 3], ["food hall", 3], ["seats", 2]],
    hotel: [["hotel", 3], ["inn", 3], ["resort", 3], ["lodging", 3], ["keys", 3], ["motel", 3]],
    wellness: [["spa", 3], ["wellness", 3], ["fitness", 3], ["gym", 3], ["yoga", 3], ["pilates", 3], ["med spa", 3]],
    venue: [["club", 3], ["event venue", 3], ["venue", 3], ["ballroom", 3], ["members club", 3]],
    refresh: [["refresh", 3], ["refurbish*", 3], ["redesign", 2], ["update our", 3], ["renovate our", 3]],
  },
  institutional: {
    municipal: [["city", 2], ["county", 2], ["municipal", 3], ["town", 2], ["village", 2], ["fire station", 3], ["police", 3], ["public works", 3], ["government", 3], ["city hall", 3], ["town hall", 3]],
    school: [["school", 3], ["school district", 3], ["university", 3], ["college", 3], ["campus", 3], ["classroom*", 3], ["education*", 2], ["academy", 3]],
    cultural: [["museum", 3], ["library", 3], ["gallery", 3], ["theater", 3], ["theatre", 3], ["auditorium", 3], ["performing arts", 3], ["cultural", 3]],
    faith: [["church", 3], ["chapel", 3], ["synagogue", 3], ["mosque", 3], ["temple", 3], ["parish", 3], ["ministry", 3], ["congregation", 3], ["fellowship hall", 3], ["sanctuary", 3]],
    nonprofit: [["nonprofit", 3], ["non-profit", 3], ["foundation", 2], ["community center", 3], ["charity", 3]],
  },
};

/** Topics answered on the general-question path. Keys match INFO in copy.ts. */
export const TOPIC_TERMS: Record<string, Weighted> = {
  fees: [["fee", 3], ["fees", 3], ["pricing", 3], ["price", 2], ["charge", 2], ["how much", 2], ["rate", 2], ["rates", 2], ["hourly", 2], ["quote", 2]],
  services: [["service*", 3], ["what do you do", 3], ["what you do", 2], ["offer", 2], ["specialize", 2]],
  phases: [["process", 3], ["phase*", 3], ["how does it work", 3], ["how it works", 3], ["steps", 2], ["schematic", 2]],
  areas: [["licens*", 3], ["do you work in", 3], ["work in", 2], ["serve", 2], ["service area", 3], ["where are you", 3], ["located", 2], ["travel", 2], ["outside florida", 3]],
  permitting: [["permit*", 3], ["building department", 3], ["approval*", 2], ["zoning", 2]],
  portfolio: [["portfolio", 3], ["examples", 3], ["past work", 3], ["your work", 3], ["previous project*", 3], ["projects you", 3]],
  booking: [["book", 3], ["booking", 3], ["appointment*", 3], ["meeting", 3], ["schedule a call", 3], ["set up a call", 3], ["calendly", 3]],
  vendors: [["career*", 3], ["job", 3], ["jobs", 3], ["hiring", 3], ["resume", 3], ["internship*", 3], ["vendor*", 3], ["consultant*", 3], ["supplier*", 3], ["partner with you", 3], ["sales rep", 3]],
};

/** Phrases that mean the visitor is already a client. */
export const CLIENT_TERMS = [
  "working with you", "work with you on", "our project with you", "existing client", "current client",
  "you designed", "you're designing", "you are designing", "our architect", "site visit", "invoice",
  "the drawings you", "permit set", "change order", "our meeting", "our project",
];

/** Phrases that ask for a person. */
export const HUMAN_TERMS = [
  "speak with an architect", "speak to an architect", "talk to an architect", "talk with an architect",
  "talk to someone", "speak to someone", "speak with someone", "talk to a person", "real person",
  "a human", "call me", "call me back", "someone call", "speak to a person", "speak with a person",
];

/** Single-word or short commands honoured at any step (matched against short messages only). */
export const COMMANDS = {
  menu: ["menu", "main menu", "back to menu", "go back to the menu", "home"],
  restart: ["start over", "restart", "reset", "start again", "begin again"],
  skip: ["skip", "pass", "next", "skip this", "skip it", "rather not say", "prefer not to say", "n/a", "na"],
  notSure: ["not sure", "unsure", "don't know", "dont know", "no idea", "not decided", "undecided", "tbd", "maybe", "not yet"],
  finish: ["that's all", "thats all", "that is all", "that's it", "thats it", "send it", "send it now", "send now", "i'm done", "im done", "done", "finish", "no more questions"],
  withdraw: [
    "don't save", "dont save", "do not save", "don't save this", "stop saving", "keep it private",
    "delete this conversation", "delete my conversation", "delete the conversation", "delete my data", "forget this",
  ],
  human: ["human", "person", "architect", "agent", "speak with an architect", "talk to someone"],
};

export const SITE_STATUS_TERMS: Record<string, string[]> = {
  owned: ["we own", "i own", "we bought", "just bought", "we purchased", "just purchased", "own the", "our property", "our lot", "our land", "our building", "we're the owner", "we are the owner"],
  under_contract: ["under contract", "closing on", "in escrow"],
  loi: ["loi", "letter of intent"],
  leased: ["signed the lease", "signed a lease", "lease signed", "lease is signed", "we lease", "we're leasing", "we are leasing"],
  negotiating: ["negotiating", "in negotiations"],
  searching: ["looking for a site", "looking for a space", "looking for space", "looking for property", "looking for land", "looking for a lot", "looking for a location", "still looking", "still searching", "haven't found", "have not found", "no site yet", "searching for"],
};

/** Residential only: these phrases imply ownership. */
export const RESIDENTIAL_OWNED_TERMS = ["our house", "our home", "my house", "my home", "our condo", "my condo"];

/** Documents the visitor may already have. Keys match the choice values in pathways.ts. */
export const DOCUMENT_TERMS: Record<string, string[]> = {
  survey: ["survey"],
  drawings: ["drawings", "plans", "blueprints", "as-built*", "as built*", "cad files"],
  hoa_guidelines: ["hoa guidelines", "association guidelines", "condo rules", "architectural guidelines", "hoa rules"],
  photos: ["photos", "pictures", "photographs"],
  base_building: ["base building", "base-building", "shell drawings"],
  work_letter: ["work letter"],
  brand_standards: ["brand standard*", "brand guidelines"],
  landlord_criteria: ["landlord criteria", "tenant criteria", "design criteria"],
  facility_assessment: ["facility assessment", "condition assessment", "facility condition"],
  prior_studies: ["feasibility study", "prior study", "previous study", "master plan", "needs assessment"],
};

/** Special requirements. Keys match the choice values in pathways.ts. */
export const SPECIAL_TERMS: Record<string, string[]> = {
  flood_zone: ["flood zone", "flood", "waterfront", "on the water", "oceanfront", "ocean front", "intracoastal", "seawall", "coastal"],
  historic: ["historic*", "landmark*"],
  accessibility: ["accessib*", "aging in place", "wheelchair"],
  sustainability: ["sustainab*", "leed", "solar", "net zero", "net-zero", "energy efficien*"],
  occupied: ["occupied", "stay open", "remain open", "remain operational", "while we work", "while open"],
  ada: ["ada"],
  change_of_use: ["change of use", "change in use", "convert*"],
  medical_equipment: ["x-ray", "xray", "imaging", "mri", "procedure room*", "medical gas", "lead-lined", "lead lined"],
  kitchen: ["commercial kitchen", "hood", "grease trap", "full kitchen"],
  outdoor: ["outdoor seating", "patio", "rooftop", "terrace", "outdoor dining"],
  acoustics: ["acoustic*", "soundproof*", "noise", "live music"],
  phasing: ["phased", "phasing", "in phases"],
  resilience: ["hurricane", "resilien*", "storm surge", "impact windows", "hardening"],
  engagement: ["community engagement", "public meeting*", "community input", "stakeholder*", "public input"],
};

/** Words around a square-footage figure that mark it as new/added space. */
export const PROPOSED_HINTS = ["add", "adding", "addition", "new", "another", "expand", "extra", "build", "proposed", "additional"];
/** Words that mark it as existing space. */
export const EXISTING_HINTS = ["existing", "current", "currently", "today", "now", "is about", "is around", "house is", "home is", "building is", "space is", "suite is"];

/** Words that make an unprefixed number read as a budget. */
export const BUDGET_CONTEXT = ["budget", "spend", "spending", "cost", "invest", "around", "about", "up to", "max", "maximum", "allocated", "funding"];

/** Words before a capitalised name that we refuse to treat as a name. */
export const NOT_NAMES = [
  "looking", "planning", "interested", "thinking", "hoping", "trying", "working", "not", "just", "sure",
  "the", "a", "an", "in", "from", "with", "here", "ready", "going", "considering", "currently", "building",
  "renovating", "opening", "a", "new", "also", "still", "very", "glad", "happy",
];
