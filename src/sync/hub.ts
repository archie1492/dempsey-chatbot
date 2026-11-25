// Copy of a sent inquiry for DEMPSEY - One Hub (the studio's portal), so it appears in the studio's
// Onboarding list next to the website's other inquiries. Switched on by `data-hub` on the embed script
// (e.g. data-hub="https://portal.dempsey-design.com"); without it nothing is sent.
//
// Only called where the visitor has agreed to send (the same moment as the studio API's submit).
// It never blocks or changes the conversation: failures are retried a few times, then dropped
// (the studio still has the email and the API copy). The body is sent as text/plain so the browser
// makes a simple request without a preflight. One Hub ignores repeats of the same inquiry.

let hubBase: string | null = null;

export function configureHub(base: string | null | undefined) {
  if (!base || hubBase || typeof window === "undefined" || !window.fetch) return;
  if (!/^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(base)) return;
  hubBase = base.replace(/\/+$/, "");
}

export const hubEnabled = () => hubBase !== null;

type InquiryRecord = {
  schemaVersion: number;
  inquiryId: string;
  kind: string | null;
  sector: string | null;
  projectType: string | null;
  description: string | null;
  summaryText: string;
  source: { page: string };
  contact: { name: string; email: string; phone: string; company: string };
};

/** Only what One Hub keeps (modules/intake/assistant-inquiry.ts in the One Hub repo). */
export function hubPayload(record: InquiryRecord, reference: string | null, location: string | null) {
  return {
    schemaVersion: 1,
    inquiryId: record.inquiryId,
    kind: record.kind,
    sector: record.sector,
    projectType: record.projectType,
    description: record.description,
    summaryText: record.summaryText,
    location: location || null,
    reference: reference || null,
    contact: {
      name: record.contact.name,
      email: record.contact.email,
      phone: record.contact.phone,
      company: record.contact.company,
    },
    source: { page: record.source.page },
  };
}

const DELAYS_MS = [0, 3000, 15000];

export function sendToHub(record: unknown, reference: string | null, location: string | null): void {
  if (!hubBase) return;
  const r = record as InquiryRecord;
  if (r.kind !== "new_project" && r.kind !== "client_message") return;
  const body = JSON.stringify(hubPayload(r, reference, location));
  const url = `${hubBase}/api/assistant/inquiry`;
  const attempt = (i: number) => {
    window.setTimeout(async () => {
      try {
        const res = await fetch(url, {
          method: "POST",
          mode: "cors",
          credentials: "omit",
          keepalive: true,
          headers: { "Content-Type": "text/plain" },
          body,
        });
        // 2xx stored (or already stored); 4xx won't get better by retrying.
        if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) return;
      } catch {
        /* offline or blocked: retry below */
      }
      if (i + 1 < DELAYS_MS.length) attempt(i + 1);
    }, DELAYS_MS[i]);
  };
  attempt(0);
}
