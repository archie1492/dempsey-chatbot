import { useFlow, usePaths } from "react-chatbotify";
import { STUDIO } from "./content";

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
    <button type="button" className="dd-architect-btn" onClick={() => { void goToPath("architect"); }}>
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
