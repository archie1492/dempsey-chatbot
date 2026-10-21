// Contextual notes: one considered sentence when a visitor mentions a situation
// that matters to the design. Each is triggered only by words the visitor used,
// and shown at most once per conversation. Edit the wording freely; keep each
// note calm, specific and free of promises.

import type { Sector } from "../schema";

export interface ContextNote {
  key: string;
  /** Whole words or phrases (lowercase). A trailing * matches word starts. */
  terms: string[];
  /** Limit to these pathways (omit for any). */
  sectors?: Sector[];
  note: string;
}

export const CONTEXT_NOTES: ContextNote[] = [
  {
    key: "historic",
    terms: ["historic", "historical", "landmark", "landmarked", "historic district", "preservation", "1920s", "1930s", "mediterranean revival", "mizner"],
    note: "Historic renovations can involve some interesting design and preservation considerations, often including review by a local preservation board.",
  },
  {
    key: "waterfront",
    terms: ["waterfront", "seawall", "sea wall", "dock", "on the water", "intracoastal", "oceanfront", "ocean front", "beachfront", "lakefront", "canal"],
    note: "Waterfront sites bring flood-zone and coastal requirements that shape the design early, so it helps to know about them up front.",
  },
  {
    key: "association",
    terms: ["hoa", "homeowners association", "condo association", "association approval", "co-op", "coop board"],
    note: "Association approval usually becomes part of the timeline, so it's worth planning for from the start.",
  },
  {
    key: "compliance",
    terms: ["unpermitted", "without a permit", "without permits", "code violation", "code enforcement", "violation", "after the fact", "after-the-fact", "red tag", "red-tagged", "stop work"],
    note: "Bringing existing work into compliance is something the studio helps with; the timing often depends on the building department, so it's worth starting early.",
  },
  {
    key: "outdoor",
    terms: ["pool", "cabana", "outdoor kitchen", "summer kitchen", "pergola", "loggia", "courtyard", "outdoor living"],
    sectors: ["residential", "hospitality"],
    note: "Outdoor spaces are a large part of how South Florida buildings are lived in, so they deserve as much design attention as the interiors.",
  },
  {
    key: "wind",
    terms: ["impact windows", "impact glass", "hurricane", "storm shutters", "wind load", "wind-load"],
    note: "Florida's wind-load requirements shape openings and structure, so they're best considered early in the design.",
  },
  {
    key: "adu",
    terms: ["guest house", "guesthouse", "adu", "accessory dwelling", "in-law suite", "in-law unit", "granny flat"],
    sectors: ["residential"],
    note: "Accessory units are governed by local zoning, so the lot's setbacks and coverage limits matter early.",
  },
  {
    key: "multifamily",
    terms: ["multifamily", "multi-family", "apartment building", "townhomes", "townhouses", "duplex", "triplex", "fourplex", "apartment units"],
    note: "Multifamily projects depend heavily on zoning and density, so what the site allows is a useful early question.",
  },
  {
    key: "mixeduse",
    terms: ["mixed-use", "mixed use", "retail below", "ground-floor retail", "ground floor retail"],
    note: "Mixed-use buildings bring several codes and uses together, so early coordination pays off.",
  },
  {
    key: "worship",
    terms: ["church", "chapel", "synagogue", "mosque", "temple", "sanctuary", "worship", "congregation", "parish"],
    note: "Places of worship balance gathering, acoustics and light, and decisions often involve a building committee, so early conversations help.",
  },
  {
    key: "education",
    terms: ["school", "classroom", "classrooms", "campus", "charter school", "preschool", "daycare", "day care"],
    note: "Education projects usually involve several stakeholders and a fixed academic calendar, so timing matters early.",
  },
  {
    key: "wellness",
    sectors: ["commercial", "hospitality", "institutional"],
    terms: ["spa", "wellness", "yoga", "pilates", "fitness", "med spa", "medspa", "sauna", "bathhouse"],
    note: "Wellness spaces depend as much on light, acoustics and flow as on equipment — an area the studio particularly enjoys.",
  },
  {
    key: "urgent",
    terms: ["asap", "urgent", "urgently", "as soon as possible", "tight deadline", "tight timeline", "right away", "immediately"],
    note: "If the timeline is tight, mention it when the architect calls — sequencing drawings and permits early can save weeks.",
  },
  {
    key: "budget",
    terms: ["tight budget", "limited budget", "on a budget", "budget is tight", "cost-effective", "cost effective", "value engineering"],
    note: "Budget is best shaped at the start, when design decisions have the most effect on cost.",
  },
  {
    key: "accessibility",
    terms: ["ada", "wheelchair", "accessibility", "aging in place", "age in place"],
    note: "Accessibility works best when it's designed in from the beginning rather than added later.",
  },
];
