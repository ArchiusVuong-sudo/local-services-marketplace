import type { Category } from "@/lib/domain/types";

/** 12 home-service categories. Synthetic: names, questions and lead fees are invented for the demo. */
export const CATEGORIES: Category[] = [
  {
    slug: "water-heater-repair",
    name: "Water heater repair",
    serves_label: "Serves water heaters",
    keywords: ["water heater", "hot water", "tankless", "pilot light", "pilot", "heater tank", "water tank", "anode"],
    lead_fee_credits: 15,
    questions: [
      { id: "fuel", text: "Gas or electric?", options: ["Gas", "Electric", "Not sure"] },
      { id: "type", text: "Tank or tankless?", options: ["Tank", "Tankless", "Not sure"] },
      { id: "age", text: "How old is the unit?", options: ["Under 5 years", "5-10 years", "Over 10 years", "Not sure"] },
    ],
  },
  {
    slug: "leak-repair",
    name: "Leak and pipe repair",
    serves_label: "Fixes leaks and pipes",
    keywords: ["leak", "leaking", "pipe", "burst", "drip", "dripping", "faucet", "toilet", "under the sink", "water stain", "shutoff valve"],
    lead_fee_credits: 12,
    questions: [
      { id: "where", text: "Where is the leak?", options: ["Kitchen", "Bathroom", "Wall or ceiling", "Outside", "Not sure"] },
      { id: "shutoff", text: "Can you shut off the water to it?", options: ["Yes", "No", "Not sure"] },
    ],
  },
  {
    slug: "drain-cleaning",
    name: "Drain cleaning",
    serves_label: "Clears drains",
    keywords: ["drain", "clog", "clogged", "backed up", "backing up", "slow drain", "sewer", "rooter", "snake"],
    lead_fee_credits: 10,
    questions: [
      { id: "which", text: "Which drain?", options: ["Kitchen sink", "Shower or tub", "Toilet", "Main line"] },
      { id: "first_time", text: "Has this happened before?", options: ["First time", "It keeps coming back"] },
    ],
  },
  {
    slug: "ac-repair",
    name: "AC repair",
    serves_label: "Repairs AC units",
    keywords: ["ac", "a/c", "air conditioner", "air conditioning", "cooling", "hvac", "warm air", "thermostat", "heat pump", "condenser", "refrigerant"],
    lead_fee_credits: 18,
    questions: [
      { id: "symptom", text: "What is it doing?", options: ["Not cooling", "Not turning on", "Leaking water", "Strange noise"] },
      { id: "system", text: "What kind of system?", options: ["Central air", "Heat pump", "Mini split", "Not sure"] },
    ],
  },
  {
    slug: "pool-care",
    name: "Pool care",
    serves_label: "Services pools",
    keywords: ["pool", "green pool", "pool pump", "chlorine", "spa", "hot tub", "pool filter"],
    lead_fee_credits: 8,
    questions: [
      { id: "service", text: "What service do you need?", options: ["Weekly cleaning", "One-time clean", "Pump or filter repair", "Green to clean"] },
      { id: "spa", text: "Is there an attached spa?", options: ["Yes", "No"] },
    ],
  },
  {
    slug: "electrical",
    name: "Electrical work",
    serves_label: "Does electrical work",
    keywords: ["electrical", "electrician", "outlet", "breaker", "wiring", "light fixture", "ceiling fan", "panel", "sparking", "ev charger", "switch"],
    lead_fee_credits: 14,
    questions: [
      { id: "work", text: "What kind of work?", options: ["Repair", "New install", "Panel upgrade", "EV charger"] },
      { id: "power", text: "Is any part of the house without power?", options: ["Yes", "No"] },
    ],
  },
  {
    slug: "handyman",
    name: "Handyman",
    serves_label: "Handles odd jobs",
    keywords: ["handyman", "mount", "tv", "shelves", "shelf", "drywall", "sticking door", "assemble", "furniture", "odd jobs", "patch"],
    lead_fee_credits: 6,
    questions: [
      { id: "tasks", text: "How many tasks?", options: ["One", "2-3", "A full list"] },
      { id: "materials", text: "Do you have the materials?", options: ["Yes", "No, the pro brings them"] },
    ],
  },
  {
    slug: "house-cleaning",
    name: "House cleaning",
    serves_label: "Cleans homes",
    keywords: ["cleaning", "clean", "maid", "move-out", "move out", "deep clean", "housekeeping", "cleaner"],
    lead_fee_credits: 5,
    questions: [
      { id: "kind", text: "What kind of clean?", options: ["Standard clean", "Deep clean", "Move-in or move-out"] },
      { id: "bedrooms", text: "How many bedrooms?", options: ["1-2", "3", "4+"] },
    ],
  },
  {
    slug: "landscaping",
    name: "Landscaping and yard care",
    serves_label: "Cares for yards",
    keywords: ["yard", "lawn", "landscaping", "tree", "trim", "trimmed", "hedges", "irrigation", "sprinkler", "weeds", "gravel", "mow"],
    lead_fee_credits: 7,
    questions: [
      { id: "service", text: "What does the yard need?", options: ["Regular maintenance", "One-time cleanup", "Irrigation repair", "Tree trimming"] },
      { id: "size", text: "How big is the yard?", options: ["Small", "Medium", "Large"] },
    ],
  },
  {
    slug: "roofing",
    name: "Roof repair",
    serves_label: "Repairs roofs",
    keywords: ["roof", "roofing", "shingle", "shingles", "roof tiles", "flashing", "monsoon", "storm damage", "ceiling stain"],
    lead_fee_credits: 20,
    questions: [
      { id: "roof_type", text: "What kind of roof?", options: ["Tile", "Shingle", "Flat or foam", "Not sure"] },
      { id: "problem", text: "What is the problem?", options: ["Leak", "Storm damage", "Inspection", "Replacement"] },
    ],
  },
  {
    slug: "painting",
    name: "Painting",
    serves_label: "Paints homes",
    keywords: ["paint", "painting", "painter", "repaint", "repainted", "cabinets", "stucco", "walls"],
    lead_fee_credits: 12,
    questions: [
      { id: "area", text: "Inside or outside?", options: ["Interior", "Exterior", "Cabinets"] },
      { id: "rooms", text: "How many rooms?", options: ["1", "2-3", "4+"] },
    ],
  },
  {
    slug: "pest-control",
    name: "Pest control",
    serves_label: "Handles pests",
    keywords: ["pest", "scorpion", "scorpions", "roaches", "cockroach", "ants", "termites", "bugs", "rodents", "mice", "bees", "exterminator"],
    lead_fee_credits: 6,
    questions: [
      { id: "pest", text: "Which pest?", options: ["Scorpions", "Ants or roaches", "Termites", "Rodents", "Bees", "Other"] },
      { id: "plan", text: "One-time or recurring?", options: ["One-time", "Recurring"] },
    ],
  },
];

export const CATEGORY_BY_SLUG = new Map(CATEGORIES.map((c) => [c.slug, c]));
