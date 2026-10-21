import { useEffect, useState, useSyncExternalStore } from "react";
import { useFlow, usePaths } from "react-chatbotify";
import { COPY, STUDIO } from "./conversation/content/copy";
import type { ReviewRow } from "./conversation/engine/summary";
import type { SlotId } from "./conversation/schema";
import { editPath, pathFor } from "./session";
import { sync } from "./sync";
import { endLive, live, useLiveActive } from "./liveState";

const Arrow = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Header title block. */
export const HeaderTitle = () => (
  <div className="dd-head">
    <div className="dd-mark" aria-hidden="true">D</div>
    <div>
      <div className="dd-head-title">Dempsey Design</div>
      <div className="dd-head-sub">
        <span className="dd-dot" /> Virtual assistant
      </div>
    </div>
  </div>
);

/** Header button: restart the conversation from the welcome message. */
export const RestartButton = () => {
  const { restartFlow } = useFlow();
  return (
    <button
      type="button"
      className="dd-icon-btn"
      aria-label="Restart conversation"
      title="Restart conversation"
      onClick={() => { void endLive().then(() => restartFlow()); }}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
};

/** Footer: persistent "Speak with an architect" action. */
export const ArchitectButton = () => {
  const { goToPath } = usePaths();
  const inLive = useLiveActive();
  if (inLive) {
    // During live chat the assistant steps aside; the footer only ends the chat.
    return (
      <button
        type="button"
        className="dd-architect-btn"
        onClick={() => {
          void endLive().then(() => { liveHooks.onVisitorEnd(); void goToPath(pathFor({ to: "contact", step: "live-ended" })); });
        }}
      >
        End live chat
      </button>
    );
  }
  return (
    <button type="button" className="dd-architect-btn" onClick={() => { void goToPath(pathFor({ to: "architect" })); }}>
      <span className="dd-architect-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="14" height="14">
          <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </span>
      Speak with an architect
    </button>
  );
};

/** Chat launcher icon. */
export const LauncherIcon = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" className="dd-launcher-icon">
    <path d="M4 5.5h16v10.5H9.5L5 19.5V16H4z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M8 10.5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const SendIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const LinkCard = ({ href, label, sub, onClick }: { href: string; label: string; sub: string; onClick?: () => void }) => {
  const external = href.startsWith("http");
  return (
  <a
    className="dd-card-link"
    href={href}
    onClick={onClick}
    {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
  >
    <span>
      <span className="dd-card-label">{label}</span>
      <span className="dd-card-sub">{sub}</span>
    </span>
    <span className="dd-card-arrow"><Arrow /></span>
  </a>
  );
};

export const ContactCard = () => (
  <div className="dd-contact">
    <LinkCard href={STUDIO.bookingUrl} label="Book a 30-minute call" sub="Choose a time that suits you" />
    <LinkCard href={`mailto:${STUDIO.email}`} label="Email the studio" sub={STUDIO.email} />
    <LinkCard href={STUDIO.phoneHref} label="Call the studio" sub={STUDIO.phone} />
  </div>
);

/** Review card: every answer on its own line, each with Edit. */
export const ReviewCard = ({ rows }: { rows: ReviewRow[] }) => {
  const { goToPath } = usePaths();
  return (
    <div className="dd-review" role="group" aria-label="Summary of your answers">
      {rows.map((r) => (
        <div className="dd-review-row" key={r.id}>
          <div className="dd-review-text">
            <span className="dd-review-label">{r.label}</span>
            <span className={`dd-review-value${r.value === "Not provided" ? " dd-muted" : ""}`}>{r.value}</span>
          </div>
          {r.editable && (
            <button
              type="button"
              className="dd-review-edit"
              aria-label={`Edit ${r.label}`}
              onClick={() => { if (!live.active) void goToPath(editPath(r.id as SlotId)); }}
            >
              Edit
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

/** After sending: the prefilled email plus the direct options. */
export const SendCard = ({ mailto }: { mailto: string }) => (
  <div className="dd-contact">
    <LinkCard href={mailto} label="Email this summary" sub="Opens your email app, ready to send" />
    <LinkCard href={STUDIO.bookingUrl} label="Book a 30-minute call" sub="Choose a time that suits you" />
    <LinkCard href={STUDIO.phoneHref} label="Call the studio" sub={STUDIO.phone} />
  </div>
);

export const PortfolioCard = () => (
  <LinkCard href={STUDIO.portfolioUrl} label="View the portfolio" sub="dempsey-design.com/portfolio" />
);

/** Small link under the welcome message when conversations can be saved. */
export const PrivacyLink = () => (
  <a className="dd-privacy-link" href={STUDIO.privacyUrl} target="_blank" rel="noopener noreferrer">
    {COPY.privacyLink}
  </a>
);

/** After Send: options once the studio has it, or the email fallback while it hasn't. */
export const SentCard = ({ mailto }: { mailto: string }) => {
  const state = useSyncExternalStore(sync.subscribe, () => sync.lastSubmit);
  if (state.state === "ok") {
    return (
      <div className="dd-contact">
        <LinkCard href={STUDIO.bookingUrl} label="Book a 30-minute call" sub="Choose a time that suits you" />
        <LinkCard href={STUDIO.phoneHref} label="Call the studio" sub={STUDIO.phone} />
      </div>
    );
  }
  if (state.state === "failed") return <SendCard mailto={mailto} />;
  return null;
};

/** Same look as LinkCard, for options that continue inside the chat. */
export const ActionCard = ({ label, sub, onClick, muted }: { label: string; sub: string; onClick: () => void; muted?: boolean }) => (
  <button type="button" className={`dd-card-link dd-card-button${muted ? " dd-card-muted" : ""}`} onClick={onClick}>
    <span>
      <span className="dd-card-label">{label}</span>
      <span className="dd-card-sub">{sub}</span>
    </span>
    <span className="dd-card-arrow"><Arrow /></span>
  </button>
);

/** Set by flow.tsx: what happens when the visitor ends a live chat from the footer. */
export const liveHooks = { onVisitorEnd: (): void => {} };

/** Handlers for the contact options, set by flow.tsx (keeps conversation logic out of the UI). Each returns the path to go to. */
export const contactActions = {
  whatsapp: (): string | null => null,
  email: (): string | null => null,
  live: (_available: boolean): string | null => null,
  phone: (): void => {},
};

/** The four ways to reach the studio. */
export const ContactOptions = ({ hideLive = false }: { hideLive?: boolean }) => {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let on = true;
    if (!hideLive) void sync.liveAvailable().then((v) => { if (on) setAvailable(v); });
    return () => { on = false; };
  }, [hideLive]);
  const { goToPath } = usePaths();
  // Older cards in the transcript do nothing while a live chat is running.
  const go = (p: string | null) => { if (p && !live.active) void goToPath(p); };
  const ref = sync.reference;
  return (
    <div className="dd-contact">
      <ActionCard label="Continue on WhatsApp" sub="Review a short message, then open WhatsApp" onClick={() => go(contactActions.whatsapp())} />
      <ActionCard label="Email the studio" sub="Send your inquiry from here" onClick={() => go(contactActions.email())} />
      <LinkCard
        href={STUDIO.phoneHref}
        label="Call the studio"
        sub={ref ? `${STUDIO.phone} · mention ${ref}` : STUDIO.phone}
        onClick={() => contactActions.phone()}
      />
      {!hideLive && available === true && (
        <ActionCard
          label="Connect with a live agent"
          sub="Chat with the studio here"
          onClick={() => go(contactActions.live(true))}
        />
      )}
    </div>
  );
};

/** Booking link, kept for the places it fits (fees, phases, after sending). */
export const BookingCard = () => (
  <LinkCard href={STUDIO.bookingUrl} label="Book a 30-minute call" sub="Choose a time that suits you" onClick={() => sync.channelEvent("booking", "selected")} />
);

/** The prepared WhatsApp message, shown for review before WhatsApp opens. */
export const whatsappStore = {
  state: null as null | { text: string; href: string },
  listeners: new Set<() => void>(),
  set(v: { text: string; href: string } | null) { this.state = v; this.listeners.forEach((f) => f()); },
  subscribe(f: () => void) { whatsappStore.listeners.add(f); return () => { whatsappStore.listeners.delete(f); }; },
};

export const WhatsAppCard = ({ onOpen }: { onOpen: () => string | null }) => {
  const state = useSyncExternalStore((f) => whatsappStore.subscribe(f), () => whatsappStore.state);
  const { goToPath } = usePaths();
  if (!state) return null;
  return (
    <div className="dd-contact">
      <div className="dd-wa-preview" aria-label="Message to send on WhatsApp">{state.text}</div>
      <LinkCard
        href={state.href}
        label="Open WhatsApp"
        sub="Opens the app or WhatsApp Web"
        onClick={() => { if (live.active) return; const p = onOpen(); if (p) window.setTimeout(() => { void goToPath(p); }, 400); }}
      />
    </div>
  );
};
