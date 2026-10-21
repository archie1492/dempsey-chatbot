// Live-chat state, shared by the chat window's components. Kept apart from
// live.tsx so any component can read it without a circular import.

import { useSyncExternalStore } from "react";
import { sync } from "./sync";

export type LivePhase = "idle" | "starting" | "waiting" | "live" | "missed" | "ended" | "failed";

export const live = {
  phase: "idle" as LivePhase,
  agent: null as string | null,
  lastSeq: 0,
  startedAt: 0,
  lastVisitorAt: 0,
  lastStudioAt: 0,
  hinted: false,
  listeners: new Set<() => void>(),
  set(p: LivePhase) { this.phase = p; this.listeners.forEach((f) => f()); },
  subscribe(f: () => void) { live.listeners.add(f); return () => { live.listeners.delete(f); }; },
  reset() { Object.assign(this, { agent: null, lastSeq: 0, startedAt: 0, lastVisitorAt: 0, lastStudioAt: 0, hinted: false }); this.set("idle"); },
  /** Waiting for, or talking with, a studio member: the assistant steps aside. */
  get active() { return this.phase === "starting" || this.phase === "waiting" || this.phase === "live"; },
};

/** Re-render when live chat starts or stops. */
export const useLiveActive = () => useSyncExternalStore((f) => live.subscribe(f), () => live.active);

/** End the live chat (visitor's side). */
export const endLive = async () => {
  if (!live.active) return;
  live.set("ended");
  await sync.liveEnd();
};
