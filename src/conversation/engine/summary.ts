// Turns the brief into (1) review-card rows, (2) plain text for email and,
// later, WhatsApp, and (3) the versioned inquiry record for Phase 4 storage.

import { SECTOR_LABELS, STUDIO } from "../content/copy";
import { REVIEW_ROWS, sectorOf } from "../content/pathways";
import type { Brief, LocationValue, ReachValue, SlotId, TimelineValue } from "../schema";

export interface ReviewRow { id: SlotId; label: string; value: string; editable: boolean; }

const NOT_EDITABLE: SlotId[] = [];

export const reviewRows = (b: Brief): ReviewRow[] => {
  const rows: ReviewRow[] = [];
  const sector = sectorOf(b);
  for (const r of REVIEW_ROWS) {
    const a = b.answers[r.id];
    if (!a) continue;
    let value = a.skipped ? "Not provided" : a.label || "—";
    if (r.id === "projectType" && sector) value = `${SECTOR_LABELS[sector]} · ${value}`;
    if (r.id === "description" || r.id === "clientMessage") value = `“${value}”`;
    rows.push({ id: r.id, label: r.label, value, editable: !NOT_EDITABLE.includes(r.id) });
  }
  if (sector && !b.answers.projectType) rows.unshift({ id: "sector", label: "Project", value: SECTOR_LABELS[sector], editable: false });
  return rows;
};

export const subjectLine = (b: Brief): string => {
  if (b.kind === "client") {
    const p = b.answers.clientProject?.label;
    return `Client message${p && !b.answers.clientProject?.skipped ? ` — ${p}` : ""}`;
  }
  const sector = sectorOf(b);
  const type = b.answers.projectType?.label;
  const loc = (b.answers.location?.value as LocationValue | undefined)?.text;
  return ["New inquiry", [sector ? SECTOR_LABELS[sector] : null, type, loc].filter(Boolean).join(" · ")].filter(Boolean).join(" — ");
};

/** Plain-text summary: used for the email body now, WhatsApp in Phase 4. */
export const plainText = (b: Brief): string => {
  const lines = [subjectLine(b), ""];
  for (const row of reviewRows(b)) lines.push(`${row.label}: ${row.value}`);
  lines.push("", "Sent from the website assistant at dempsey-design.com");
  return lines.join("\n");
};

export const mailtoHref = (b: Brief): string =>
  `mailto:${STUDIO.email}?subject=${encodeURIComponent(subjectLine(b))}&body=${encodeURIComponent(plainText(b))}`;

/** The record Phase 4 will store (GoDaddy) and hand off (WhatsApp). */
export const toRecord = (b: Brief, page = typeof location !== "undefined" ? location.pathname : "") => {
  const answers: Record<string, unknown> = {};
  for (const [id, a] of Object.entries(b.answers)) {
    if (["contactName", "contactReach", "description", "clientMessage"].includes(id)) continue;
    answers[id] = { value: a!.value, label: a!.label, via: a!.via, ...(a!.skipped ? { skipped: true } : {}) };
  }
  const reach = (b.answers.contactReach?.value ?? {}) as ReachValue;
  const tl = b.answers.timeline?.value as TimelineValue | string | undefined;
  return {
    schemaVersion: 1,
    inquiryId: `dd-${b.startedAt.slice(0, 10)}-${Math.abs(hash(b.startedAt)).toString(36).slice(0, 4)}`,
    kind: b.kind === "client" ? "client_message" : b.kind,
    status: b.status,
    createdAt: b.startedAt,
    source: {
      page,
      referrer: typeof document !== "undefined" ? document.referrer : "",
      utm: typeof location !== "undefined" ? Object.fromEntries(new URLSearchParams(location.search).entries()) : {},
    },
    sector: sectorOf(b) ?? null,
    projectType: (b.answers.projectType?.value as string | undefined) ?? null,
    answers,
    timelineMonth: typeof tl === "object" && tl ? tl.approxMonth : null,
    description: (b.answers.description?.value as string | undefined) ?? (b.answers.clientMessage?.value as string | undefined) ?? null,
    contact: {
      name: (b.answers.contactName?.value as string | undefined) ?? "",
      email: reach.email ?? "",
      phone: reach.phone ?? "",
      consent: b.status === "sent",
    },
    handoff: { requested: b.status === "sent" ? "studio" : null, channel: b.status === "sent" ? "email" : null, sentAt: null },
    summaryText: plainText(b),
  };
};

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
