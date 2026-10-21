import { useSyncExternalStore } from "react";
import { useFlow, usePaths } from "react-chatbotify";
import { COPY, STUDIO } from "./conversation/content/copy";
import type { ReviewRow } from "./conversation/engine/summary";
import type { SlotId } from "./conversation/schema";
import { editPath, pathFor } from "./session";
import { sync } from "./sync";

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
        <span className="dd-dot" /> Automated assistant
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
      onClick={() => { void restartFlow(); }}
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

export const LinkCard = ({ href, label, sub }: { href: string; label: string; sub: string }) => {
  const external = href.startsWith("http");
  return (
  <a
    className="dd-card-link"
    href={href}
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
              onClick={() => { void goToPath(editPath(r.id as SlotId)); }}
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
