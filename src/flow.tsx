// Adapter between the conversation engine and React ChatBotify.
// No conversation content lives here: copy is in conversation/content,
// logic in conversation/engine, saving in sync/. Each step gets a unique path
// name so earlier option chips are disabled once the conversation moves on.

import type { Block, Flow, Params } from "react-chatbotify";
import { COPY, INFO } from "./conversation/content/copy";
import {
  MAIN_MENU_CHIP, REVIEW_SHARED_CHIP, SEND_CHIP, START_OVER_CHIP,
  checkboxesFor, chipsFor, entryChips, generalChips, handle, hasProjectData, infoFollowups,
  infoMenuChips, isGlobalCommand, isWithdrawRequest, nextRoute, promptFor, resetBrief, say,
} from "./conversation/engine/conversation";
import { mailtoHref, reviewRows, subjectLine, toRecord, whatsappHref, whatsappText } from "./conversation/engine/summary";
import { cleanName, findEmail } from "./conversation/engine/extract";
import { STUDIO } from "./conversation/content/copy";
import type { Brief, ReachValue, Route } from "./conversation/schema";
import {
  BookingCard, ContactOptions, PortfolioCard, PrivacyLink, ReviewCard, SendCard, SentCard, WhatsAppCard,
  contactActions, liveHooks, whatsappStore,
} from "./components";
import { pathFor, routeOf, session, type ContactStep, type FlowRoute } from "./session";
import { LiveBridge, endLive, live, sendLive, startLive } from "./live";
import { sync } from "./sync";

const saving = () => sync.enabled;

// ── recording the conversation (a no-op unless saving is switched on) ──────
let offered = new Set<string>();
let offeredBoxes = false;
const offer = (chips: string[]) => { offered = new Set(chips); return chips; };
const offerBoxes = (items: string[]) => { offeredBoxes = items.length > 0; return items; };

const stepOf = (r: FlowRoute) => (r.to === "ask" ? r.q : r.to === "info" ? `info:${r.topic}` : r.to === "contact" ? r.step : r.to);

/** Record an assistant message as it is shown. */
const shown = (text: string, step: string) => { sync.log("assistant", "text", text, step); return text; };
const card = (text: string, step: string) => sync.log("assistant", "card", text, step);

const logVisitor = (input: string, at: FlowRoute) => {
  const type = offered.has(input) ? "choice" : offeredBoxes && input.includes(", ") ? "selection" : "text";
  sync.log("visitor", type, input, stepOf(at));
};

/** Something about the project itself has been shared (choosing a pathway alone doesn't count). */
const hasRealAnswer = (b: Brief) => Object.keys(b.answers).some((k) => k !== "sector");

const contactOf = (b: Brief) => {
  const reach = (b.answers.contactReach?.value ?? {}) as ReachValue;
  const company = b.answers.company;
  return {
    name: String(b.answers.contactName?.value ?? ""),
    email: reach.email ?? "",
    phone: reach.phone ?? "",
    company: company && !company.skipped ? String(company.value) : "",
  };
};

// The exact wording each kind of consent was given against (fingerprinted on the server).
const consentText = () => `${COPY.privacyNotice}\n${COPY.consentAsk}`;
const sendText = () => `${COPY.privacyNotice}\n${COPY.reviewPrivateNote}`;

/** After the engine decides where to go: keep the record current, and ask for consent at the first real answer. */
const afterInput = (b: Brief, next: Route): FlowRoute => {
  if (!saving()) return next;
  if (b.kind === "new_project" || b.kind === "client") sync.setRecord(toRecord(b));
  if (sync.consent === "yes") sync.saveResume(b, next);
  if (sync.consent === "unasked" && hasRealAnswer(b) && (next.to === "ask" || next.to === "review")) return { to: "consent", next };
  return next;
};

const YES = /\b(yes|yeah|yep|sure|ok|okay|fine|please|save|go ahead)\b/;
const NO = /\b(no|nope|private|don't|dont|do not|rather not|not now|no thanks)\b/;
const UNSURE = /\b(not sure|unsure|maybe|don't know|dont know)\b/;

const answerConsent = (b: Brief, next: Route, input: string): FlowRoute => {
  const t = input.toLowerCase();
  if (input === COPY.consentYes || (YES.test(t) && !NO.test(t) && !UNSURE.test(t))) {
    sync.agree(consentText());
    b.notes.push(COPY.consentSaved);
    sync.setRecord(toRecord(b));
    sync.saveResume(b, next);
    return next;
  }
  if (input === COPY.consentNo || (NO.test(t) && !UNSURE.test(t))) {
    sync.decline();
    b.notes.push(COPY.consentPrivate);
    return next;
  }
  if (isGlobalCommand(input)) {
    sync.decline();
    return afterInput(b, handle(b, next, input));
  }
  b.notes.push("A simple yes or no is fine.");
  return { to: "consent", next };
};

const answerResume = (b: Brief, input: string): FlowRoute => {
  const saved = sync.peekResume();
  if (saved && (input === COPY.resumeYes || /\b(continue|yes|resume|carry on)\b/i.test(input))) {
    sync.resumeAccepted();
    resetBrief(b);
    Object.assign(b, saved.brief as Brief, { notes: [], editing: null, misses: 0 });
    sync.log("assistant", "text", COPY.resumeAsk, "resume");
    sync.log("visitor", "choice", input, "resume");
    const where = b.kind === "new_project" ? subjectLine(b).replace(/^New inquiry — /, "") : "";
    b.notes.push(where ? `Here's where we were: ${where}.` : COPY.resumeRecap);
    const r = saved.route as Route | undefined;
    return r && (r.to === "ask" || r.to === "review") ? r : nextRoute(b);
  }
  sync.resumeDeclined();
  return { to: "start" };
};

// ── contact options: WhatsApp, email, phone, live chat ─────────────────────
const step = (s: ContactStep): FlowRoute => ({ to: "contact", step: s });
const reachOf = (b: Brief) => (b.answers.contactReach?.value ?? {}) as ReachValue;
const setReach = (b: Brief, r: ReachValue, raw: string) => {
  b.answers.contactReach = { value: r, label: [r.email, r.phone].filter(Boolean).join(" · "), via: "text", raw };
};
const handoffText = () => `${COPY.privacyNotice}\n${COPY.handoffNotice}`;
const syncRecord = (b: Brief) => { if (saving() && b.kind) sync.setRecord(toRecord(b)); };

const waStart = (b: Brief): FlowRoute =>
  saving() && sync.consent !== "yes" && !sync.submittedRef ? step("wa") : waAfterConsent(b);

const waAfterConsent = (b: Brief): FlowRoute => {
  if (saving() && !reachOf(b).email && !b.shown.includes("wa-email")) {
    b.shown.push("wa-email");
    return step("wa-email");
  }
  return step("wa-preview");
};

const emStart = (b: Brief): FlowRoute => {
  if (sync.submittedRef) return step("em-already");
  b.wrapUp = true;
  if (!b.answers.contactName || b.answers.contactName.skipped) return step("em-name");
  if (!reachOf(b).email) return step("em-email");
  if (!b.shown.includes("em-note")) return step("em-note");
  return { to: "review" };
};

const liveStart = (available = false): FlowRoute => {
  if (!saving() || !available) return step("live");
  if (sync.consent !== "yes" && !sync.submittedRef) return step("live-consent");
  return liveAfterConsent(session.brief);
};

const liveAfterConsent = (b: Brief): FlowRoute => {
  if (!reachOf(b).email && !b.shown.includes("live-email")) {
    b.shown.push("live-email");
    return step("live-email");
  }
  return step("live-wait");
};

contactActions.whatsapp = () => {
  sync.log("visitor", "choice", "Continue on WhatsApp", "contact");
  return pathFor(waStart(session.brief));
};
contactActions.email = () => {
  sync.log("visitor", "choice", "Email the studio", "contact");
  sync.channelEvent("email", "selected");
  return pathFor(emStart(session.brief));
};
contactActions.live = (available: boolean) => {
  sync.log("visitor", "choice", "Connect with a live agent", "contact");
  return pathFor(liveStart(available));
};
liveHooks.onVisitorEnd = () => { session.brief.notes.push(COPY.liveEndedVisitor); };
contactActions.phone = () => {
  sync.log("visitor", "choice", "Call the studio", "contact");
  sync.channelEvent("phone", "selected");
};

const isBack = (t: string) => t === COPY.back || /^(back|go back|cancel)$/i.test(t);
const isSkip = (t: string) => t === COPY.optional || /^(skip|no|no thanks|none|not now|n\/a)\.?$/i.test(t);

const answerContact = async (b: Brief, s: ContactStep, input: string): Promise<FlowRoute> => {
  // During live chat everything typed goes to the studio, except "end chat".
  if ((s === "live-wait" || s === "live-chat") && live.active) {
    if (/^(end( the)? chat|end|leave|stop chat|bye)\.?$/i.test(input)) {
      await endLive();
      b.notes.push(COPY.liveEndedVisitor);
      return step("live-ended");
    }
    if (!(await sendLive(input))) return step("live-note");
    return step("live-chat");
  }
  if (isGlobalCommand(input)) return afterInput(b, handle(b, { to: "menu" }, input));
  switch (s) {
    case "live-consent":
      if (input === COPY.handoffContinue || /\b(yes|ok|okay|sure|continue|go ahead)\b/i.test(input)) {
        sync.agreeHandoff(handoffText());
        syncRecord(b);
        return liveAfterConsent(b);
      }
      return { to: "architect" };
    case "live-email": {
      if (isSkip(input)) return step("live-wait");
      const email = findEmail(input);
      if (email) { setReach(b, { ...reachOf(b), email }, input); syncRecord(b); }
      return step("live-wait");
    }
    case "wa":
      if (input === COPY.handoffContinue || /\b(yes|ok|okay|sure|continue|go ahead)\b/i.test(input)) {
        sync.agreeHandoff(handoffText());
        syncRecord(b);
        return waAfterConsent(b);
      }
      return { to: "architect" };
    case "wa-email": {
      if (isSkip(input)) return step("wa-preview");
      const email = findEmail(input);
      if (email) {
        setReach(b, { ...reachOf(b), email }, input);
        syncRecord(b);
        return step("wa-preview");
      }
      if (!b.shown.includes("wa-email-retry")) {
        b.shown.push("wa-email-retry");
        b.notes.push(COPY.emailInvalid);
        return step("wa-email");
      }
      return step("wa-preview");
    }
    case "em-name": {
      if (isBack(input)) return { to: "architect" };
      const name = cleanName(input);
      if (!name) { b.notes.push(COPY.nameRequired); return step("em-name"); }
      b.answers.contactName = { value: name, label: name, via: "text", raw: input };
      syncRecord(b);
      return emStart(b);
    }
    case "em-email": {
      if (isBack(input)) return { to: "architect" };
      const email = findEmail(input);
      if (!email) { b.notes.push(COPY.emailInvalid); return step("em-email"); }
      setReach(b, { ...reachOf(b), email }, input);
      syncRecord(b);
      return emStart(b);
    }
    case "em-note":
      b.shown.push("em-note");
      if (!isSkip(input) && input.length > 1) b.answers.note = { value: input, label: input.slice(0, 2000), via: "text", raw: input };
      syncRecord(b);
      return emStart(b);
    case "em-already":
      if (input === COPY.addNote || /\b(yes|add|note)\b/i.test(input)) return step("note");
      return afterInput(b, handle(b, { to: "architect" }, input));
    case "note": {
      if (isBack(input)) return { to: "menu" };
      const ref = sync.submittedRef;
      const ok = await sync.note(input);
      b.notes.push(ok && ref ? COPY.noteAdded(ref) : COPY.noteFailed);
      return { to: "menu" };
    }
    case "wa-preview":
      if (isBack(input)) return { to: "architect" };
      return afterInput(b, handle(b, { to: "architect" }, input));
    default:
      return afterInput(b, handle(b, { to: "architect" }, input));
  }
};

/** Typed shortcuts for the contact options, honoured outside questions. */
const shortcut = (b: Brief, input: string): FlowRoute | null => {
  const t = input.toLowerCase().replace(/[.!?]+$/, "").trim();
  if (/^(continue on |use )?whatsapp$/.test(t)) return waStart(b);
  if (/^(email( the studio)?|send an email)$/.test(t)) return emStart(b);
  if (/^(live chat|live agent|connect with a live agent)$/.test(t)) return liveStart();
  return null;
};

/** Every visitor input passes through here. */
const routeInput = (b: Brief, at: FlowRoute) => async (p: Params) => {
  const input = (p.userInput ?? "").trim();
  if (saving() && at.to !== "consent" && isWithdrawRequest(input)) {
    if (live.active) await endLive();
    const had = sync.withdraw();
    b.notes.push(had ? COPY.withdrawn : COPY.withdrawnNothing);
    return pathFor(at.to === "start" || at.to === "resume" || at.to === "sent" || at.to === "contact" ? { to: "menu" } : at);
  }
  // While a live chat is running, everything the visitor sends goes to the studio,
  // wherever the assistant happens to be (an older chip, a stale step).
  if (live.active) return pathFor(await answerContact(b, "live-chat", input));
  logVisitor(input, at); // live messages are saved by the live-chat endpoint instead
  if (at.to === "consent") return pathFor(answerConsent(b, at.next, input));
  if (at.to === "resume") return pathFor(answerResume(b, input));
  if (at.to === "contact") return pathFor(await answerContact(b, at.step, input));
  if (at.to !== "ask") {
    const sc = shortcut(b, input);
    if (sc) return pathFor(sc);
  }
  return pathFor(afterInput(b, handle(b, at, input)));
};

// ── blocks ─────────────────────────────────────────────────────────────────
const blockFor = (route: FlowRoute): Block => {
  const b = session.brief;
  const path = routeInput(b, route);

  switch (route.to) {
    case "start":
    case "resume":
      if (saving() && sync.peekResume()) {
        return { message: () => COPY.resumeAsk, options: offer([COPY.resumeYes, COPY.resumeNo]), path: routeInput(b, { to: "resume" }) };
      }
      return {
        message: () => {
          resetBrief(b);
          sync.startNew();
          return shown(saving() ? `${COPY.welcome}\n\n${COPY.privacyNotice}` : COPY.welcome, "welcome");
        },
        ...(saving() ? { component: <PrivacyLink /> } : {}),
        options: offer(entryChips()),
        path: routeInput(b, { to: "start" }),
      };
    case "consent":
      return { message: () => shown(say(b, COPY.consentAsk), "consent"), options: offer([COPY.consentYes, COPY.consentNo]), path };
    case "menu":
      return { message: () => shown(say(b, COPY.menu), "menu"), options: offer(entryChips()), path };
    case "general":
      return { message: () => shown(say(b, COPY.generalMenu), "general"), options: offer(generalChips()), path };
    case "info": {
      const step = `info:${route.topic}`;
      if (route.topic === "menu") return { message: () => shown(say(b, COPY.infoMenu), step), options: offer(infoMenuChips()), path };
      const info = INFO[route.topic];
      return {
        message: () => {
          const text = shown(say(b, info?.answer ?? COPY.fallback), step);
          if (route.topic === "portfolio") card("[Portfolio link shown]", step);
          return text;
        },
        ...(route.topic === "portfolio" ? { component: <PortfolioCard /> } : {}),
        ...(["fees", "phases", "booking"].includes(route.topic) ? { component: <BookingCard /> } : {}),
        options: offer(infoFollowups()),
        path,
      };
    }
    case "ask": {
      const key = route.q;
      return {
        message: () => shown(promptFor(b, key), key),
        options: () => offer(chipsFor(b, key)),
        checkboxes: () => ({ items: offerBoxes(checkboxesFor(b, key)), min: 1 }),
        path,
      };
    }
    case "review":
      return {
        message: () => {
          b.status = "reviewed";
          let text = say(b, b.kind === "client" ? COPY.reviewClient : COPY.review);
          if (saving() && sync.consent !== "yes") text = `${text} ${COPY.reviewPrivateNote}`;
          shown(text, "review");
          card(`[Summary shown]\n${reviewRows(b).map((r) => `${r.label}: ${r.value}`).join("\n")}`, "review");
          return text;
        },
        component: () => <ReviewCard rows={reviewRows(b)} />,
        options: offer([SEND_CHIP, START_OVER_CHIP]),
        path,
      };
    case "sent":
      if (!saving()) {
        return {
          message: () => say(b, COPY.sent),
          component: () => <SendCard mailto={mailtoHref(b)} />,
          options: [START_OVER_CHIP, MAIN_MENU_CHIP],
          path,
        };
      }
      return {
        message: async () => {
          const res = await sync.submit(toRecord(b), contactOf(b), sendText());
          const text = shown(say(b, res.ok && res.ref ? COPY.sentSaved(res.ref) : COPY.sendFailed), "sent");
          card(res.ok ? "[Booking and phone options shown]" : "[Email-this-summary option shown]", "sent");
          return text;
        },
        component: () => <SentCard mailto={mailtoHref(b)} />,
        options: offer([START_OVER_CHIP, MAIN_MENU_CHIP]),
        path,
      };
    case "contact":
      return contactBlock(b, route.step, path);
    case "architect": {
      const withBrief = hasProjectData(b) && b.status !== "sent";
      return {
        message: () => {
          const text = shown(say(b, withBrief ? COPY.architectWithBrief : COPY.architect), "architect");
          card("[Contact options shown: WhatsApp, email, phone, live chat]", "architect");
          return text;
        },
        component: <ContactOptions />,
        options: () => offer(withBrief ? [REVIEW_SHARED_CHIP, MAIN_MENU_CHIP] : [MAIN_MENU_CHIP]),
        path,
      };
    }
  }
};

const contactBlock = (b: Brief, s: ContactStep, path: Block["path"]): Block => {
  const ask = (text: () => string, options: string[]): Block => ({ message: () => shown(say(b, text()), s), options: offer(options), path });
  switch (s) {
    case "wa":
      return ask(() => COPY.handoffNotice, [COPY.handoffContinue, COPY.back]);
    case "wa-email":
      return ask(() => COPY.waEmailAsk, [COPY.optional]);
    case "wa-preview":
      return {
        message: async () => {
          whatsappStore.set(null);
          const ref = saving() ? await sync.ensureSaved() : null;
          const text = whatsappText(b, ref);
          whatsappStore.set({ text, href: whatsappHref(STUDIO.whatsapp, text) });
          const msg = shown(say(b, saving() && !ref ? `${COPY.waPreview} ${COPY.waOffline}` : COPY.waPreview), s);
          card(`[WhatsApp message prepared]\n${text}`, s);
          return msg;
        },
        component: () => (
          <WhatsAppCard onOpen={() => {
            sync.log("visitor", "choice", "Open WhatsApp", s);
            sync.channelEvent("whatsapp", "initiated");
            return pathFor(step("wa-done"));
          }} />
        ),
        options: offer([COPY.back]),
        path,
      };
    case "wa-done":
      return ask(() => COPY.waDone(sync.reference), [MAIN_MENU_CHIP, START_OVER_CHIP]);
    case "em-name":
      return ask(() => COPY.emailName, [COPY.back]);
    case "em-email":
      return ask(() => COPY.emailAddress(String(b.answers.contactName?.value ?? "").split(" ")[0]), [COPY.back]);
    case "em-note":
      return ask(() => COPY.emailNote, [COPY.optional]);
    case "em-already":
      return ask(() => COPY.emailAlready(sync.submittedRef ?? ""), [COPY.addNote, MAIN_MENU_CHIP]);
    case "note":
      return ask(() => COPY.noteAsk, [COPY.back]);
    case "live":
      return {
        message: () => shown(say(b, COPY.liveUnavailable), s),
        component: <ContactOptions hideLive />,
        options: offer([MAIN_MENU_CHIP]),
        path,
      };
    case "live-consent":
      return ask(() => COPY.handoffNotice, [COPY.handoffContinue, COPY.back]);
    case "live-email":
      return ask(() => COPY.liveEmailAsk, [COPY.optional]);
    case "live-wait":
      return {
        message: async () => shown(say(b, await startLive()), s),
        component: <LiveBridge />,
        path,
      };
    case "live-chat":
      return { path }; // no assistant message: the conversation is with a person now
    case "live-note":
      return { message: () => COPY.liveSendFailed, path };
    case "live-missed":
      return {
        message: () => shown(say(b, COPY.liveMissed), s),
        component: <ContactOptions hideLive />,
        options: offer([MAIN_MENU_CHIP]),
        path,
      };
    case "live-ended":
      return {
        message: () => shown(say(b, COPY.liveAfter), s),
        component: <ContactOptions hideLive />,
        options: offer([MAIN_MENU_CHIP, START_OVER_CHIP]),
        path,
      };
  }
};

/**
 * ChatBotify looks blocks up by path name. "start" is the fixed entry point
 * (also used by the header's restart button); every other name is issued by
 * session.pathFor and resolved here on demand.
 */
export const buildFlow = (): Flow =>
  new Proxy({ start: blockFor({ to: "start" }) } as Flow, {
    get(target, prop, receiver) {
      if (typeof prop !== "string") return Reflect.get(target, prop, receiver);
      if (prop === "start") return blockFor({ to: "start" });
      const route = routeOf(prop);
      return route ? blockFor(route) : Reflect.get(target, prop, receiver);
    },
  });
