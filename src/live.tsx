// Live chat inside the existing chat window (Phase 5, Stage B).
// One LiveBridge component, rendered under the "checking whether someone is
// available" message, polls the server and injects the studio's messages.
// Everything it decides is shown honestly: who joined, when it ended, and
// alternatives when no one is available.

import { useEffect, useSyncExternalStore } from "react";
import { useMessages, usePaths } from "react-chatbotify";
import { COPY } from "./conversation/content/copy";
import { ContactOptions } from "./components";
import { pathFor, session, type ContactStep } from "./session";
import { sync } from "./sync";

type Phase = "idle" | "starting" | "waiting" | "live" | "missed" | "ended" | "failed";

const WAIT_LIMIT_MS = 75_000;      // the server times out at 60 s; never wait longer than this regardless
const NO_REPLY_HINT_MS = 180_000;  // visitor message unanswered for 3 minutes

export const live = {
  phase: "idle" as Phase,
  agent: null as string | null,
  lastSeq: 0,
  startedAt: 0,
  lastVisitorAt: 0,
  lastStudioAt: 0,
  hinted: false,
  listeners: new Set<() => void>(),
  set(p: Phase) { this.phase = p; this.listeners.forEach((f) => f()); },
  subscribe(f: () => void) { live.listeners.add(f); return () => { live.listeners.delete(f); }; },
  reset() { Object.assign(this, { agent: null, lastSeq: 0, startedAt: 0, lastVisitorAt: 0, lastStudioAt: 0, hinted: false }); this.set("idle"); },
  get active() { return this.phase === "waiting" || this.phase === "live"; },
};

const step = (s: ContactStep) => ({ to: "contact" as const, step: s });
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** A studio member's message: their name and the time above the text. */
const LiveMessage = ({ name, at, body }: { name: string; at: string; body: string }) => (
  <div className="dd-live-msg">
    <span className="dd-live-who">{name} · {time(at)}</span>
    <span className="dd-live-body">{body}</span>
  </div>
);

/** Ask the server for live chat; called when the waiting message is shown. */
export const startLive = async (): Promise<string> => {
  live.reset();
  live.set("starting");
  const ref = await sync.ensureSaved();
  if (!ref) { live.set("failed"); return COPY.liveUnavailableNow; }
  const r = await sync.liveRequest();
  if (r.status === 200 && (r.data?.status === "requested" || r.data?.status === "accepted")) {
    live.startedAt = Date.now();
    live.set("waiting");
    return COPY.liveWaiting;
  }
  live.set("failed");
  return COPY.liveUnavailableNow;
};

export const endLive = async () => {
  if (!live.active) return;
  live.set("ended");
  await sync.liveEnd();
};

/** Polls while waiting or live; injects messages; moves the conversation on when it ends. */
export const LiveBridge = () => {
  const phase = useSyncExternalStore((f) => live.subscribe(f), () => live.phase);
  const { injectMessage } = useMessages();
  const { goToPath } = usePaths();

  useEffect(() => {
    if (phase !== "waiting" && phase !== "live") return;
    let stopped = false;
    let timer = 0;
    const tick = async () => {
      if (stopped || !live.active) return;
      const r = await sync.livePoll(live.lastSeq);
      if (stopped || !live.active) return;
      const d = r.data;
      if (r.status === 401 || r.status === 404) { finish("ended", COPY.liveEndedSystem); return; }
      if (d) {
        if (live.phase === "waiting" && d.status === "accepted") {
          live.agent = d.agent ?? null;
          live.lastStudioAt = Date.now();
          live.set("live");
          await injectMessage(<LiveJoined name={live.agent} />);
          void goToPath(pathFor(step("live-chat")));
        }
        for (const m of d.messages ?? []) {
          if (m.seq <= live.lastSeq) continue;
          live.lastSeq = m.seq;
          live.lastStudioAt = Date.now();
          await injectMessage(<LiveMessage name={m.name ?? "Dempsey Design"} at={m.at} body={m.body} />);
        }
        if (live.phase === "waiting" && (d.status === "timed_out" || d.status === "declined" || d.status === "ended")) { finish("missed"); return; }
        if (live.phase === "live" && d.status === "ended") {
          finish("ended", d.endedBy === "studio" ? COPY.liveEndedStudio(live.agent) : COPY.liveEndedSystem);
          return;
        }
      }
      if (live.phase === "waiting" && Date.now() - live.startedAt > WAIT_LIMIT_MS) {
        void sync.liveEnd();
        finish("missed");
        return;
      }
      if (live.phase === "live" && !live.hinted && live.lastVisitorAt > live.lastStudioAt && Date.now() - live.lastVisitorAt > NO_REPLY_HINT_MS) {
        live.hinted = true;
        await injectMessage(COPY.liveNoReply);
      }
      timer = window.setTimeout(tick, document.visibilityState === "hidden" ? 10_000 : 2_000);
    };
    const finish = async (to: "missed" | "ended", note?: string) => {
      stopped = true;
      live.set(to);
      if (note) await injectMessage(note);
      void goToPath(pathFor(step(to === "missed" ? "live-missed" : "live-ended")));
    };
    timer = window.setTimeout(tick, 1500);
    return () => { stopped = true; window.clearTimeout(timer); };
  }, [phase, injectMessage, goToPath]);

  if (phase === "failed") return <ContactOptions hideLive />;
  return null;
};

/** "Eric from Dempsey Design has joined the chat." with an End chat button. */
const LiveJoined = ({ name }: { name: string | null }) => {
  const { goToPath } = usePaths();
  return (
    <div className="dd-live-joined">
      <span>{COPY.liveJoined(name)}</span>
      <button
        type="button"
        className="dd-review-edit"
        onClick={() => {
          if (!live.active) return;
          void endLive().then(() => { session.brief.notes.push(COPY.liveEndedVisitor); void goToPath(pathFor(step("live-ended"))); });
        }}
      >
        End chat
      </button>
    </div>
  );
};

/** A visitor message during live chat. */
export const sendLive = async (text: string): Promise<boolean> => {
  live.lastVisitorAt = Date.now();
  const r = await sync.liveSend(text);
  return r.status === 200;
};
