// Types shared by the conversation content, the engine and the UI.
// The inquiry record (toRecord in engine/summary.ts) is versioned so that
// Phase 4 (GoDaddy database, WhatsApp handoff) can read older records.

export type Sector = "residential" | "commercial" | "hospitality" | "institutional";

export type InquiryKind = "new_project" | "client" | "general";

/** Where an answer came from: a tapped chip, typed text, or inferred from other text. */
export type Via = "chip" | "text" | "inferred";

export type SlotId =
  | "sector"
  | "projectType"
  | "description"
  | "location"
  // residential
  | "occupied"
  | "hoa"
  // commercial
  | "role"
  | "tiAllowance"
  | "suites"
  // hospitality
  | "brand"
  | "secondGen"
  | "keys"
  | "workType"
  // institutional
  | "solicitation"
  | "solicitationDetails"
  | "stage"
  | "funding"
  // shared
  | "timeline"
  | "existingSf"
  | "proposedSf"
  | "sizeSf"
  | "seats"
  | "budget"
  | "siteStatus"
  | "documents"
  | "special"
  // contact
  | "contactName"
  | "contactReach"
  | "company"
  | "note"
  // existing clients
  | "clientProject"
  | "clientMessage"
  | "urgency";

export type Region = "south_florida" | "licensed" | "outside" | "unknown";

export interface LocationValue {
  text: string;
  region: Region;
  county?: string;
}

export interface TimelineValue {
  text: string;
  /** Approximate month as YYYY-MM when the phrase allows it. */
  approxMonth: string | null;
}

export interface ReachValue {
  email?: string;
  phone?: string;
}

export type SlotValue =
  | string
  | number
  | string[]
  | LocationValue
  | TimelineValue
  | ReachValue
  | null;

export interface Answer {
  value: SlotValue;
  /** Human-readable form used in the summary. */
  label: string;
  via: Via;
  skipped?: boolean;
  /** The visitor's own words, when the answer came from text. */
  raw?: string;
}

export interface Brief {
  kind: InquiryKind | null;
  answers: Partial<Record<SlotId, Answer>>;
  /** Checkpoint choice after the core questions. */
  checkpoint: "continue" | "fast" | null;
  /** Slot currently being edited from the review card. */
  editing: SlotId | null;
  /** One-off notes already shown, so they never repeat. */
  shown: string[];
  /** Consecutive inputs the assistant could not use. */
  misses: number;
  lastAck: string | null;
  /** Sentences to say before the next question (acknowledgements, notes). */
  notes: string[];
  /** Visitor asked to send what they've shared: only contact details remain. */
  wrapUp: boolean;
  status: "in_progress" | "reviewed" | "sent";
  startedAt: string;
}

export const newBrief = (): Brief => ({
  kind: null,
  answers: {},
  checkpoint: null,
  editing: null,
  shown: [],
  misses: 0,
  lastAck: null,
  notes: [],
  wrapUp: false,
  status: "in_progress",
  startedAt: new Date().toISOString(),
});

export interface Choice {
  label: string;
  value: string | number | null;
  /** Extra words that select this choice when typed. */
  keys?: string[];
  /** For numeric bands: inclusive lower and exclusive upper bounds. */
  min?: number;
  max?: number;
}

export type AnswerMode =
  | "choice" // single choice; typed text matched against choices, then extractors
  | "multi" // checkboxes
  | "text" // any text is the answer
  | "location"
  | "timeline"
  | "budget"
  | "area" // square footage
  | "count" // keys or seats
  | "name"
  | "reach"; // email or phone

export type Stage = "entry" | "core" | "checkpoint" | "optional" | "contact" | "client";

export interface Question {
  id: SlotId;
  stage: Stage;
  mode: AnswerMode;
  /** Only asked when this returns true. */
  when?: (b: Brief) => boolean;
  prompt: (b: Brief) => string;
  choices?: (b: Brief) => Choice[];
  /** Offer a Skip chip (default true; contact questions are required). */
  skippable?: boolean;
  /** One sentence said after this question is answered by chip or text. */
  after?: (b: Brief) => string | undefined;
}

/** Where the conversation goes next. */
export type Route =
  | { to: "ask"; q: string }
  | { to: "review" }
  | { to: "sent" }
  | { to: "architect" }
  | { to: "menu" }
  | { to: "general" }
  | { to: "info"; topic: string }
  | { to: "start" };
