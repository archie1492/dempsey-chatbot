// Place names the assistant recognises. A match decides the location note
// (South Florida, another licensed state, or outside the licensed states).
// Unknown places are kept exactly as typed, with no comment.

import type { Region } from "../schema";

export interface Place {
  name: string; // display form
  county?: string;
  region: Region;
}

const sf = (county: string, names: string[]): Array<[string, Place]> =>
  names.map((n) => [n, { name: titleCase(n), county, region: "south_florida" }]);

const lic = (state: string, names: string[]): Array<[string, Place]> =>
  names.map((n) => [n, { name: n.length <= 3 ? state : titleCase(n), region: "licensed" }]);

const titleCase = (s: string) =>
  s.replace(/\b([a-z])([a-z']*)/g, (_, a: string, b: string) => a.toUpperCase() + b)
    .replace(/\bSt\b/g, "St.")
    .replace(/\bFt\b/g, "Fort")
    .replace(/\bPbc\b/, "Palm Beach County");

export const PLACES: Array<[string, Place]> = [
  ...sf("Palm Beach", [
    "west palm beach", "west palm", "palm beach", "palm beach gardens", "north palm beach", "juno beach",
    "jupiter", "tequesta", "wellington", "royal palm beach", "lake worth", "lake worth beach", "lantana",
    "boynton beach", "boynton", "delray beach", "delray", "highland beach", "boca raton", "boca",
    "greenacres", "riviera beach", "singer island", "belle glade", "loxahatchee", "manalapan",
    "ocean ridge", "gulf stream", "hypoluxo", "palm beach county", "pbc",
  ]),
  ...sf("Broward", [
    "fort lauderdale", "ft lauderdale", "ft. lauderdale", "hollywood", "pompano beach", "pompano",
    "deerfield beach", "coral springs", "plantation", "sunrise", "weston", "davie", "hallandale",
    "hallandale beach", "dania beach", "miramar", "pembroke pines", "lauderdale-by-the-sea",
    "lighthouse point", "parkland", "coconut creek", "margate", "tamarac", "broward", "broward county",
  ]),
  ...sf("Miami-Dade", [
    "miami", "miami beach", "south beach", "coral gables", "doral", "hialeah", "homestead", "aventura",
    "sunny isles", "sunny isles beach", "golden beach", "bal harbour", "surfside", "key biscayne",
    "coconut grove", "brickell", "north miami", "kendall", "cutler bay", "pinecrest", "miami-dade",
    "miami dade", "dade county",
  ]),
  ...sf("Martin", ["stuart", "palm city", "hobe sound", "jensen beach", "martin county"]),
  ...sf("St. Lucie", ["port st lucie", "port st. lucie", "fort pierce", "st lucie", "st. lucie"]),
  ...sf("Monroe", ["key west", "key largo", "islamorada", "marathon", "florida keys"]),
  ["south florida", { name: "South Florida", region: "south_florida" }],
  ...lic("Florida", [
    "orlando", "tampa", "jacksonville", "naples", "sarasota", "fort myers", "st. petersburg",
    "st petersburg", "tallahassee", "gainesville", "vero beach", "melbourne", "daytona beach",
    "pensacola", "florida",
  ]),
  ...lic("Arkansas", [
    "little rock", "fayetteville", "bentonville", "rogers", "springdale", "hot springs", "searcy",
    "conway", "fort smith", "jonesboro", "arkansas",
  ]),
  ...lic("New York", [
    "new york", "new york city", "nyc", "manhattan", "brooklyn", "queens", "bronx", "staten island",
    "long island", "the hamptons", "hamptons", "westchester", "buffalo", "rochester", "albany",
  ]),
  ...lic("Washington, D.C.", ["washington dc", "washington, dc", "washington d.c.", "washington, d.c.", "d.c."]),
];

/** State names outside the licensed states. */
export const OTHER_STATES = [
  "alabama", "alaska", "arizona", "california", "colorado", "connecticut", "delaware", "georgia",
  "hawaii", "idaho", "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine",
  "maryland", "massachusetts", "michigan", "minnesota", "mississippi", "missouri", "montana",
  "nebraska", "nevada", "new hampshire", "new jersey", "new mexico", "north carolina", "north dakota",
  "ohio", "oklahoma", "oregon", "pennsylvania", "rhode island", "south carolina", "south dakota",
  "tennessee", "texas", "utah", "vermont", "virginia", "washington state", "west virginia",
  "wisconsin", "wyoming", "puerto rico", "bahamas", "canada", "mexico", "caribbean",
];

/** Two-letter abbreviations, only trusted after a comma ("Denver, CO"). */
export const STATE_ABBREVIATIONS: Record<string, Region> = {
  fl: "licensed", ar: "licensed", ny: "licensed", dc: "licensed",
  al: "outside", ak: "outside", az: "outside", ca: "outside", co: "outside", ct: "outside", de: "outside",
  ga: "outside", hi: "outside", id: "outside", il: "outside", in: "outside", ia: "outside", ks: "outside",
  ky: "outside", la: "outside", me: "outside", md: "outside", ma: "outside", mi: "outside", mn: "outside",
  ms: "outside", mo: "outside", mt: "outside", ne: "outside", nv: "outside", nh: "outside", nj: "outside",
  nm: "outside", nc: "outside", nd: "outside", oh: "outside", ok: "outside", or: "outside", pa: "outside",
  ri: "outside", sc: "outside", sd: "outside", tn: "outside", tx: "outside", ut: "outside", vt: "outside",
  va: "outside", wa: "outside", wv: "outside", wi: "outside", wy: "outside",
};

/** First three ZIP digits → county (South Florida) or Florida generally. */
export const zipToPlace = (zip: string): Place | null => {
  const p = zip.slice(0, 3);
  if (p === "334") return { name: zip, county: "Palm Beach", region: "south_florida" };
  if (["330", "331", "332", "333"].includes(p)) return { name: zip, region: "south_florida" };
  if (p === "349") return { name: zip, region: "south_florida" };
  if (/^3[2-4]\d$/.test(p)) return { name: zip, region: "licensed" };
  return null;
};
