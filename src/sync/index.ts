// Saving conversations to the studio's server (Phase 4).
//
// Nothing here changes what the assistant says or when. Every message goes into
// a local queue first; the sender drains it in the background, retries with
// growing delays when the server can't be reached, and never blocks the chat.
// Nothing leaves the browser until the visitor agrees (or presses Send).
// The server never sends anything back except IDs and acknowledgements.

export type Consent = "unasked" | "yes" | "private";
export type Sender = "visitor" | "assistant";
export type EventType = "text" | "choice" | "selection" | "card" | "notice";

interface QueuedEvent {
  seq: number;
  eventId: string;
  sender: Sender;
  type: EventType;
  body: string;
  step?: string;
  ts: string;
}

interface Remote { id: string; token: string; ref: string }

interface SubmitJob { record: unknown; contact: Record<string, string> }

/** One conversation's delivery state. */
interface Channel {
  key: string;
  consent: Consent;
  consentMethod: "consent_prompt" | "send" | "handoff" | null;
  disclosure: string;
  remote: Remote | null;
  seq: number;
  queue: QueuedEvent[];
  record: unknown;
  recordSent: string;
  submit: SubmitJob | null;
  submittedRef: string | null;
  updatedAt: number;
  /** For "Continue where you left off": the brief and where the chat was. */
  resume: { brief: unknown; route: unknown } | null;
}

export interface SubmitResult { ok: boolean; ref?: string }

const STORAGE_KEY = "dd-chat-v1";
const RESUME_MS = 24 * 60 * 60 * 1000;
const BATCH = 50;
const SUBMIT_TIMEOUT_MS = 20000;
const REQUEST_TIMEOUT_MS = 12000;
export const DISCLOSURE_VERSION = "chat-2026-10";
export const CLIENT_VERSION = "chatbot-1.0.0";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const randomId = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let bits = "";
  bytes.forEach((b) => { bits += b.toString(2).padStart(8, "0"); });
  bits += "00";
  let out = "";
  for (let i = 0; i < 130; i += 5) out += CROCKFORD[parseInt(bits.slice(i, i + 5), 2)];
  return out;
};

const sha256Hex = async (text: string): Promise<string> => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

const newChannel = (consent: Consent = "unasked"): Channel => ({
  key: randomId(),
  consent,
  consentMethod: consent === "yes" ? "consent_prompt" : null,
  disclosure: "",
  remote: null,
  seq: 0,
  queue: [],
  record: null,
  recordSent: "null",
  submit: null,
  submittedRef: null,
  updatedAt: Date.now(),
  resume: null,
});

/** Work left to deliver for a channel the visitor agreed to (or sent). */
const hasWork = (c: Channel) => (c.consent === "yes" || c.submit !== null) && (c.queue.length > 0 || c.submit !== null || JSON.stringify(c.record) !== c.recordSent);

class SyncClient {
  private api: string | null = null;
  private current: Channel = newChannel();
  /** Earlier conversations (restarted, or from a previous page) still being delivered. */
  private detached: Channel[] = [];
  /** An unfinished conversation from an earlier visit, until the visitor chooses. */
  private resumeCandidate: Channel | null = null;
  private timer: number | null = null;
  private delay = 0;
  private busy = false;
  private listeners = new Set<() => void>();
  /** Result of the most recent Send, for the confirmation card. */
  lastSubmit: { state: "idle" | "sending" | "ok" | "failed"; ref?: string } = { state: "idle" };

  configure(apiBase: string | null | undefined) {
    if (!apiBase || this.api) return;
    if (typeof window === "undefined" || !window.crypto?.subtle || !window.fetch) return;
    this.api = apiBase.replace(/\/+$/, "");
    this.load();
    const flushOnLeave = () => this.beacon();
    window.addEventListener("pagehide", flushOnLeave);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushOnLeave(); });
    window.addEventListener("online", () => this.schedule(0));
    this.schedule(500);
  }

  get enabled() { return this.api !== null; }
  get consent(): Consent { return this.current.consent; }

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private emit() { this.listeners.forEach((fn) => fn()); }

  // ── recording ────────────────────────────────────────────────────────────
  log(sender: Sender, type: EventType, body: string, step?: string) {
    if (!this.api) return;
    const text = body.trim().slice(0, 4000);
    if (!text) return;
    const c = this.current;
    c.seq += 1;
    c.queue.push({ seq: c.seq, eventId: randomId(), sender, type, body: text, step: step?.slice(0, 40), ts: new Date().toISOString() });
    c.updatedAt = Date.now();
    this.persist();
    if (c.consent === "yes") this.schedule(1000);
  }

  setRecord(record: unknown) {
    if (!this.api) return;
    this.current.record = record;
    if (this.current.consent === "yes") this.schedule(1000);
  }

  /** Remember where the chat is, so a returning visitor can continue (consented chats only). */
  saveResume(brief: unknown, route: unknown) {
    if (!this.api) return;
    this.current.resume = { brief, route };
    this.current.updatedAt = Date.now();
    this.persist();
  }

  // ── consent ──────────────────────────────────────────────────────────────
  agree(disclosureText: string) {
    if (!this.api) return;
    const c = this.current;
    c.consent = "yes";
    c.consentMethod = "consent_prompt";
    c.disclosure = disclosureText;
    this.persist();
    this.schedule(0);
  }

  /** Consent given by choosing WhatsApp, email or live chat (the notice is the disclosure). */
  agreeHandoff(disclosureText: string) {
    if (!this.api) return;
    const c = this.current;
    if (c.consent === "yes" && c.consentMethod) return;
    c.consent = "yes";
    if (!c.remote) { c.consentMethod = "handoff"; c.disclosure = disclosureText; }
    this.persist();
    this.schedule(0);
  }

  /** The current inquiry's reference, once the server has it. */
  get reference(): string | null { return this.current.submittedRef ?? this.current.remote?.ref ?? null; }
  get submittedRef(): string | null { return this.current.submittedRef; }

  /** Save now (create + send everything queued) and return the reference, or null if the server can't be reached in time. */
  async ensureSaved(timeoutMs = 8000): Promise<string | null> {
    if (!this.api) return null;
    const c = this.current;
    if (c.consent !== "yes" && !c.consentMethod) return null;
    const timeout = new Promise<SubmitResult>((resolve) => window.setTimeout(() => resolve({ ok: false }), timeoutMs));
    const r = await Promise.race([this.deliver(c), timeout]);
    if (!r.ok) this.schedule(2000);
    return c.remote?.ref ?? null;
  }

  /** Record a contact choice (never an outcome). Fire-and-forget; survives the tab opening WhatsApp. */
  channelEvent(channel: "whatsapp" | "phone" | "booking" | "email", event: "initiated" | "selected") {
    const remote = this.current.remote;
    if (!this.api || !remote) return;
    void fetch(`${this.api}/v1/conversations/${remote.id}/channel`, {
      method: "POST", mode: "cors", credentials: "omit", keepalive: true,
      headers: { "Content-Type": "application/json", "X-Chat-Token": remote.token },
      body: JSON.stringify({ channel, event }),
    }).catch(() => { /* a missed timeline entry is not worth bothering the visitor about */ });
  }

  /** Add a follow-up note to an inquiry already sent. */
  async note(text: string): Promise<boolean> {
    const remote = this.current.remote;
    if (!this.api || !remote) return false;
    await this.ensureSaved(5000);
    try {
      const res = await this.post(`/v1/conversations/${remote.id}/note`, { note: text }, remote.token);
      return res.status === 204;
    } catch { return false; }
  }

  /** Is live chat switched on in the dashboard? False whenever it can't be confirmed. */
  async liveAvailable(): Promise<boolean> {
    if (!this.api) return false;
    try {
      const ctrl = new AbortController();
      const t = window.setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(`${this.api}/v1/live/status`, { mode: "cors", credentials: "omit", signal: ctrl.signal });
      window.clearTimeout(t);
      return res.ok && (await res.json()).available === true;
    } catch { return false; }
  }

  // ── live chat (Stage B) ──────────────────────────────────────────────────
  private async liveCall(method: "GET" | "POST", suffix: string, body?: unknown): Promise<{ status: number; data: any }> {
    const remote = this.current.remote;
    if (!this.api || !remote) return { status: 0, data: null };
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${this.api}/v1/conversations/${remote.id}/live${suffix}`, {
        method, mode: "cors", credentials: "omit", signal: ctrl.signal,
        headers: { "X-Chat-Token": remote.token, ...(method === "POST" ? { "Content-Type": "application/json" } : {}) },
        ...(method === "POST" ? { body: JSON.stringify(body ?? {}) } : {}),
      });
      return { status: res.status, data: res.status === 204 ? null : await res.json().catch(() => null) };
    } catch {
      return { status: 0, data: null };
    } finally {
      window.clearTimeout(t);
    }
  }

  liveRequest() { return this.liveCall("POST", ""); }
  livePoll(after: number) { return this.liveCall("GET", `?after=${after}`); }
  liveSend(text: string) { return this.liveCall("POST", "/messages", { body: text.slice(0, 2000) }); }
  liveEnd() { return this.liveCall("POST", "/end", {}); }

  decline() {
    this.current.consent = "private";
    this.persist();
  }

  /** Visitor asked not to save: delete anything stored and stop. Returns true if something had been saved. */
  withdraw(): boolean {
    const c = this.current;
    const remote = c.remote;
    const hadConsent = c.consent === "yes";
    this.current = newChannel("private");
    this.current.seq = 0;
    this.persist();
    if (remote) void this.withdrawRemote(remote, 0);
    return hadConsent && remote !== null;
  }

  private async withdrawRemote(remote: Remote, attempt: number) {
    try {
      const res = await this.post(`/v1/conversations/${remote.id}/withdraw`, {}, remote.token);
      if (res.status === 204 || res.status === 401) return;
    } catch { /* retry below */ }
    if (attempt < 6) window.setTimeout(() => void this.withdrawRemote(remote, attempt + 1), Math.min(60000, 2000 * 2 ** attempt));
  }

  /** A new conversation (welcome, restart). Consent carries over; pending work keeps sending. */
  startNew() {
    const old = this.current;
    if (hasWork(old)) this.detached.push(old);
    // A fresh start is a new inquiry: "yes" carries over, a private choice is asked again.
    this.current = newChannel(old.consent === "yes" ? "yes" : "unasked");
    if (old.consent === "yes") this.current.disclosure = old.disclosure;
    this.lastSubmit = { state: "idle" };
    this.persist();
  }

  // ── continue where you left off ──────────────────────────────────────────
  /** The saved state of an unfinished, consented conversation from the last 24 hours (offered once per page). */
  peekResume(): { brief: unknown; route: unknown } | null {
    return this.resumeCandidate?.resume ?? null;
  }

  /** Visitor chose to continue: that conversation becomes current again. */
  resumeAccepted() {
    const c = this.resumeCandidate;
    this.resumeCandidate = null;
    if (!c) return;
    this.detached = this.detached.filter((d) => d.key !== c.key);
    this.current = c;
    this.persist();
  }

  /** Visitor chose to start fresh: the earlier conversation stays as it is on the server. */
  resumeDeclined() {
    this.resumeCandidate = null;
    this.persist();
  }

  // ── sending ──────────────────────────────────────────────────────────────
  /** Send to the studio. Resolves within ~9 s either way; on failure the job keeps retrying. */
  async submit(record: unknown, contact: Record<string, string>, disclosureText: string): Promise<SubmitResult> {
    if (!this.api) return { ok: false };
    const c = this.current;
    if (c.submittedRef) return { ok: true, ref: c.submittedRef };
    if (c.consent !== "yes" && !c.consentMethod) { c.consentMethod = "send"; c.disclosure = disclosureText; }
    c.record = record;
    c.submit = { record, contact };
    this.lastSubmit = { state: "sending" };
    this.persist();
    this.emit();
    const timeout = new Promise<SubmitResult>((resolve) => window.setTimeout(() => resolve({ ok: false }), SUBMIT_TIMEOUT_MS));
    const result = await Promise.race([this.deliver(c), timeout]);
    if (result.ok && result.ref) this.lastSubmit = { state: "ok", ref: result.ref };
    else {
      this.lastSubmit = { state: "failed" };
      this.schedule(2000);
    }
    this.emit();
    return result;
  }

  private schedule(ms: number) {
    if (!this.api) return;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => { this.timer = null; void this.drain(); }, Math.max(ms, this.delay));
  }

  private async drain() {
    if (this.busy) return;
    this.busy = true;
    let failed = false;
    try {
      for (const c of [...this.detached, this.current]) {
        if (!hasWork(c)) continue;
        const r = await this.deliver(c);
        if (!r.ok && hasWork(c)) failed = true;
      }
    } finally {
      this.busy = false;
    }
    this.detached = this.detached.filter(hasWork);
    this.persist();
    if (failed) {
      this.delay = Math.min(60000, Math.max(2000, this.delay * 2));
      this.schedule(this.delay);
    } else {
      this.delay = 0;
      if (hasWork(this.current) || this.detached.length) this.schedule(1000);
    }
  }

  /** Create (if needed), send queued events and the latest record, then submit if asked. */
  private async deliver(c: Channel): Promise<SubmitResult> {
    try {
      if (!c.remote) {
        if (!c.consentMethod) return { ok: false };
        const res = await this.post("/v1/conversations", {
          consent: { method: c.consentMethod, disclosureVersion: DISCLOSURE_VERSION, disclosureHash: await sha256Hex(c.disclosure) },
          sourcePage: location.pathname,
          referrer: document.referrer || undefined,
          utm: Object.fromEntries([...new URLSearchParams(location.search)].filter(([k]) => k.startsWith("utm_"))),
          clientVersion: CLIENT_VERSION,
        });
        if (res.status !== 201) return this.failed(c, res.status);
        const j = await res.json();
        c.remote = { id: j.conversationId, token: j.token, ref: j.inquiryRef };
        this.persist();
      }
      const remote = c.remote;
      // Events in batches; keep the last batch for the submit call when there is one.
      while (c.queue.length > (c.submit ? BATCH : 0)) {
        const batch = c.queue.slice(0, BATCH);
        const recordJson = JSON.stringify(c.record);
        const body: Record<string, unknown> = { events: batch };
        if (c.record && recordJson !== c.recordSent) body.record = c.record;
        const res = await this.post(`/v1/conversations/${remote.id}/events`, body, remote.token);
        if (res.status !== 200) return this.failed(c, res.status, batch.length);
        c.queue = c.queue.filter((e) => !batch.includes(e));
        if (body.record) c.recordSent = recordJson;
        this.persist();
      }
      if (!c.submit && c.record && JSON.stringify(c.record) !== c.recordSent) {
        const recordJson = JSON.stringify(c.record);
        const res = await this.post(`/v1/conversations/${remote.id}/events`, { events: [], record: c.record }, remote.token);
        if (res.status !== 200) return this.failed(c, res.status);
        c.recordSent = recordJson;
      }
      if (c.submit) {
        const events = c.queue.slice(0, BATCH);
        const res = await this.post(`/v1/conversations/${remote.id}/submit`, { events, record: c.submit.record, contact: c.submit.contact }, remote.token);
        if (res.status !== 200) return this.failed(c, res.status, events.length);
        const j = await res.json();
        c.queue = c.queue.filter((e) => !events.includes(e));
        c.submit = null;
        c.submittedRef = j.inquiryRef;
        c.recordSent = JSON.stringify(c.record);
        this.persist();
        if (c === this.current || this.lastSubmit.state !== "ok") { this.lastSubmit = { state: "ok", ref: j.inquiryRef }; this.emit(); }
        return { ok: true, ref: j.inquiryRef };
      }
      return { ok: true, ref: remote.ref };
    } catch {
      return { ok: false }; // offline or timed out: retry later
    }
  }

  /** Decide what a failed response means for this conversation. */
  private failed(c: Channel, status: number, batchSize = 0): SubmitResult {
    if (status === 401 || status === 404) {
      // The conversation no longer exists on the server (withdrawn or deleted): stop.
      c.queue = []; c.submit = null; c.record = null; c.recordSent = "null"; c.consent = "private"; c.remote = null; c.consentMethod = null;
    } else if (status === 413 || status === 422 || status === 409) {
      // The server will never accept this batch: drop it rather than retry forever.
      c.queue = c.queue.slice(batchSize);
    }
    this.persist();
    return { ok: false };
  }

  private async post(path: string, body: unknown, token?: string): Promise<Response> {
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(this.api + path, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: { "Content-Type": "application/json", ...(token ? { "X-Chat-Token": token } : {}) },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } finally {
      window.clearTimeout(t);
    }
  }

  /** Tab closing: hand the last batch to the browser to deliver. */
  private beacon() {
    if (!this.api || !navigator.sendBeacon) return;
    for (const c of [...this.detached, this.current]) {
      if (!c.remote || c.consent !== "yes" || !c.queue.length) continue;
      const payload = JSON.stringify({ conversationId: c.remote.id, token: c.remote.token, events: c.queue.slice(0, BATCH), record: c.record ?? undefined });
      if (payload.length < 60000) navigator.sendBeacon(`${this.api}/v1/beacon`, new Blob([payload], { type: "text/plain" }));
    }
    this.persist();
  }

  // ── device storage (consented conversations only) ────────────────────────
  private persist() {
    try {
      const all = [...this.detached, this.current];
      if (this.resumeCandidate && !all.includes(this.resumeCandidate)) all.push(this.resumeCandidate);
      // Keep unfinished consented conversations and anything still to deliver; drop sent ones once delivered.
      const keep = all.filter((c) => hasWork(c) || (c.consent === "yes" && !c.submittedRef));
      if (!keep.length) { localStorage.removeItem(STORAGE_KEY); return; }
      const current = this.resumeCandidate?.key ?? this.current.key;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, channels: keep, current }));
    } catch { /* storage unavailable: keep working in memory */ }
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as { v: number; channels: Channel[]; current: string };
      if (data.v !== 1 || !Array.isArray(data.channels)) return;
      const now = Date.now();
      for (const c of data.channels) {
        if (hasWork(c)) this.detached.push(c);
        if (c.key === data.current && now - c.updatedAt < RESUME_MS && c.resume && !c.submittedRef && c.consent === "yes") {
          this.resumeCandidate = c;
        }
      }
    } catch {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    }
  }
}

export const sync = new SyncClient();
