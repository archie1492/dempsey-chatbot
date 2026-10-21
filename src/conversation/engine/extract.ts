// Answer extractors: pull structured answers out of free text with patterns
// and word lists. Each one returns null rather than guessing.

import {
  BUDGET_CONTEXT, CLIENT_TERMS, DOCUMENT_TERMS, EXISTING_HINTS, HUMAN_TERMS, NOT_NAMES,
  PROPOSED_HINTS, RESIDENTIAL_OWNED_TERMS, SECTOR_TERMS, SITE_STATUS_TERMS, SPECIAL_TERMS,
  TOPIC_TERMS, TYPE_TERMS,
} from "../content/lexicon";
import { OTHER_STATES, PLACES, STATE_ABBREVIATIONS, zipToPlace } from "../content/places";
import type { LocationValue, Sector, TimelineValue } from "../schema";
import { anyTerm, capitalize, formatMoney, hasTerm, normalize, parseAmount, pickBest, score } from "./text";

// ── classification ─────────────────────────────────────────────────────────
export const classifySector = (text: string) => {
  const t = normalize(text);
  const scores = Object.fromEntries(
    (Object.keys(SECTOR_TERMS) as Sector[]).map((s) => [s, score(t, SECTOR_TERMS[s])]),
  ) as Record<Sector, number>;
  return { ...pickBest(scores), scores };
};

export const classifyType = (sector: Sector, text: string): string | null => {
  const t = normalize(text);
  const terms = TYPE_TERMS[sector];
  const scores = Object.fromEntries(Object.keys(terms).map((k) => [k, score(t, terms[k])])) as Record<string, number>;
  return pickBest(scores, 2, 1).best;
};

export const classifyTopic = (text: string): string | null => {
  const t = normalize(text);
  const scores = Object.fromEntries(Object.keys(TOPIC_TERMS).map((k) => [k, score(t, TOPIC_TERMS[k])]));
  return pickBest(scores, 2, 1).best;
};

export const isClientMessage = (text: string) => anyTerm(normalize(text), CLIENT_TERMS);
export const isHumanRequest = (text: string) => anyTerm(normalize(text), HUMAN_TERMS);

// ── location ───────────────────────────────────────────────────────────────
const SORTED_PLACES = [...PLACES].sort((a, b) => b[0].length - a[0].length);

/**
 * strict = true: the text is an answer to "Where is it?" — any recognised place
 * counts. strict = false: the place must follow "in", "at", "near", etc.
 */
export const findLocation = (text: string, strict: boolean): LocationValue | null => {
  const t = normalize(text);
  const lead = strict ? "" : "(?:in|at|near|located in|based in|from|outside|around) (?:the )?";
  for (const [term, place] of SORTED_PLACES) {
    const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[^a-z])${lead}${esc}(?![a-z])`);
    if (re.test(t)) {
      return { text: place.name === "Florida" && term !== "florida" ? capitalize(term) : place.name, region: place.region, county: place.county };
    }
  }
  for (const state of OTHER_STATES) {
    if (new RegExp(`(^|[^a-z])${strict ? "" : "(?:in|at|near|from) "}${state}(?![a-z])`).test(t)) {
      return { text: strict ? capitalize(text.trim()) : capitalize(state), region: "outside" };
    }
  }
  const abbr = t.match(/,\s*([a-z]{2})\.?(?:\s|$|\d)/);
  if (abbr && STATE_ABBREVIATIONS[abbr[1]]) {
    return { text: text.trim(), region: STATE_ABBREVIATIONS[abbr[1]] };
  }
  const zip = t.match(/(?:^|[^\d$,.])(\d{5})(?![\d,])/);
  if (zip && (strict || /zip|zip code|\b(fl|florida)\b/.test(t))) {
    const p = zipToPlace(zip[1]);
    if (p) return { text: zip[1], region: p.region, county: p.county };
  }
  return null;
};

// ── areas and counts ───────────────────────────────────────────────────────
const AREA_RE = /(\d[\d,]*(?:\.\d+)?)\s*(k)?\s*(?:-|\s)?\s*(?:sq\.?\s?ft\.?|sqft|sf|rsf|usf|gsf|square[\s-]*f(?:ee|oo)t|sq\.?\s*feet|square feet)(?![a-z])/g;

export interface AreaHit { value: number; kind: "existing" | "proposed" | "unknown"; }

export const findAreas = (text: string): AreaHit[] => {
  const t = normalize(text);
  const hits: AreaHit[] = [];
  let m: RegExpExecArray | null;
  AREA_RE.lastIndex = 0;
  while ((m = AREA_RE.exec(t))) {
    const value = parseAmount(m[1], m[2]);
    if (!value || value < 50) continue;
    const before = t.slice(Math.max(0, m.index - 32), m.index);
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 20);
    const ctx = `${before} ${after}`;
    const kind = PROPOSED_HINTS.some((w) => hasTerm(ctx, w)) ? "proposed"
      : EXISTING_HINTS.some((w) => hasTerm(ctx, w)) ? "existing" : "unknown";
    hits.push({ value, kind });
  }
  return hits;
};

/** A bare number typed as an answer to a size question ("2,400", "about 3000"). */
export const findBareNumber = (text: string): number | null => {
  const t = normalize(text);
  const m = t.match(/(?:^|[^\d$])(\d[\d,]*(?:\.\d+)?)\s*(k|thousand)?(?![\d%])/);
  if (!m) return null;
  return parseAmount(m[1], m[2]);
};

export const findCounts = (text: string): { keys?: number; seats?: number } => {
  const t = normalize(text);
  const out: { keys?: number; seats?: number } = {};
  const keys = t.match(/(\d[\d,]*)\s*-?\s*(?:keys?|guest\s?rooms?|rooms?|suites)(?![a-z])/);
  if (keys) out.keys = parseAmount(keys[1]) ?? undefined;
  const seats = t.match(/(\d[\d,]*)\s*-?\s*(?:seats?|seater|covers)(?![a-z])/);
  if (seats) out.seats = parseAmount(seats[1]) ?? undefined;
  return out;
};

// ── money ──────────────────────────────────────────────────────────────────
const SUFFIX = "(k|m|mm|mil|million|thousand)?";
const NUM = "(\\d[\\d,]*(?:\\.\\d+)?)";

export interface MoneyHit { amount?: number; label?: string; perSf?: number; }

export const findMoney = (text: string, answering = false): MoneyHit | null => {
  const t = normalize(text);
  const perSf = t.match(new RegExp(`\\$?\\s?${NUM}\\s*(?:/|per|a)\\s*(?:sf|sq\\.?\\s?ft|square\\s+f(?:oo|ee)t|foot|ft|rsf|psf)(?![a-z])`)) ??
    t.match(new RegExp(`\\$?\\s?${NUM}\\s*psf(?![a-z])`));
  if (perSf) return { perSf: parseFloat(perSf[1].replace(/,/g, "")) };

  const range = t.match(new RegExp(`\\$?\\s?${NUM}\\s*${SUFFIX}\\s*(?:-|to|and)\\s*\\$?\\s?${NUM}\\s*${SUFFIX}(?![a-z])`));
  if (range && (range[2] || range[4] || t.includes("$"))) {
    const s2 = range[4] ?? range[2];
    const lo = parseAmount(range[1], range[2] ?? s2);
    const hi = parseAmount(range[3], s2);
    if (lo && hi && hi >= 1000 && !isArea(t, range.index! + range[0].length)) {
      return { amount: (lo + hi) / 2, label: `${formatMoney(lo)}–${formatMoney(hi).replace("$", "")}` };
    }
  }

  const re = new RegExp(`(\\$)?\\s?${NUM}\\s*${SUFFIX}(?![a-z0-9])`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const [, dollar, num, suffix] = m;
    const end = m.index + m[0].length;
    if (isArea(t, end) || isCount(t, end) || /^20[2-4]\d$/.test(num)) continue;
    const amount = parseAmount(num, suffix);
    if (!amount) continue;
    const before = t.slice(Math.max(0, m.index - 24), m.index);
    const moneyish = !!dollar || !!suffix && amount >= 10_000;
    const context = BUDGET_CONTEXT.some((w) => hasTerm(before, w)) && amount >= 10_000;
    if (moneyish || context || (answering && amount >= 1_000)) {
      return { amount, label: `about ${formatMoney(amount)}` };
    }
  }
  return null;
};

const isArea = (t: string, end: number) => /^\s*-?\s*(sq|sf|rsf|usf|gsf|square)/.test(t.slice(end));
const isCount = (t: string, end: number) => /^\s*-?\s*(keys?|rooms?|seats?|covers|units?|stor(?:y|ies)|floors?|bed|bath|months?|years?|weeks?|days?|%|percent)/.test(t.slice(end));

// ── timeline ───────────────────────────────────────────────────────────────
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SEASON_START: Record<string, number> = { spring: 3, summer: 6, fall: 9, autumn: 9, winter: 12 };
const ym = (y: number, m: number) => {
  const d = new Date(Date.UTC(y, m - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

export const findTimeline = (text: string, now = new Date()): TimelineValue | null => {
  const t = normalize(text);
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  if (/\b(asap|as soon as possible|right away|immediately|urgent(?:ly)?)\b/.test(t))
    return { text: "As soon as possible", approxMonth: ym(year, month + 1) };

  let m = t.match(/\b(next|this|in the)\s+(spring|summer|fall|autumn|winter)\b/);
  if (m) {
    const start = SEASON_START[m[2]];
    const y = m[1] === "next" ? (start > month ? year : year + 1) : (start >= month - 2 ? year : year + 1);
    return { text: `${m[1] === "next" ? "Next" : "This"} ${m[2]}`, approxMonth: ym(y, start + 1) };
  }
  m = t.match(/\b(spring|summer|fall|autumn|winter)\s+(?:of\s+)?(20[2-4]\d)\b/);
  if (m) return { text: `${capitalize(m[1])} ${m[2]}`, approxMonth: ym(+m[2], SEASON_START[m[1]] + 1) };

  m = t.match(/\bq([1-4])\s*(?:of\s*)?(20[2-4]\d)?\b/);
  if (m) {
    const q = +m[1];
    const y = m[2] ? +m[2] : (q * 3 >= month ? year : year + 1);
    return { text: `Q${q} ${y}`, approxMonth: ym(y, q * 3 - 1) };
  }

  m = t.match(/\b(?:in|within|about|around)\s+(\d{1,2}|a few|a couple of|six|three|two|nine|twelve|eighteen)\s+months?\b/);
  if (m) {
    const words: Record<string, number> = { "a few": 3, "a couple of": 2, six: 6, three: 3, two: 2, nine: 9, twelve: 12, eighteen: 18 };
    const n = words[m[1]] ?? +m[1];
    return { text: `In about ${n} months`, approxMonth: ym(year, month + n) };
  }

  const monthRe = /\b(early |mid-?|late |end of )?(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?(?:\s+(?:of\s+)?(20[2-4]\d))?\b/g;
  let mm: RegExpExecArray | null;
  while ((mm = monthRe.exec(t))) {
    const word = mm[0];
    const idx = MONTHS.indexOf(mm[2].slice(0, 3));
    if (idx < 0) continue;
    // "may" and "march" are also verbs: require a year, a qualifier or a time word before.
    const before = t.slice(Math.max(0, mm.index - 12), mm.index);
    const timeWord = /\b(in|by|before|after|around|start|starting|open|opening|until|from|for)\s*$/.test(before);
    if ((mm[2] === "may" || mm[2] === "mar") && !mm[3] && !mm[1] && !timeWord) continue;
    if (!/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/.test(word.trim().replace(/^(early|mid-?|late|end of)\s*/, ""))) continue;
    const mo = idx + 1;
    const y = mm[3] ? +mm[3] : mo >= month ? year : year + 1;
    const qual = mm[1] ? capitalize(mm[1].trim()) + " " : "";
    return { text: `${qual}${MONTH_NAMES[idx]} ${y}`, approxMonth: ym(y, mo) };
  }

  if (/\bnext year\b/.test(t)) return { text: `Next year (${year + 1})`, approxMonth: null };
  if (/\b(end of (the )?year|by year[- ]end|year end)\b/.test(t)) return { text: `End of ${year}`, approxMonth: ym(year, 12) };

  m = t.match(/\b(early|mid|late|end of)?\s*(20[2-4]\d)\b(?!\s*(sf|sq|square))/);
  if (m && +m[2] >= year) {
    const q = m[1] ? capitalize(m[1]) + " " : "";
    const mo = m[1] === "early" ? 3 : m[1] === "mid" ? 6 : m[1] === "late" || m[1] === "end of" ? 11 : 6;
    return { text: `${q}${m[2]}`, approxMonth: ym(+m[2], mo) };
  }
  return null;
};

// ── site status, documents, special requirements ───────────────────────────
export const findSiteStatus = (text: string, sector?: Sector): string | null => {
  const t = normalize(text);
  for (const [status, terms] of Object.entries(SITE_STATUS_TERMS)) {
    if (anyTerm(t, terms)) return status;
  }
  if (sector === "residential" && anyTerm(t, RESIDENTIAL_OWNED_TERMS)) return "owned";
  return null;
};

/** answering = the visitor is answering the documents question, so "survey" alone counts. */
export const findDocuments = (text: string, answering: boolean): string[] => {
  const t = normalize(text);
  if (!answering && !/\b(we have|i have|we've got|have a|have the|have existing|attached|existing)\b/.test(t)) return [];
  return Object.entries(DOCUMENT_TERMS).filter(([, terms]) => anyTerm(t, terms)).map(([k]) => k);
};

export const findSpecial = (text: string): string[] => {
  const t = normalize(text);
  return Object.entries(SPECIAL_TERMS).filter(([, terms]) => anyTerm(t, terms)).map(([k]) => k);
};

// ── solicitations ──────────────────────────────────────────────────────────
export const findSolicitation = (text: string): string | null => {
  const m = text.match(/\b(RFQ|RFP|ITB|IFB|RFI)\b\s*(?:no\.?|number|#)?\s*([A-Za-z0-9][\w-]*\d[\w-]*)?/i);
  if (!m) return null;
  const id = `${m[1].toUpperCase()}${m[2] ? ` ${m[2]}` : ""}`;
  const due = text.match(/\bdue\s+(?:on\s+|by\s+)?([A-Z][a-z]+\.?\s+\d{1,2}(?:,?\s*20\d\d)?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);
  return due ? `${id}, due ${due[1]}` : id;
};

// ── contact ────────────────────────────────────────────────────────────────
export const findEmail = (text: string) => text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/)?.[0] ?? null;

export const findPhone = (text: string): string | null => {
  const m = text.match(/(?:\+?1[\s.-]?)?\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})(?!\d)/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

/** Only from "I'm …", "this is …", "my name is …" followed by capitalised words. */
export const findName = (text: string): string | null => {
  const m = text.match(/\b(?:I'?m|I am|this is|my name is|it'?s|name'?s)\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)?)/);
  if (!m) return null;
  const first = m[1].split(/\s+/)[0].toLowerCase();
  if (NOT_NAMES.includes(first)) return null;
  return m[1];
};

/** Clean a typed answer to "Who should we follow up with?" */
export const cleanName = (text: string): string | null => {
  const named = findName(text);
  if (named) return named;
  const t = text.replace(/^(i'?m|i am|this is|my name is|it'?s|name'?s)\s+/i, "").replace(/[.!]+$/, "").trim();
  if (!t || t.length > 60 || /\d|@/.test(t) || t.split(/\s+/).length > 5) return null;
  return t.replace(/\b([a-z])/g, (c) => c.toUpperCase());
};

/** "the Lake Worth residence" from "…working with you on the Lake Worth residence…" */
export const findProjectName = (text: string): string | null => {
  const m = text.match(/\b(?:on|for|about|re:?)\s+(?:the|our)\s+([A-Z][\w'&-]*(?:\s+[A-Z][\w'&-]*)*\s+(?:residence|house|home|project|building|hotel|restaurant|office|center|centre|church|school|clinic|renovation|addition))\b/i);
  return m ? `the ${m[1]}` : null;
};

export const money = { formatMoney };
