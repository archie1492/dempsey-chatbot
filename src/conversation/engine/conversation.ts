// The conversation engine. Pure TypeScript — no React, no ChatBotify — so it
// can be unit-tested. flow.tsx turns its Routes into ChatBotify blocks.

import { ACKS, ACK_TEMPLATES, COPY, ENTRY_CHOICES, GENERAL_CHOICES, INFO, INFO_FOLLOWUPS, NOTES } from "../content/copy";
import { COMMANDS } from "../content/lexicon";
import { CONTEXT_NOTES } from "../content/context";
import {
  CLIENT_QUESTIONS, PROJECT_TYPES, Q, QUESTIONS, SITE_STATUS_LABELS, SPECIAL, sectorOf, typeOf,
} from "../content/pathways";
import type { Answer, Brief, Choice, LocationValue, Route, Sector, SlotId, TimelineValue } from "../schema";
import { newBrief } from "../schema";
import {
  classifySector, classifyTopic, classifyType, cleanName, findAreas, findBareNumber, findCounts,
  findDocuments, findEmail, findLocation, findMoney, findName, findPhone, findProjectName,
  findSiteStatus, findSolicitation, findSpecial, findTimeline, isClientMessage, isHumanRequest,
} from "./extract";
import { formatNumber, hasTerm, joinList, normalize, wordCount } from "./text";

export const SKIP = "Skip";
export const ARCHITECT_CHIP = "Speak with an architect";
export const MAIN_MENU_CHIP = "Main menu";
export const START_OVER_CHIP = "Start over";
export const SEND_CHIP = "Send to the studio";
export const REVIEW_SHARED_CHIP = "Review what I've shared";

const ALL_QUESTIONS = [...QUESTIONS, ...CLIENT_QUESTIONS];
export const questionByKey = (key: string): Q | undefined => ALL_QUESTIONS.find((q) => q.key === key);

// ── state helpers ──────────────────────────────────────────────────────────
const has = (b: Brief, id: SlotId) => b.answers[id] !== undefined;
const filled = (b: Brief, id: SlotId) => has(b, id) && !b.answers[id]!.skipped;
const value = (b: Brief, id: SlotId) => b.answers[id]?.value;

const set = (b: Brief, id: SlotId, a: Answer, overwrite = false): boolean => {
  if (has(b, id) && !overwrite) return false;
  b.answers[id] = a;
  return true;
};

const once = (b: Brief, key: string, text: string) => {
  if (b.shown.includes(key)) return;
  b.shown.push(key);
  b.notes.push(text);
};

/** Acknowledge what was learned: the first time "Thank you. I've noted …", then varied. */
const ackWith = (b: Brief, what: string): string => {
  const used = b.shown.filter((k) => k.startsWith("ack:")).length;
  b.shown.push(`ack:${used}`);
  const i = used === 0 ? 0 : 1 + ((used - 1) % (ACK_TEMPLATES.length - 1));
  return ACK_TEMPLATES[i](what);
};

const ack = (b: Brief): string => {
  const next = ACKS.find((a) => a !== b.lastAck) ?? ACKS[0];
  b.lastAck = next;
  return next;
};

export const resetBrief = (b: Brief) => Object.assign(b, newBrief());

// ── resolver: what to ask next ─────────────────────────────────────────────
const applies = (b: Brief, q: Q) => (q.when ? q.when(b) : true);

const RFQ_KEEP: SlotId[] = ["sector", "projectType", "solicitation", "solicitationDetails", "contactName", "contactReach", "whatsappOk", "company"];

/** Optional questions still to come if the visitor continues past the checkpoint. */
export const remainingOptional = (b: Brief): number =>
  QUESTIONS.filter((q) => q.stage === "optional" && !has(b, q.id) && applies(b, q)).length;

export const nextRoute = (b: Brief): Route => {
  if (b.kind === "client") {
    const q = CLIENT_QUESTIONS.find((q) => !has(b, q.id) && applies(b, q));
    return q ? { to: "ask", q: q.key } : { to: "review" };
  }
  if (!sectorOf(b)) return { to: "ask", q: "sector" };
  const activeRfq = value(b, "solicitation") === "yes";
  let checkpointNeeded = false;
  for (const q of QUESTIONS) {
    if (q.stage === "entry" || has(b, q.id) || !applies(b, q)) continue;
    if (activeRfq && !RFQ_KEEP.includes(q.id)) continue;
    if (b.wrapUp && q.stage !== "contact") continue;
    if (q.stage === "optional") {
      if (b.checkpoint === "fast") continue;
      if (b.checkpoint === null) { checkpointNeeded = true; break; }
    }
    return { to: "ask", q: q.key };
  }
  if (checkpointNeeded) return { to: "ask", q: "checkpoint" };
  return { to: "review" };
};

// ── what each step shows ───────────────────────────────────────────────────
/** Message for a step: pending notes first, then the prompt. Consumes notes. */
export const say = (b: Brief, prompt: string): string => {
  const pre = b.notes.splice(0).join(" ");
  return pre ? `${pre} ${prompt}` : prompt;
};

export const promptFor = (b: Brief, key: string): string => {
  if (key === "checkpoint") {
    const n = remainingOptional(b);
    return say(b, n > 0 ? COPY.checkpointN(n) : COPY.checkpoint);
  }
  const q = questionByKey(key);
  return say(b, q ? q.prompt(b) : COPY.menu);
};

export const chipsFor = (b: Brief, key: string): string[] => {
  if (key === "checkpoint") return [COPY.checkpointContinue, COPY.checkpointFast, COPY.checkpointContact];
  const q = questionByKey(key);
  if (!q || q.mode === "multi") return [];
  const chips = (q.choices?.(b) ?? []).map((c) => c.label);
  if (q.skippable !== false) chips.push(SKIP);
  if (b.misses >= 1) chips.push(ARCHITECT_CHIP);
  return chips;
};

export const checkboxesFor = (b: Brief, key: string): string[] => {
  const q = questionByKey(key);
  return q?.mode === "multi" ? (q.choices?.(b) ?? []).map((c) => c.label) : [];
};

export const entryChips = () => ENTRY_CHOICES.map((c) => c.label);
export const generalChips = () => GENERAL_CHOICES.map((c) => c.label);
export const infoMenuChips = () => Object.values(INFO).map((i) => i.label).concat(MAIN_MENU_CHIP);
export const infoFollowups = () => INFO_FOLLOWUPS;

export const hasProjectData = (b: Brief) =>
  (b.kind === "new_project" && !!sectorOf(b)) || (b.kind === "client" && Object.keys(b.answers).length > 0);

// ── handling input ─────────────────────────────────────────────────────────
const isCommand = (text: string, list: string[]) => {
  const t = normalize(text).replace(/[.!?]+$/, "");
  return wordCount(t) <= 5 && list.some((c) => t === c || (c.includes(" ") && hasTerm(t, c)));
};

/** "Don't save this", "delete this conversation" and similar. */
export const isWithdrawRequest = (text: string): boolean => {
  const t = normalize(text).replace(/[.!?]+$/, "");
  if (isCommand(text, COMMANDS.withdraw)) return true;
  return wordCount(t) <= 8 && /\b(delete|erase|remove|forget)\b.{0,24}\b(conversation|chat|this|data|everything)\b/.test(t)
    && !/\b(project|wall|room|kitchen|bathroom|floor|building)\b/.test(t);
};

/** Is this one of the commands that work anywhere (start over, menu, architect)? */
export const isGlobalCommand = (text: string): boolean =>
  text === START_OVER_CHIP || text === MAIN_MENU_CHIP || text === ARCHITECT_CHIP
  || isCommand(text, COMMANDS.restart) || isCommand(text, COMMANDS.menu) || isCommand(text, COMMANDS.human) || isHumanRequest(text);

/** Main entry point: apply what the visitor sent at `at`, return where to go. */
export const handle = (b: Brief, at: Route, input: string, now = new Date()): Route => {
  const text = input.trim();

  if (text === START_OVER_CHIP || isCommand(text, COMMANDS.restart)) {
    resetBrief(b);
    return { to: "start" };
  }
  if (text === MAIN_MENU_CHIP || isCommand(text, COMMANDS.menu)) return { to: "menu" };
  if (text === ARCHITECT_CHIP || isCommand(text, COMMANDS.human) || isHumanRequest(text)) {
    b.misses = 0;
    return { to: "architect" };
  }

  const route = dispatch(b, at, text, now);
  if (applyContext(b, at, text) && route.to === "ask" && route.q !== "checkpoint" && !b.editing && b.kind === "new_project") {
    return nextRoute(b);
  }
  return route;
};

/** Add a considered note when the visitor mentions a situation that matters. */
const applyContext = (b: Brief, at: Route, text: string): boolean => {
  if (b.kind !== "new_project" || wordCount(text) < 2) return false;
  if (at.to === "ask") {
    const q = questionByKey(at.q);
    if (q && (q.mode === "multi" || q.stage === "contact" || (q.choices?.(b) ?? []).some((c) => c.label === text))) return false;
  }
  const t = normalize(text);
  const sector = sectorOf(b);
  let historic = false;
  let count = 0;
  for (const n of CONTEXT_NOTES) {
    if (count >= 1 || b.shown.includes(`ctx:${n.key}`)) continue;
    if (n.sectors && (!sector || !n.sectors.includes(sector))) continue;
    if (!n.terms.some((term) => hasTerm(t, term))) continue;
    once(b, `ctx:${n.key}`, n.note);
    count++;
    if (n.key === "historic") historic = true;
  }
  return historic;
};

const dispatch = (b: Brief, at: Route, text: string, now: Date): Route => {
  switch (at.to) {
    case "start":
    case "menu":
      return handleEntry(b, text, now);
    case "general":
      return handleGeneral(b, text, now);
    case "info":
      return handleInfo(b, text, now);
    case "ask":
      return handleAnswer(b, at.q, text, now);
    case "review":
      return handleReview(b, text);
    case "architect":
      if (text === REVIEW_SHARED_CHIP) {
        b.wrapUp = true;
        return nextRoute(b);
      }
      return handleEntry(b, text, now);
    case "sent":
      return handleEntry(b, text, now);
  }
};

const miss = (b: Brief, firstLine = COPY.fallback) => {
  b.misses += 1;
  b.notes.push(b.misses >= 2 ? COPY.fallbackHuman : firstLine);
};

/**
 * A question that wasn't understood. Never a loop: the first time, rephrase
 * with a hint; the second time on the same question, leave it for the
 * architect and move on; after three misses in a row, offer the studio.
 */
const missQuestion = (b: Brief, q: Q): Route => {
  b.misses += 1;
  const n = (b.qMisses[q.key] = (b.qMisses[q.key] ?? 0) + 1);
  if (b.misses >= 3) {
    b.misses = 0;
    b.notes.push(COPY.missContact);
    return { to: "architect" };
  }
  if (n >= 2 && q.skippable !== false) {
    set(b, q.id, { value: null, label: "Not provided", via: "text", skipped: true }, true);
    b.notes.push(COPY.leaveForArchitect);
    const misses = b.misses;
    const r = finishAnswer(b, q, []);
    b.misses = misses;
    return r;
  }
  const hint = COPY.hints[q.mode] ?? COPY.hints.text;
  b.notes.push(`${COPY.fallback} ${hint}`);
  return { to: "ask", q: q.key };
};

/** A question to the assistant ("how do fees work?") in the middle of the intake. */
const looksLikeQuestion = (text: string) =>
  /\?\s*$/.test(text) || /^(how|what|do|does|can|could|are|is|who|where|why|when)\b/i.test(text.trim());

const handleEntry = (b: Brief, text: string, now: Date): Route => {
  const entry = ENTRY_CHOICES.find((c) => c.label === text);
  if (entry) {
    if (entry.value === "general") return { to: "general" };
    startProject(b, entry.value as Sector, "chip");
    return nextRoute(b);
  }

  if (isClientMessage(text)) {
    b.kind = "client";
    const name = findName(text);
    if (name) set(b, "contactName", { value: name, label: name, via: "text", raw: text });
    const project = findProjectName(text);
    if (project) set(b, "clientProject", { value: project, label: project, via: "text", raw: text });
    if (wordCount(text) >= 6) set(b, "clientMessage", { value: text, label: text, via: "text", raw: text });
    captureContact(b, text);
    if (name) b.notes.push(`Hello, ${name.split(" ")[0]}. I'll pass this to the studio.`);
    return nextRoute(b);
  }

  const sector = classifySector(text);
  const topic = classifyTopic(text);
  const sectorStrength = sector.best ? sector.scores[sector.best] : 0;

  if (topic && sectorStrength < 3) {
    b.kind = "general";
    b.misses = 0;
    return { to: "info", topic };
  }
  if (sector.best) {
    startProject(b, sector.best, "inferred");
    if (wordCount(text) >= 4) set(b, "description", { value: text, label: text, via: "text", raw: text });
    const newly = extractAll(b, text, now);
    b.notes.push(acknowledge(b, ["sector", ...newly]));
    noteAfterChanges(b, newly);
    b.misses = 0;
    return nextRoute(b);
  }
  if (sector.close) {
    b.kind = "new_project";
    b.notes.push(COPY.closeCall);
    return { to: "ask", q: "sector" };
  }
  miss(b, COPY.fallbackPickOne);
  return { to: "menu" };
};

const handleGeneral = (b: Brief, text: string, now: Date): Route => {
  const choice = GENERAL_CHOICES.find((c) => c.label === text);
  if (choice?.value === "client") {
    b.kind = "client";
    return nextRoute(b);
  }
  if (choice?.value === "info") return { to: "info", topic: "menu" };
  if (choice?.value === "vendors") return { to: "info", topic: "vendors" };
  return handleEntry(b, text, now);
};

const handleInfo = (b: Brief, text: string, now: Date): Route => {
  if (text === "Ask something else") return { to: "info", topic: "menu" };
  if (text === "Start a project") {
    b.kind = "new_project";
    return nextRoute(b);
  }
  const byLabel = Object.entries(INFO).find(([, i]) => i.label === text);
  if (byLabel) return { to: "info", topic: byLabel[0] };
  return handleEntry(b, text, now);
};

const handleReview = (b: Brief, text: string): Route => {
  if (text === SEND_CHIP || /\b(send|submit|looks (right|good)|correct|yes)\b/.test(normalize(text))) {
    if (!filled(b, "contactName") || !filled(b, "contactReach")) {
      b.wrapUp = true;
      return nextRoute(b);
    }
    b.status = "sent";
    return { to: "sent" };
  }
  b.notes.push("Use Edit beside any line to change it, or send it as it is.");
  return { to: "review" };
};

const startProject = (b: Brief, sector: Sector, via: "chip" | "inferred") => {
  b.kind = "new_project";
  const label = { residential: "Residential", commercial: "Commercial", hospitality: "Hospitality", institutional: "Institutional" }[sector];
  set(b, "sector", { value: sector, label, via }, true);
};

/** Begin editing one slot from the review card. */
export const beginEdit = (b: Brief, id: SlotId): Route => {
  const q = ALL_QUESTIONS.find((q) => q.id === id && (b.kind === "client" ? q.stage === "client" : q.stage !== "client") && applies(b, q))
    ?? ALL_QUESTIONS.find((q) => q.id === id);
  if (!q) return { to: "review" };
  b.editing = id;
  delete b.answers[id];
  return { to: "ask", q: q.key };
};

// ── answering a question ───────────────────────────────────────────────────
const matchChoice = (choices: Choice[], text: string): Choice | undefined => {
  const exact = choices.find((c) => c.label.toLowerCase() === text.toLowerCase());
  if (exact) return exact;
  const t = normalize(text);
  let best: { c: Choice; len: number } | undefined;
  for (const c of choices) {
    for (const k of [c.label.toLowerCase(), ...(c.keys ?? [])]) {
      if (hasTerm(t, k) && (!best || k.length > best.len)) best = { c, len: k.length };
    }
  }
  return best?.c;
};

const bandFor = (choices: Choice[], n: number) =>
  choices.find((c) => c.min !== undefined && c.max !== undefined && n >= c.min && n < c.max);

const handleAnswer = (b: Brief, key: string, text: string, now: Date): Route => {
  if (key === "checkpoint") {
    const t = normalize(text);
    if (text === COPY.checkpointContact) return { to: "architect" };
    if (text === COPY.checkpointContinue || /\b(continue|yes|sure|ok|okay|go on|more)\b/.test(t)) b.checkpoint = "continue";
    else if (text === COPY.checkpointFast || /\b(send|review|no|done|that's all|finish)\b/.test(t)) b.checkpoint = "fast";
    else {
      b.misses += 1;
      if (b.misses >= 3) { b.misses = 0; b.notes.push(COPY.missContact); return { to: "architect" }; }
      b.notes.push(`${COPY.fallback} ${COPY.hints.choice}`);
      return { to: "ask", q: key };
    }
    b.misses = 0;
    return nextRoute(b);
  }

  const q = questionByKey(key);
  if (!q) return nextRoute(b);
  const choices = q.choices?.(b) ?? [];

  // "That's all" / "send it": stop the questions, ask only for contact details.
  if (q.stage !== "contact" && q.stage !== "client" && b.kind === "new_project" && isCommand(text, COMMANDS.finish)) {
    b.wrapUp = true;
    b.checkpoint = b.checkpoint ?? "fast";
    b.misses = 0;
    const r = nextRoute(b);
    if (r.to === "ask") b.notes.push(COPY.finishNote);
    return r;
  }

  // A question about the studio mid-intake: answer it, then return to the project.
  if (!choices.some((c) => c.label === text) && looksLikeQuestion(text)) {
    const topic = classifyTopic(text);
    if (topic && INFO[topic]) {
      b.notes.push(INFO[topic].answer, COPY.backToProject);
      return { to: "ask", q: key };
    }
  }

  // Skip / not sure
  if (text === SKIP || isCommand(text, COMMANDS.skip)) {
    if (q.skippable === false) {
      b.notes.push(q.mode === "reach" ? COPY.reachRequired : COPY.nameRequired);
      return q.mode === "reach" ? { to: "architect" } : { to: "ask", q: key };
    }
    set(b, q.id, { value: null, label: "Not provided", via: "chip", skipped: true }, true);
    b.notes.push(COPY.skipped);
    return finishAnswer(b, q, []);
  }
  if (isCommand(text, COMMANDS.notSure) && q.mode !== "text") {
    const unsure = choices.find((c) => c.value === null);
    set(b, q.id, { value: null, label: unsure?.label ?? "Not sure yet", via: "chip" }, true);
    return finishAnswer(b, q, []);
  }

  const answered = answerCurrent(b, q, choices, text, now);
  const typed = !choices.some((c) => c.label === text) && !(q.mode === "multi");
  const others = typed && wordCount(text) >= 2 && q.id !== "solicitationDetails" ? extractAll(b, text, now, q.id) : [];

  if (!answered) {
    if (q.mode === "reach") { b.misses += 1; b.notes.push(COPY.reachInvalid); return { to: "ask", q: key }; }
    if (q.mode === "name") { b.notes.push(COPY.nameRequired); return { to: "ask", q: key }; }
    if (!others.length) return missQuestion(b, q);
    b.notes.push(acknowledge(b, others));
    noteAfterChanges(b, others);
    b.misses = 0;
    return nextRoute(b);
  }
  if (others.length) b.notes.push(acknowledge(b, others));
  return finishAnswer(b, q, others);
};

const finishAnswer = (b: Brief, q: Q, others: SlotId[]): Route => {
  b.misses = 0;
  const noteKey = q.after?.(b);
  if (noteKey && NOTES[noteKey as keyof typeof NOTES] && typeof NOTES[noteKey as keyof typeof NOTES] === "string") {
    once(b, `after:${noteKey}`, NOTES[noteKey as keyof typeof NOTES] as string);
  }
  noteAfterChanges(b, [q.id, ...others]);
  if (b.editing) {
    b.editing = null;
    b.notes.push(COPY.editNote);
    return { to: "review" };
  }
  return nextRoute(b);
};

/** Try to answer the current question from a chip or typed text. */
const answerCurrent = (b: Brief, q: Q, choices: Choice[], text: string, now: Date): boolean => {
  const chip = choices.find((c) => c.label === text);
  if (chip && q.mode !== "multi") {
    set(b, q.id, { value: chip.value, label: chip.label, via: "chip" }, true);
    if (q.id === "projectType") return true;
    return true;
  }
  const t = normalize(text);
  switch (q.mode) {
    case "choice": {
      if (q.id === "tiAllowance") {
        const m = findMoney(text, true);
        if (m?.perSf) return set(b, q.id, { value: "yes", label: `Yes — $${m.perSf}/SF`, via: "text", raw: text }, true);
        if (m?.amount) return set(b, q.id, { value: "yes", label: `Yes — ${m.label?.replace("about ", "")}`, via: "text", raw: text }, true);
      }
      if (q.id === "projectType") {
        const sector = sectorOf(b);
        const type = sector ? classifyType(sector, text) : null;
        const c = type ? choices.find((x) => x.value === type) : matchChoice(choices, text);
        if (c) return set(b, q.id, { value: c.value, label: c.label, via: "text", raw: text }, true);
        return false;
      }
      if (q.id === "siteStatus") {
        const s = findSiteStatus(text, sectorOf(b));
        const c = s ? choices.find((x) => x.value === s) : undefined;
        if (s) return set(b, q.id, { value: s, label: c?.label ?? SITE_STATUS_LABELS[s] ?? s, via: "text", raw: text }, true);
      }
      const c = matchChoice(choices, text);
      if (c) return set(b, q.id, { value: c.value, label: c.label, via: "text", raw: text }, true);
      return false;
    }
    case "count": {
      const counts = findCounts(text);
      const n = (q.id === "keys" ? counts.keys : counts.seats) ?? findBareNumber(text);
      if (n) return set(b, q.id, { value: n, label: formatNumber(n), via: "text", raw: text }, true);
      const c = matchChoice(choices, text);
      return c ? set(b, q.id, { value: c.value, label: c.label, via: "text", raw: text }, true) : false;
    }
    case "area": {
      const n = findAreas(text)[0]?.value ?? findBareNumber(text);
      if (n && n >= 50) return set(b, q.id, { value: n, label: `About ${formatNumber(n)} SF`, via: "text", raw: text }, true);
      const c = matchChoice(choices, text);
      return c ? set(b, q.id, { value: c.value, label: c.label, via: "text", raw: text }, true) : false;
    }
    case "budget": {
      const m = findMoney(text, true);
      if (m?.amount) {
        const band = bandFor(choices, m.amount);
        return set(b, q.id, { value: m.amount, label: `${capitalizeFirst(m.label!)}${band ? ` (${band.label})` : ""}`, via: "text", raw: text }, true);
      }
      if (m?.perSf) return set(b, q.id, { value: null, label: `$${m.perSf}/SF`, via: "text", raw: text }, true);
      const c = matchChoice(choices, text);
      return c ? set(b, q.id, { value: c.value, label: c.label, via: "text", raw: text }, true) : false;
    }
    case "timeline": {
      const tl = findTimeline(text, now);
      if (tl) return set(b, q.id, { value: tl, label: tl.text, via: "text", raw: text }, true);
      const c = matchChoice(choices, text);
      if (c) return set(b, q.id, { value: { text: c.label, approxMonth: null }, label: c.label, via: "text", raw: text }, true);
      if (wordCount(text) <= 12) return set(b, q.id, { value: { text, approxMonth: null }, label: text, via: "text", raw: text }, true);
      return false;
    }
    case "location": {
      const loc = findLocation(text, true) ?? (wordCount(text) <= 8 ? { text, region: "unknown" as const } : null);
      return loc ? set(b, q.id, { value: loc, label: loc.text, via: "text", raw: text }, true) : false;
    }
    case "text": {
      if (q.id === "solicitationDetails") {
        const d = findSolicitation(text) ?? text;
        return set(b, q.id, { value: d, label: d, via: "text", raw: text }, true);
      }
      if (q.id === "company") {
        if (/^(no|none|nope|n\/a|na|not applicable|no company|individual|myself|just me|personal|private)\.?$/i.test(text.trim())) {
          return set(b, q.id, { value: null, label: "Not provided", via: "text", skipped: true, raw: text }, true);
        }
        const name = text.replace(/^(it'?s|it is|we are|we're|the company is|company is|i'?m with|i work for|with)\s+/i, "").replace(/[.\s]+$/, "").slice(0, 160);
        return name.length > 0 && set(b, q.id, { value: name, label: name, via: "text", raw: text }, true);
      }
      return text.length > 0 && set(b, q.id, { value: text, label: text, via: "text", raw: text }, true);
    }
    case "name": {
      const name = cleanName(text);
      if (!name) return false;
      set(b, q.id, { value: name, label: name, via: "text", raw: text }, true);
      captureContact(b, text);
      return true;
    }
    case "reach": {
      const email = findEmail(text);
      const phone = findPhone(text);
      if (!email && !phone) return false;
      return set(b, q.id, reachAnswer({ email: email ?? undefined, phone: phone ?? undefined }, text), true);
    }
    case "multi": {
      const parts = text.split(", ").map((s) => s.trim());
      const picked = choices.filter((c) => parts.includes(c.label));
      let values: string[];
      if (picked.length) values = picked.map((c) => String(c.value));
      else if (/\b(none|no|nothing|neither|n\/a)\b/.test(t)) values = ["none"];
      else {
        const found = q.id === "documents" ? findDocuments(text, true) : findSpecial(text);
        const allowed = new Set(choices.map((c) => String(c.value)));
        values = found.filter((v) => allowed.has(v));
        if (!values.length) return false;
      }
      values = values.includes("none") ? [] : values;
      const labels = values.map((v) => choices.find((c) => c.value === v)?.label ?? v);
      return set(b, q.id, { value: values, label: labels.length ? labels.join(", ") : "None", via: picked.length ? "chip" : "text", raw: text }, true);
    }
  }
  return false;
};

const capitalizeFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const reachAnswer = (r: { email?: string; phone?: string }, raw: string): Answer => ({
  value: r,
  label: [r.email, r.phone].filter(Boolean).join(" · "),
  via: "text",
  raw,
});

const captureContact = (b: Brief, text: string) => {
  const email = findEmail(text);
  const phone = findPhone(text);
  if (email || phone) set(b, "contactReach", reachAnswer({ email: email ?? undefined, phone: phone ?? undefined }, text));
};

// ── extracting everything else from typed text ─────────────────────────────
/** Fill any unanswered slots the text clearly answers. Returns the slots filled. */
export const extractAll = (b: Brief, text: string, now = new Date(), except?: SlotId): SlotId[] => {
  const out: SlotId[] = [];
  const put = (id: SlotId, a: Answer) => {
    if (id === except) return;
    if (set(b, id, a)) out.push(id);
  };
  const sector = sectorOf(b);

  if (sector && !has(b, "projectType")) {
    const type = classifyType(sector, text);
    const c = type ? PROJECT_TYPES[sector].find((x) => x.value === type) : undefined;
    if (c) put("projectType", { value: c.value, label: c.label, via: "inferred", raw: text });
  }

  const loc = findLocation(text, false);
  if (loc) put("location", { value: loc, label: loc.text, via: "text", raw: text });

  for (const hit of findAreas(text)) {
    const n = hit.value;
    const a: Answer = { value: n, label: `About ${formatNumber(n)} SF`, via: "text", raw: text };
    if (sector === "residential") {
      const type = typeOf(b) ?? "";
      const proposed = hit.kind === "proposed" || (hit.kind === "unknown" && ["addition", "new_home", "guest_house"].includes(type));
      put(proposed ? "proposedSf" : "existingSf", a);
    } else {
      put("sizeSf", a);
    }
  }

  const counts = findCounts(text);
  if (counts.keys && (sector === "hospitality" || !sector)) put("keys", { value: counts.keys, label: formatNumber(counts.keys), via: "text", raw: text });
  if (counts.seats) put("seats", { value: counts.seats, label: formatNumber(counts.seats), via: "text", raw: text });

  const money = findMoney(text);
  if (money?.perSf && sector === "commercial") put("tiAllowance", { value: "yes", label: `Yes — $${money.perSf}/SF`, via: "text", raw: text });
  else if (money?.amount) put("budget", { value: money.amount, label: capitalizeFirst(money.label!), via: "text", raw: text });

  // A solicitation's due date is not the project timeline.
  const tl = findSolicitation(text) ? null : findTimeline(text, now);
  if (tl) put("timeline", { value: tl, label: tl.text, via: "text", raw: text });

  const status = findSiteStatus(text, sector);
  if (status) put("siteStatus", { value: status, label: SITE_STATUS_LABELS[status] ?? status, via: "inferred", raw: text });

  const docs = findDocuments(text, false);
  if (docs.length) put("documents", { value: docs, label: docs.join(", "), via: "text", raw: text });

  if (sector) {
    const allowed = new Set(SPECIAL(b).map((c) => String(c.value)));
    const special = findSpecial(text).filter((s) => allowed.has(s));
    if (special.length) {
      const labels = special.map((s) => SPECIAL(b).find((c) => c.value === s)?.label ?? s);
      put("special", { value: special, label: labels.join(", "), via: "text", raw: text });
    }
  }

  if (sector === "institutional" || !sector) {
    const sol = findSolicitation(text);
    if (sol) {
      put("solicitation", { value: "yes", label: "Yes", via: "inferred", raw: text });
      put("solicitationDetails", { value: sol, label: sol, via: "text", raw: text });
    }
  }

  if (sector === "hospitality" && /\b(soft brand|brand|branded|operator|franchise|flag(ged)?)\b/.test(normalize(text)) && !/\b(no|not|independent)\b.{0,12}\b(brand|operator)/.test(normalize(text))) {
    put("brand", { value: "brand", label: "Operator or brand", via: "text", raw: text });
  }
  if (sector === "hospitality" && /\b(new construction|ground[- ]up|new build(ing)?)\b/.test(normalize(text))) {
    put("workType", { value: "new", label: "New construction", via: "text", raw: text });
  }

  const name = findName(text);
  if (name) put("contactName", { value: name, label: name, via: "text", raw: text });
  const email = findEmail(text);
  const phone = findPhone(text);
  if (email || phone) put("contactReach", reachAnswer({ email: email ?? undefined, phone: phone ?? undefined }, text));

  return out;
};

// ── acknowledgements and one-off notes ─────────────────────────────────────
const lc = (s: string) => (/^[A-Z][a-z]/.test(s) && !/^(Q\d|January|February|March|April|May|June|July|August|September|October|November|December)/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

/** "Thank you. I've noted a 40-key hotel in Delray Beach, opening in 2028." */
export const acknowledge = (b: Brief, ids: SlotId[]): string => {
  const a = ack(b);
  const parts: string[] = [];
  const sector = sectorOf(b);
  const typeChoice = sector ? PROJECT_TYPES[sector].find((c) => c.value === typeOf(b)) : undefined;
  const loc = value(b, "location") as LocationValue | undefined;
  const keys = value(b, "keys") as number | undefined;

  if (ids.includes("projectType") || ids.includes("sector")) {
    let noun = typeChoice?.noun ?? (sector ? `a ${sector} project` : "");
    if (typeChoice?.value === "hotel" && keys && ids.includes("keys")) noun = `a ${keys}-key hotel`;
    if (noun) parts.push(noun + (loc && ids.includes("location") ? ` in ${loc.text}` : ""));
    else if (loc && ids.includes("location")) parts.push(`a project in ${loc.text}`);
  } else if (loc && ids.includes("location")) {
    parts.push(`the location, ${loc.text}`);
  }
  if (ids.includes("workType") && value(b, "workType") === "new") parts.push("new construction");
  if (ids.includes("keys") && !(typeChoice?.value === "hotel" && (ids.includes("projectType") || ids.includes("sector")))) parts.push(`${keys} keys`);
  if (ids.includes("seats")) parts.push(`${value(b, "seats")} seats`);
  if (ids.includes("existingSf")) parts.push(`about ${formatNumber(value(b, "existingSf") as number)} SF existing`);
  if (ids.includes("proposedSf")) parts.push(`about ${formatNumber(value(b, "proposedSf") as number)} SF of new space`);
  if (ids.includes("sizeSf")) parts.push(`about ${formatNumber(value(b, "sizeSf") as number)} SF`);
  if (ids.includes("budget")) parts.push(`a budget of ${b.answers.budget!.label.replace(/^About /, "about ")}`);
  if (ids.includes("tiAllowance")) parts.push(`a TI allowance of ${b.answers.tiAllowance!.label.replace("Yes — ", "")}`);
  if (ids.includes("timeline")) {
    const tl = value(b, "timeline") as TimelineValue;
    parts.push(`${sector === "hospitality" ? "opening" : "timing"} ${lc(tl.text)}`);
  }
  if (ids.includes("siteStatus")) {
    const s = String(value(b, "siteStatus"));
    parts.push({
      owned: sector === "residential" ? "that you own the property" : "that the site is owned",
      under_contract: "the property under contract", loi: "an LOI signed", leased: "a signed lease",
      negotiating: "lease negotiations under way", searching: "that you're still looking for a site",
    }[s] ?? s);
  }
  if (ids.includes("brand")) parts.push("an operator or brand involved");
  if (ids.includes("special")) parts.push(lc(b.answers.special!.label));
  if (!parts.length) return a;
  b.lastAck = a;
  return ackWith(b, joinList(parts));
};

/** Notes triggered by what's now known; each appears once per conversation. */
const noteAfterChanges = (b: Brief, changed: SlotId[]) => {
  const loc = value(b, "location") as LocationValue | undefined;
  if (changed.includes("location") && loc) {
    if (loc.region === "south_florida") once(b, "region", NOTES.southFlorida);
    else if (loc.region === "licensed") once(b, "region", NOTES.licensed);
    else if (loc.region === "outside") once(b, "region", NOTES.outside);
  }
  if (value(b, "siteStatus") === "searching" || value(b, "stage") === "needs_assessment") {
    once(b, "feasibility", NOTES.feasibility);
  }
  if (sectorOf(b) === "institutional" && (loc?.county === "Palm Beach" || ["municipal", "school"].includes(typeOf(b) ?? ""))) {
    once(b, "sbe", NOTES.sbe);
  }
  if (changed.includes("solicitationDetails") && filled(b, "solicitationDetails")) {
    once(b, "rfq", NOTES.rfq(String(value(b, "solicitationDetails"))));
  }
};
