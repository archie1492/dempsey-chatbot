// One conversation per page. Holds the brief and hands out unique path names,
// so spent option chips from earlier steps are disabled by ChatBotify.

import { beginEdit } from "./conversation/engine/conversation";
import { newBrief, type Route, type SlotId } from "./conversation/schema";

/** Engine routes plus the two steps that only exist when saving is switched on. */
export type ContactStep =
  | "wa" | "wa-email" | "wa-preview" | "wa-done"
  | "em-name" | "em-email" | "em-note" | "em-already" | "note"
  | "live" | "live-consent" | "live-email" | "live-wait" | "live-chat" | "live-note" | "live-missed" | "live-ended";
export type FlowRoute = Route | { to: "consent"; next: Route } | { to: "resume" } | { to: "contact"; step: ContactStep };

export const session = {
  brief: newBrief(),
  seq: 0,
  /** Route of each path name issued. */
  routes: new Map<string, FlowRoute>(),
};

export const pathFor = (route: FlowRoute): string => {
  session.seq += 1;
  const name = `${route.to}:${session.seq}`;
  session.routes.set(name, route);
  return name;
};

export const routeOf = (path: string): FlowRoute | undefined => session.routes.get(path);

export const editPath = (id: SlotId): string => pathFor(beginEdit(session.brief, id));
