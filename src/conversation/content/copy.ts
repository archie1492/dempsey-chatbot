// Everything the assistant says that isn't a question prompt.
// Question prompts and options live in pathways.ts.
//
// Voice: calm, precise, brief. One or two sentences per message, the question
// last. No exclamation marks, no "Great question". The assistant is "the
// studio's virtual assistant" — never an architect, a person or an AI.

export const STUDIO = {
  name: "Dempsey Design",
  phone: "561-889-0348",
  phoneHref: "tel:+15618890348",
  /** WhatsApp Business number, digits only with country code (used in wa.me links). */
  whatsapp: "15618890348",
  email: "info@dempsey-design.com",
  bookingUrl: "https://calendly.com/ericjdempsey/30min",
  portfolioUrl: "https://www.dempsey-design.com/portfolio",
  contactUrl: "https://www.dempsey-design.com/contact",
  privacyUrl: "https://www.dempsey-design.com/privacy-policy",
};

export const COPY = {
  welcome:
    "Welcome to Dempsey Design. I'm the studio's virtual assistant. Tell me a little about your project in your own words, or choose where to start.",
  menu: "What would you like to do?",
  generalMenu: "Of course. Are you an existing client, or do you have a general question?",
  infoMenu: "What would you like to know?",
  fallback: "I didn't quite catch that.",
  fallbackPickOne: "I didn't quite catch that. Which of these is closest?",
  fallbackHuman:
    "I'm a rule-based assistant, so I'm best with the options shown. An architect is one tap away if that's easier.",
  closeCall: "Which of these is closest?",
  checkpoint:
    "That's enough for an architect to begin the conversation. I can send it now, or ask a few short questions that help us prepare.",
  checkpointContinue: "Continue — about a minute",
  checkpointFast: "Review and send",
  checkpointContact: "Contact the studio now",
  review: "Here's what I have. Edit anything that isn't right, then send it to the studio.",
  reviewClient: "Here's the message for the studio. Edit anything that isn't right, then send it.",
  sent:
    "Thank you. To deliver it, choose Email this summary — your email app opens with everything filled in. If you'd rather speak now, book a time or call the studio.",
  architect: "Choose whichever suits you and an architect will take it from there:",
  architectWithBrief:
    "Choose how you'd like to reach the studio — what you've shared so far goes with it:",
  reachInvalid:
    "That doesn't look like an email address or a phone number. Could you check it?",
  reachRequired:
    "We'll need an email or phone number to follow up. If you'd rather not share it here, you can contact the studio directly at any time.",
  nameRequired: "A first name is enough.",
  restartNote: "Starting over.",
  editNote: "Updated.",
  skipped: "That's fine.",
  checkpointN: (n: number) =>
    n > 1
      ? `That's enough for an architect to begin the conversation. I can send it now, or ask ${n} short questions that help us prepare.`
      : "That's enough for an architect to begin the conversation. I can send it now, or ask one more short question that helps us prepare.",
  backToProject: "Back to your project:",
  leaveForArchitect: "No problem — I'll leave that one for the architect.",
  missContact: "I'm a rule-based assistant, so I may be missing what you mean. The studio is one tap away.",
  finishNote: "Of course — just your contact details, then.",
  hints: {
    choice: "Tap the closest option, or Skip if you'd rather not say.",
    location: "A city or neighborhood is enough — for example, Jupiter or Palm Beach Gardens.",
    timeline: "Roughly is fine — for example, \u201cthis spring\u201d or \u201cearly 2027\u201d.",
    budget: "A rough figure or range is fine, or tap Skip.",
    area: "An approximate number is fine — for example, 2,500 SF.",
    count: "A number is fine — for example, 40.",
    multi: "Tick any that apply, or tap Skip.",
    text: "A few words are enough.",
  } as Record<string, string>,

  // Saving conversations (only when the studio's server is connected)
  privacyNotice: "With your permission, conversations here can be saved so the studio can follow up.",
  privacyLink: "Privacy policy",
  consentAsk:
    "Before we go on — may I save this conversation so an architect can follow up, even if you leave before finishing?",
  consentYes: "Yes, save it",
  consentNo: "Keep it private",
  consentSaved: "Thank you. I'll save it as we go.",
  consentPrivate: "Of course. Nothing is saved unless you choose to send it.",
  reviewPrivateNote: "Sending shares this summary and our conversation with the studio.",
  sending: "Sending…",
  sentSaved: (ref: string) =>
    `Thank you — it's with the studio. Your reference is ${ref}. An architect will follow up using the details you gave. If you'd rather speak sooner, book a time or call.`,
  sendFailed:
    "I couldn't reach the studio's system just now. Your conversation is kept on this device and will be sent automatically when the connection returns — or you can email it now.",
  withdrawn: "Done. I've deleted what was saved, and nothing more will be saved. We can carry on whenever you like.",
  withdrawnNothing: "Nothing from this conversation has been saved, and nothing will be unless you send it.",
  resumeAsk: "Welcome back. Would you like to continue where you left off?",
  resumeYes: "Continue where I left off",
  resumeNo: "Start fresh",
  resumeRecap: "Here's where we were.",

  // Contact options (Phase 5)
  handoffNotice: "To hand this over, I'll save what you've shared with the studio under a reference number.",
  handoffContinue: "Continue",
  back: "Back",
  waEmailAsk: "Would you like to leave an email too, in case WhatsApp doesn't connect? It's optional.",
  waPreview: "Here's the message I've prepared. You can still edit it in WhatsApp before you send it.",
  waOffline: "I couldn't reach the studio's system just now, so it goes without a reference number — what you've shared is saved as soon as the connection returns.",
  waDone: (ref: string | null) =>
    `WhatsApp should now be open with your message ready. It reaches the studio once you press send there.${ref ? ` Your reference is ${ref}.` : ""}`,
  emailName: "Who should the studio reply to?",
  emailAddress: (first: string) => `Thank you${first ? `, ${first}` : ""}. What email address should the studio reply to?`,
  emailInvalid: "That doesn't look like an email address. Could you check it?",
  emailNote: "Anything you'd like to add for the architect? This is optional.",
  emailAlready: (ref: string) => `This is already with the studio — your reference is ${ref}. Would you like to add a note?`,
  addNote: "Add a note",
  noteAsk: "What would you like to add?",
  noteAdded: (ref: string) => `Added to ${ref}. The studio has it.`,
  noteFailed: "I couldn't add that just now. You can email the studio directly at info@dempsey-design.com.",
  liveUnavailable: "No one from the studio is available for live chat right now. You can reach us here instead:",
  liveEmailAsk: "So we can reply if we get disconnected, would you like to leave an email? It's optional.",
  liveWaiting: "We're checking whether someone from the studio is available. Please stay on this page while we connect you.",
  liveJoined: (name: string | null) =>
    name && name !== "Dempsey Design" ? `${name} from Dempsey Design has joined the chat.` : "Someone from Dempsey Design has joined the chat.",
  liveMissed:
    "No one from the studio could join just now. We have your request, and you can continue on WhatsApp or by email — the studio will see everything you've shared.",
  liveNoReply: "If you need to go, WhatsApp or email will keep this conversation going.",
  liveEndedStudio: (name: string | null) => `${name && name !== "Dempsey Design" ? name : "The studio"} has ended the chat. It's saved with your inquiry.`,
  liveEndedVisitor: "You've ended the chat. It's saved with your inquiry.",
  liveEndedSystem: "This chat has ended. It's saved with your inquiry.",
  liveAfter: "Anything else? You can reach the studio here:",
  liveSendFailed: "That message didn't go through. Please check your connection and try again.",
  liveUnavailableNow: "Live chat has just become unavailable. You can reach the studio here instead:",
  optional: "Skip",
};

/** Acknowledgements rotate so the same one never appears twice in a row. */
export const ACKS = ["Thank you.", "Noted.", "Understood."];

/** Acknowledgements that repeat back what was learned; the first is always used first. */
export const ACK_TEMPLATES: Array<(what: string) => string> = [
  (x) => `Thank you. I've noted ${x}.`,
  (x) => `Understood — ${x}.`,
  (x) => `That's helpful: ${x}.`,
  (x) => `Good to know: ${x}.`,
];

/** One-off notes. Each is shown at most once per conversation. */
export const NOTES = {
  southFlorida: "That's within our core South Florida area.",
  licensed:
    "We're licensed in Florida, Arkansas, New York and Washington, D.C., so that's a location we can serve directly.",
  outside:
    "That's outside the states where we're licensed — Florida, Arkansas, New York and Washington, D.C. — but we regularly work alongside local architects of record, so it's still worth a conversation.",
  feasibility:
    "Early conversations about site, program and budget are often the most valuable; a short feasibility study is a common first step.",
  sbe:
    "For reference, Dempsey Design is SBE-certified with the City of West Palm Beach, Palm Beach County and the School District of Palm Beach County.",
  rfq: (details: string) =>
    `I've recorded ${details}. While a solicitation is open, communication usually has to go through the procurement contact it names, so I won't ask about the project here. An architect will confirm whether the studio is responding.`,
  brand: "Brand standards will shape the design, so I've flagged that for the architect.",
  medical: "Clinical space comes with specific requirements, so a few details help.",
};

/** General-question answers. Keys match TOPIC_TERMS in lexicon.ts. */
export const INFO: Record<string, { label: string; answer: string }> = {
  services: {
    label: "Services",
    answer:
      "Dempsey Design offers everything from a focused consultation to full architectural services: architectural consultation and project advisory, test-fits and space planning, feasibility and due diligence, architecture, interior design, existing building and property assessments, FF&E sourcing and procurement, construction documentation and permitting, and construction administration. Many clients start with a consultation or test-fit before deciding how to proceed.",
  },
  phases: {
    label: "Design phases",
    answer:
      "Most projects move through feasibility and programming, schematic design, design development, construction documents and permitting, then construction administration. The scope of each phase is tailored to the project.",
  },
  fees: {
    // TODO(studio): replace with your own wording on how fees are structured.
    label: "Fees",
    answer:
      "Fees are set for each project once we understand its scope, delivery approach and schedule, so there isn't a single rate to quote here. A short call with an architect is the quickest way to an accurate proposal.",
  },
  areas: {
    label: "Areas served",
    answer:
      "The studio is based in West Palm Beach and works throughout South Florida, and is licensed in Florida, Arkansas, New York and Washington, D.C.",
  },
  permitting: {
    label: "Permitting",
    answer:
      "Permit drawings are part of the construction-documents phase, and the architect stays involved through plan review. Review times vary by jurisdiction; an architect can give you a realistic estimate for yours.",
  },
  portfolio: {
    label: "Portfolio",
    answer: "Selected hospitality, wellness, civic, cultural, commercial and residential work is on the portfolio page.",
  },
  booking: {
    label: "Book a call",
    answer: "You can book a 30-minute call with an architect at a time that suits you:",
  },
  vendors: {
    label: "Consultants, vendors and careers",
    answer: `For consultant, vendor or career inquiries, please email ${STUDIO.email} with a short introduction.`,
  },
};

export const INFO_FOLLOWUPS = ["Ask something else", "Start a project", "Speak with an architect"];

export const ENTRY_CHOICES = [
  { label: "Residential", value: "residential" },
  { label: "Commercial & tenant improvements", value: "commercial" },
  { label: "Hospitality & interiors", value: "hospitality" },
  { label: "Institutional & public", value: "institutional" },
  { label: "Existing client or general question", value: "general" },
] as const;

export const GENERAL_CHOICES = [
  { label: "I'm an existing client", value: "client" },
  { label: "A general question", value: "info" },
  { label: "Consultants, vendors and careers", value: "vendors" },
] as const;

export const SECTOR_LABELS = {
  residential: "Residential",
  commercial: "Commercial & tenant improvements",
  hospitality: "Hospitality & interiors",
  institutional: "Institutional & public",
} as const;
