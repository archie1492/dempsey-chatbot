// Unit tests for the conversation engine. Run: npm run test:unit
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifySector, classifyTopic, findAreas, findCounts, findEmail, findLocation, findMoney,
  findName, findPhone, findSiteStatus, findSolicitation, findSpecial, findTimeline, isClientMessage,
} from "../src/conversation/engine/extract";
import { handle, nextRoute, beginEdit, isWithdrawRequest } from "../src/conversation/engine/conversation";
import { reviewRows, toRecord, plainText } from "../src/conversation/engine/summary";
import { newBrief, type Brief, type Route } from "../src/conversation/schema";

const NOW = new Date("2026-10-20T12:00:00-04:00");

// ── extractors ─────────────────────────────────────────────────────────────
const areaCases: Array<[string, number, string]> = [
  ["add a second floor, maybe 1,200 sf", 1200, "proposed"],
  ["3800 rsf suite", 3800, "unknown"],
  ["about 4k square feet", 4000, "unknown"],
  ["a 2,000-square-foot addition", 2000, "proposed"],
  ["the house is about 2,400 sq ft", 2400, "existing"],
  ["12,000 SF wellness center", 12000, "unknown"],
  ["existing 5,500 sqft building", 5500, "existing"],
];
for (const [text, n, kind] of areaCases) {
  test(`area: ${text}`, () => {
    const hit = findAreas(text)[0];
    assert.equal(hit?.value, n);
    assert.equal(hit?.kind, kind);
  });
}

const moneyCases: Array<[string, number | null, number | null]> = [
  ["budget is $1.2M", 1_200_000, null],
  ["around 800k", 800_000, null],
  ["$800,000 all in", 800_000, null],
  ["between 1 and 2 million", 1_500_000, null],
  ["$60/sf", null, 60],
  ["TI of $45 per square foot", null, 45],
  ["we want to spend 500 thousand", 500_000, null],
  ["3,500 sf in Jupiter", null, null],
  ["40 keys", null, null],
  ["opening 2028", null, null],
];
for (const [text, amount, perSf] of moneyCases) {
  test(`money: ${text}`, () => {
    const m = findMoney(text);
    assert.equal(m?.amount ?? null, amount);
    assert.equal(m?.perSf ?? null, perSf);
  });
}

const timelineCases: Array<[string, string, string | null]> = [
  ["hopefully next fall", "Next fall", "2027-10"],
  ["Q2 2027", "Q2 2027", "2027-05"],
  ["by March 2027", "March 2027", "2027-03"],
  ["ASAP", "As soon as possible", "2026-11"],
  ["opening 2028", "2028", "2028-06"],
  ["in 6 months", "In about 6 months", "2027-04"],
  ["late 2027", "Late 2027", "2027-11"],
  ["sometime in June", "June 2027", "2027-06"],
  ["next year", "Next year (2027)", null],
];
for (const [text, label, month] of timelineCases) {
  test(`timeline: ${text}`, () => {
    const t = findTimeline(text, NOW);
    assert.equal(t?.text, label);
    assert.equal(t?.approxMonth, month);
  });
}
test("timeline: 'we may want' is not May", () => assert.equal(findTimeline("we may want a pool", NOW), null));
test("timeline: past year ignored", () => assert.equal(findTimeline("built in 2015", NOW), null));

const locationCases: Array<[string, boolean, string | null, string | null]> = [
  ["Jupiter", true, "Jupiter", "south_florida"],
  ["a house in Jupiter", false, "Jupiter", "south_florida"],
  ["West Palm Beach", true, "West Palm Beach", "south_florida"],
  ["in Boca", false, "Boca", "south_florida"],
  ["33480", true, "33480", "south_florida"],
  ["Little Rock, AR", true, "Little Rock", "licensed"],
  ["Denver, Colorado", true, "Denver, Colorado", "outside"],
  ["Austin, TX", true, "Austin, TX", "outside"],
  ["Brooklyn", true, "Brooklyn", "licensed"],
  ["plantation shutters for the house", false, null, null],
];
for (const [text, strict, name, region] of locationCases) {
  test(`location: ${text}`, () => {
    const l = findLocation(text, strict);
    assert.equal(l?.text ?? null, name);
    assert.equal(l?.region ?? null, region);
  });
}
test("location: Palm Beach County is Palm Beach county", () => assert.equal(findLocation("Palm Beach County", true)?.county, "Palm Beach"));

test("sector: hotel", () => assert.equal(classifySector("Boutique hotel, 40 keys, new construction in Delray").best, "hospitality"));
test("sector: second floor", () => assert.equal(classifySector("We just bought a 1960s house and want to add a second floor").best, "residential"));
test("sector: medical buildout", () => assert.equal(classifySector("medical office buildout").best, "commercial"));
test("sector: church", () => assert.equal(classifySector("our church needs a fellowship hall").best, "institutional"));
test("sector: renovaton typo", () => assert.equal(classifySector("kitchen renovaton in our home").best, "residential"));
test("sector: not a restaurant", () => assert.notEqual(classifySector("not a restaurant, it's an office").best, "hospitality"));
test("topic: fees", () => assert.equal(classifyTopic("how much are your fees?"), "fees"));
test("topic: broward", () => assert.equal(classifyTopic("Do you work in Broward?"), "areas"));
test("topic: careers", () => assert.equal(classifyTopic("are you hiring?"), "vendors"));
test("client: working with you", () => assert.ok(isClientMessage("we're working with you on the Lake Worth residence")));
test("counts", () => assert.deepEqual(findCounts("40 keys and 120 seats"), { keys: 40, seats: 120 }));
test("counts: 3 bedrooms are not keys", () => assert.deepEqual(findCounts("3 bedrooms"), {}));
test("site: just bought", () => assert.equal(findSiteStatus("we just bought a house"), "owned"));
test("site: LOI", () => assert.equal(findSiteStatus("We signed an LOI last week"), "loi"));
test("site: still looking", () => assert.equal(findSiteStatus("still looking for a space"), "searching"));
test("special: second floor is not a flood zone", () => assert.deepEqual(findSpecial("add a second floor"), []));
test("special: flood + historic", () => assert.deepEqual(findSpecial("waterfront lot in a historic district").sort(), ["flood_zone", "historic"]));
test("rfq", () => assert.equal(findSolicitation("Yes, RFQ 26-112, due November 14."), "RFQ 26-112, due November 14"));
test("email", () => assert.equal(findEmail("reach me at maria.lopez@example.com"), "maria.lopez@example.com"));
test("phone", () => assert.equal(findPhone("call (561) 555-0134"), "561-555-0134"));
test("name: it's Maria Lopez", () => assert.equal(findName("hi, it's Maria Lopez — we're working with you"), "Maria Lopez"));
test("name: I'm looking is not a name", () => assert.equal(findName("I'm Looking for an architect"), null));

// ── conversations ──────────────────────────────────────────────────────────
const run = (b: Brief, steps: string[], start: Route = { to: "start" }) => {
  let at = start;
  for (const s of steps) at = handle(b, at, s, NOW);
  return at;
};

test("residential: one sentence fills type, location, size and ownership", () => {
  const b = newBrief();
  const at = run(b, ["We just bought a 1960s house in Jupiter and want to add a second floor, maybe 1,200 sf."]);
  assert.equal(b.answers.sector?.value, "residential");
  assert.equal(b.answers.projectType?.value, "addition");
  assert.equal((b.answers.location?.value as { text: string }).text, "Jupiter");
  assert.equal(b.answers.proposedSf?.value, 1200);
  assert.equal(b.answers.siteStatus?.value, "owned");
  assert.ok(b.answers.description);
  assert.deepEqual(at, { to: "ask", q: "occupied" });
  assert.match(b.notes.join(" "), /addition in Jupiter/);
  assert.match(b.notes.join(" "), /South Florida/);
});

test("residential: checkpoint, then optional questions skip what is known", () => {
  const b = newBrief();
  let at = run(b, ["We just bought a 1960s house in Jupiter and want to add a second floor, maybe 1,200 sf.", "Not decided", "hopefully next fall"]);
  assert.deepEqual(at, { to: "ask", q: "checkpoint" });
  at = run(b, ["Continue — about a minute"], at);
  assert.deepEqual(at, { to: "ask", q: "existingSf" });
  at = run(b, ["2,400", "Skip"], at);
  // proposedSf and siteStatus already known → documents next
  assert.deepEqual(at, { to: "ask", q: "documents" });
  at = run(b, ["Survey", "Waterfront or flood zone", "Ana Ruiz", "ana@example.com"], at);
  assert.deepEqual(at, { to: "review" });
  assert.equal(b.answers.budget?.skipped, true);
  const rows = reviewRows(b).map((r) => r.label);
  assert.ok(rows.includes("Construction budget") && rows.includes("Contact"));
});

test("checkpoint: review and send skips optional questions", () => {
  const b = newBrief();
  const at = run(b, ["Residential", "New home", "Skip", "Wellington", "Within 6 months", "Review and send"]);
  assert.deepEqual(at, { to: "ask", q: "contactName" });
});

test("commercial tenant with LOI: TI allowance from $60/sf", () => {
  const b = newBrief();
  let at = run(b, ["Commercial & tenant improvements", "Medical or clinical"]);
  assert.match(b.notes.join(" "), /Clinical space/);
  at = run(b, ["Skip", "Boca Raton"], at);
  assert.deepEqual(at, { to: "ask", q: "role" });
  at = run(b, ["Tenant. We signed an LOI last week for about 3,800 rsf."], at);
  assert.equal(b.answers.role?.value, "tenant");
  assert.equal(b.answers.siteStatus?.value, "loi");
  assert.equal(b.answers.sizeSf?.value, 3800);
  assert.deepEqual(at, { to: "ask", q: "tiAllowance" });
  at = run(b, ["yes, $60/sf I think"], at);
  assert.equal(b.answers.tiAllowance?.label, "Yes — $60/SF");
  assert.deepEqual(at, { to: "ask", q: "timeline" });
});

test("hospitality: everything in one sentence", () => {
  const b = newBrief();
  const at = run(b, ["Boutique hotel, 40 keys, new construction in Delray, opening 2028"]);
  assert.equal(b.answers.projectType?.value, "hotel");
  assert.equal(b.answers.keys?.value, 40);
  assert.equal(b.answers.workType?.value, "new");
  assert.equal((b.answers.timeline?.value as { text: string }).text, "2028");
  assert.deepEqual(at, { to: "ask", q: "brand" });
  assert.match(b.notes.join(" "), /40-key hotel in Delray/);
  const next = run(b, ["Brand, probably a soft brand."], at);
  assert.match(b.notes.join(" "), /Brand standards/);
  assert.deepEqual(next, { to: "ask", q: "checkpoint" });
});

test("institutional: open RFQ goes straight to contact", () => {
  const b = newBrief();
  let at = run(b, ["Institutional & public", "School or education"]);
  assert.deepEqual(at, { to: "ask", q: "solicitation" });
  at = run(b, ["Yes", "RFQ 26-112, due November 14"], at);
  assert.match(b.notes.join(" "), /procurement contact/);
  assert.equal(b.answers.timeline, undefined, "RFQ due date must not become the timeline");
  assert.doesNotMatch(b.notes.join(" "), /timing/);
  assert.deepEqual(at, { to: "ask", q: "contactName" });
});

test("institutional: no RFQ continues with stage and funding; SBE note once", () => {
  const b = newBrief();
  const at = run(b, ["Institutional & public", "Municipal or county", "No", "Skip", "West Palm Beach"]);
  assert.match(b.notes.join(" "), /SBE-certified/);
  assert.deepEqual(at, { to: "ask", q: "stage" });
});

test("existing client: name, project and message captured from one line", () => {
  const b = newBrief();
  const at = run(b, ["hi, it's Maria Lopez — we're working with you on the Lake Worth residence and need to move Thursday's site visit"]);
  assert.equal(b.kind, "client");
  assert.equal(b.answers.contactName?.value, "Maria Lopez");
  assert.equal(b.answers.clientProject?.value, "the Lake Worth residence");
  assert.deepEqual(at, { to: "ask", q: "urgency" });
});

test("general question routes to an answer", () => {
  const b = newBrief();
  assert.deepEqual(run(b, ["Do you work in Broward?"]), { to: "info", topic: "areas" });
});

test("menu, restart and human commands work anywhere", () => {
  const b = newBrief();
  const at = run(b, ["Residential", "New home"]);
  assert.deepEqual(handle(b, at, "menu", NOW), { to: "menu" });
  assert.deepEqual(handle(b, at, "can I talk to someone?", NOW), { to: "architect" });
  assert.deepEqual(handle(b, at, "start over", NOW), { to: "start" });
  assert.equal(b.kind, null);
});

test("fallback: unknown text twice offers an architect", () => {
  const b = newBrief();
  let at = run(b, ["Residential"]);
  at = run(b, ["qwerty asdf"], at);
  assert.deepEqual(at, { to: "ask", q: "projectType" });
  run(b, ["zzz"], at);
  assert.equal(b.misses, 2);
});

test("contact: invalid reach is re-asked, skip is refused", () => {
  const b = newBrief();
  let at = run(b, ["Residential", "New home", "Skip", "Jupiter", "Within 6 months", "Review and send", "Sam"]);
  assert.deepEqual(at, { to: "ask", q: "contactReach" });
  at = run(b, ["not telling"], at);
  assert.deepEqual(at, { to: "ask", q: "contactReach" });
  at = run(b, ["561 555 0101"], at);
  assert.deepEqual(at, { to: "review" });
});

test("edit from review returns to review", () => {
  const b = newBrief();
  run(b, ["Residential", "New home", "Skip", "Jupiter", "Within 6 months", "Review and send", "Sam", "sam@example.com"]);
  const at = beginEdit(b, "location");
  assert.deepEqual(at, { to: "ask", q: "location" });
  assert.deepEqual(handle(b, at, "Palm Beach Gardens", NOW), { to: "review" });
  assert.equal((b.answers.location?.value as { text: string }).text, "Palm Beach Gardens");
});

test("send from review produces a record", () => {
  const b = newBrief();
  const at = run(b, ["Residential", "New home", "Skip", "Jupiter", "Within 6 months", "Review and send", "Sam", "sam@example.com"]);
  assert.deepEqual(handle(b, at, "Send to the studio", NOW), { to: "sent" });
  const r = toRecord(b, "/chatbot-test");
  assert.equal(r.schemaVersion, 1);
  assert.equal(r.contact.email, "sam@example.com");
  assert.equal(r.status, "sent");
  assert.match(plainText(b), /Location: Jupiter/);
});

test("nothing is asked twice", () => {
  const b = newBrief();
  run(b, ["Boutique hotel, 40 keys, new construction in Delray, opening 2028"]);
  const asked = new Set<string>();
  let at: Route = nextRoute(b);
  for (let i = 0; i < 30 && at.to === "ask"; i++) {
    assert.ok(!asked.has(at.q), `asked twice: ${at.q}`);
    asked.add(at.q);
    at = handle(b, at, at.q === "checkpoint" ? "Continue — about a minute" : at.q === "contactName" ? "Lee" : at.q === "contactReach" ? "lee@example.com" : "Skip", NOW);
  }
  assert.deepEqual(at, { to: "review" });
});

// ── Phase 4: company field and withdraw requests ───────────────────────────
const toCompany = (sentence: string) => {
  const b = newBrief();
  let at: Route = handle(b, { to: "start" }, sentence, NOW);
  for (let i = 0; i < 30 && at.to === "ask" && at.q !== "company"; i++) {
    at = handle(b, at, at.q === "checkpoint" ? "Review and send" : at.q === "contactName" ? "Lee Park" : at.q === "contactReach" ? "lee@example.com" : "Skip", NOW);
  }
  return { b, at };
};

test("company: asked (optional) after contact on commercial, hospitality and institutional", () => {
  for (const s of ["Medical office in Boca, 3,800 sf", "Boutique hotel, 40 keys in Delray", "New fire station for the city of Lake Worth"]) {
    const { at } = toCompany(s);
    assert.deepEqual(at, { to: "ask", q: "company" }, s);
  }
});

test("company: never asked on residential", () => {
  const { at } = toCompany("Kitchen renovation in our home in Jupiter");
  assert.notDeepEqual(at, { to: "ask", q: "company" });
});

test("company: typed name stored in the record; 'none' counts as not provided", () => {
  const { b, at } = toCompany("Medical office in Boca, 3,800 sf");
  assert.deepEqual(handle(b, at, "We're Park Dental Group.", NOW), { to: "review" });
  assert.equal(toRecord(b).contact.company, "Park Dental Group");
  const other = toCompany("Medical office in Boca, 3,800 sf");
  handle(other.b, other.at, "none", NOW);
  assert.equal(toRecord(other.b).contact.company, "");
  assert.ok(!("company" in toRecord(other.b).answers));
});

test("withdraw requests are recognised, project talk is not", () => {
  for (const t of ["don't save", "Please delete this conversation", "delete my data", "stop saving", "forget this"]) assert.ok(isWithdrawRequest(t), t);
  for (const t of ["we need to remove a wall", "delete the second floor from the plan", "save money on the kitchen", "Residential"]) assert.ok(!isWithdrawRequest(t), t);
});
