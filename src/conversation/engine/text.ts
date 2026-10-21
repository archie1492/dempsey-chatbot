// Text normalisation and keyword matching. Deterministic: the same input
// always gives the same result.

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, a: 1,
};

/** Lowercase, unify quotes and dashes, collapse whitespace. */
export const normalize = (input: string): string =>
  input
    .toLowerCase()
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

export const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Damerau-free Levenshtein distance, capped for speed. */
const distance = (a: string, b: string, cap = 2): number => {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    let rowMin = prev[0];
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
      rowMin = Math.min(rowMin, prev[j]);
    }
    if (rowMin > cap) return cap + 1;
  }
  return prev[b.length];
};

/**
 * Does `text` (already normalised) contain `term`?
 * - Whole words/phrases by default.
 * - A trailing "*" makes it a prefix ("renovat*" matches "renovation").
 * - fuzzy = true: single words of 6+ letters also match with one typo (same
 *   first letter). Used only for classifying sector, type and topic — never
 *   for details like "flood", where "floor" must not match.
 * - A negation ("not", "no", "isn't", "without") in the three words before cancels the match.
 */
export const hasTerm = (text: string, term: string, fuzzy = false): boolean => {
  const prefix = term.endsWith("*");
  const t = prefix ? term.slice(0, -1) : term;
  const re = new RegExp(`(^|[^a-z0-9])(${escapeRe(t)})${prefix ? "" : "(?![a-z0-9])"}`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const start = m.index + m[1].length;
    if (!negated(text, start)) return true;
  }
  if (fuzzy && !prefix && !t.includes(" ") && t.length >= 6) {
    for (const w of text.split(/[^a-z0-9&'-]+/)) {
      if (w.length >= 6 && w[0] === t[0] && distance(w, t, 1) <= 1 && !negated(text, text.indexOf(w))) return true;
    }
  }
  return false;
};

const NEGATIONS = new Set(["not", "no", "isn't", "isnt", "aren't", "arent", "without", "never", "don't", "dont"]);

const negated = (text: string, index: number): boolean => {
  const before = text.slice(0, index).split(/\s+/).filter(Boolean).slice(-3);
  return before.some((w) => NEGATIONS.has(w.replace(/[^a-z']/g, "")));
};

export const anyTerm = (text: string, terms: string[]) => terms.some((t) => hasTerm(text, t));

/** Sum of weights of matched terms. */
export const score = (text: string, terms: Array<[string, number]>) =>
  terms.reduce((sum, [term, w]) => (hasTerm(text, term, true) ? sum + w : sum), 0);

/**
 * Pick the best-scoring key.
 * - `best`: a clear winner (score >= minScore and ahead of the runner-up by >= minLead).
 * - `close`: no clear winner, but the top two both scored — offer them as choices.
 */
export const pickBest = <K extends string>(
  scores: Record<K, number>,
  minScore = 2,
  minLead = 1,
): { best: K | null; top: K[]; close: boolean } => {
  const ranked = (Object.entries(scores) as Array<[K, number]>)
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1]);
  const [first, second] = ranked;
  if (!first) return { best: null, top: [], close: false };
  const lead = first[1] - (second?.[1] ?? 0);
  if (first[1] >= minScore && lead >= minLead) return { best: first[0], top: [first[0]], close: false };
  return { best: null, top: ranked.slice(0, 2).map(([k]) => k), close: ranked.length >= 2 };
};

/** Parse "1,200", "1.2", "4k", "1.2m", "800 thousand", "two million" into a number. */
export const parseAmount = (num: string, suffix?: string): number | null => {
  let n: number;
  const cleaned = num.replace(/,/g, "").trim();
  if (/^\d+(\.\d+)?$/.test(cleaned)) n = parseFloat(cleaned);
  else if (WORD_NUMBERS[cleaned] !== undefined) n = WORD_NUMBERS[cleaned];
  else return null;
  const s = (suffix ?? "").toLowerCase().trim();
  if (s === "k" || s === "thousand") n *= 1_000;
  else if (s === "m" || s === "mm" || s === "mil" || s === "million") n *= 1_000_000;
  return n;
};

export const formatMoney = (n: number): string => {
  if (n >= 1_000_000) return `$${trim(n / 1_000_000)}M`;
  if (n >= 1_000) return `$${trim(n / 1_000)}K`;
  return `$${Math.round(n)}`;
};

export const formatNumber = (n: number) => Math.round(n).toLocaleString("en-US");

const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ""));

/** "a, b and c" */
export const joinList = (parts: string[]): string =>
  parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

export const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
