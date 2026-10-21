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
import { mailtoHref, reviewRows, subjectLine, toRecord } from "./conversation/engine/summary";
import type { Brief, ReachValue, Route } from "./conversation/schema";
import { ContactCard, PortfolioCard, PrivacyLink, ReviewCard, SendCard, SentCard } from "./components";
import { pathFor, routeOf, session, type FlowRoute } from "./session";
import { sync } from "./sync";

const saving = () => sync.enabled;

// ── recording the conversation (a no-op unless saving is switched on) ──────
let offered = new Set<string>();
let offeredBoxes = false;
const offer = (chips: string[]) => { offered = new Set(chips); return chips; };
const offerBoxes = (items: string[]) => { offeredBoxes = items.length > 0; return items; };

const stepOf = (r: FlowRoute) => (r.to === "ask" ? r.q : r.to === "info" ? `info:${r.topic}` : r.to);

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
const NO = /\b(no|nope|not|private|don't|dont|rather not)\b/;

const answerConsent = (b: Brief, next: Route, input: string): FlowRoute => {
  const t = input.toLowerCase();
  if (input === COPY.consentYes || (YES.test(t) && !NO.test(t))) {
    sync.agree(consentText());
    b.notes.push(COPY.consentSaved);
    sync.setRecord(toRecord(b));
    sync.saveResume(b, next);
    return next;
  }
  if (input === COPY.consentNo || NO.test(t)) {
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

/** Every visitor input passes through here. */
const routeInput = (b: Brief, at: FlowRoute) => (p: Params) => {
  const input = (p.userInput ?? "").trim();
  if (saving() && at.to !== "consent" && isWithdrawRequest(input)) {
    const had = sync.withdraw();
    b.notes.push(had ? COPY.withdrawn : COPY.withdrawnNothing);
    return pathFor(at.to === "start" || at.to === "resume" || at.to === "sent" ? { to: "menu" } : at);
  }
  logVisitor(input, at);
  if (at.to === "consent") return pathFor(answerConsent(b, at.next, input));
  if (at.to === "resume") return pathFor(answerResume(b, input));
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
    case "architect": {
      const withBrief = hasProjectData(b) && b.status !== "sent";
      return {
        message: () => {
          const text = shown(say(b, withBrief ? COPY.architectWithBrief : COPY.architect), "architect");
          card("[Contact options shown: book a call, email, phone]", "architect");
          return text;
        },
        component: <ContactCard />,
        options: () => offer(withBrief ? [REVIEW_SHARED_CHIP, MAIN_MENU_CHIP] : [MAIN_MENU_CHIP]),
        path,
      };
    }
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
