// Adapter between the conversation engine and React ChatBotify.
// No conversation content lives here: copy is in conversation/content,
// logic in conversation/engine. Each step gets a unique path name so earlier
// option chips are disabled once the conversation moves on.

import type { Block, Flow, Params } from "react-chatbotify";
import { COPY, INFO } from "./conversation/content/copy";
import {
  MAIN_MENU_CHIP, REVIEW_SHARED_CHIP, SEND_CHIP, START_OVER_CHIP,
  checkboxesFor, chipsFor, entryChips, generalChips, handle, hasProjectData, infoFollowups,
  infoMenuChips, promptFor, resetBrief, say,
} from "./conversation/engine/conversation";
import { mailtoHref, reviewRows } from "./conversation/engine/summary";
import type { Route } from "./conversation/schema";
import { ContactCard, PortfolioCard, ReviewCard, SendCard } from "./components";
import { pathFor, routeOf, session } from "./session";

const blockFor = (route: Route): Block => {
  const b = session.brief;
  const path = (p: Params) => pathFor(handle(b, route, p.userInput ?? ""));

  switch (route.to) {
    case "start":
      return {
        message: () => {
          resetBrief(b);
          return COPY.welcome;
        },
        options: entryChips(),
        path,
      };
    case "menu":
      return { message: () => say(b, COPY.menu), options: entryChips(), path };
    case "general":
      return { message: () => say(b, COPY.generalMenu), options: generalChips(), path };
    case "info": {
      if (route.topic === "menu") return { message: () => say(b, COPY.infoMenu), options: infoMenuChips(), path };
      const info = INFO[route.topic];
      return {
        message: () => say(b, info?.answer ?? COPY.fallback),
        ...(route.topic === "portfolio" ? { component: <PortfolioCard /> } : {}),
        options: infoFollowups(),
        path,
      };
    }
    case "ask": {
      const key = route.q;
      return {
        message: () => promptFor(b, key),
        options: () => chipsFor(b, key),
        checkboxes: () => ({ items: checkboxesFor(b, key), min: 1 }),
        path,
      };
    }
    case "review":
      return {
        message: () => {
          b.status = "reviewed";
          return say(b, b.kind === "client" ? COPY.reviewClient : COPY.review);
        },
        component: () => <ReviewCard rows={reviewRows(b)} />,
        options: [SEND_CHIP, START_OVER_CHIP],
        path,
      };
    case "sent":
      return {
        message: () => say(b, COPY.sent),
        component: () => <SendCard mailto={mailtoHref(b)} />,
        options: [START_OVER_CHIP, MAIN_MENU_CHIP],
        path,
      };
    case "architect":
      return {
        message: () => say(b, hasProjectData(b) && b.status !== "sent" ? COPY.architectWithBrief : COPY.architect),
        component: <ContactCard />,
        options: () => (hasProjectData(b) && b.status !== "sent" ? [REVIEW_SHARED_CHIP, MAIN_MENU_CHIP] : [MAIN_MENU_CHIP]),
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

