/** Invented people and businesses for the demo. Any likeness to a real business is a coincidence. */

export type SeedPro = {
  id: string;
  business: string;
  owner: string;
  zip: string;
  radius: number;
  cats: string[];
  verified: boolean;
  reply: number;
  availDays: number;
  years: number;
  reviews: number;
  avg: number;
  credits: number;
  bio: string;
};

const pro = (
  id: string, business: string, owner: string, zip: string, radius: number, cats: string[], verified: boolean,
  reply: number, availDays: number, years: number, reviews: number, avg: number, credits: number, bio: string,
): SeedPro => ({ id, business, owner, zip, radius, cats, verified, reply, availDays, years, reviews, avg, credits, bio });

const WH = "water-heater-repair";
const LK = "leak-repair";
const DR = "drain-cleaning";

export const PROS: SeedPro[] = [
  pro("pro_pipewright", "Pipewright Plumbing", "Diego Ramos", "85018", 15, [WH, LK, DR], true, 25, 1, 12, 41, 4.8, 120,
    "Family plumbing shop. Water heaters, leaks and drains, with upfront prices."),
  pro("pro_bluepeak", "Bluepeak Plumbing", "Hannah Brooks", "85251", 20, [WH, LK], true, 70, 3, 6, 18, 4.6, 160,
    "Water heater installs and repairs across the east side."),
  pro("pro_desertflow", "Desert Flow Plumbing", "Marco Silva", "85014", 12, [WH, LK, DR], true, 35, 1, 9, 27, 4.7, 140,
    "Licensed plumbers for repairs, repipes and water heaters."),
  pro("pro_steadytap", "Steady Tap Plumbing", "Grace Holloway", "85020", 12, [WH, LK], true, 30, 2, 7, 22, 4.7, 130,
    "Small crew, fast replies, tidy work."),
  pro("pro_freshstart", "Fresh Start Plumbing", "Kenji Mori", "85016", 15, [WH, LK], false, 40, 1, 1, 1, 5.0, 90,
    "New on the platform. Plumbing repairs and water heater swaps."),
  pro("pro_quickdrain", "Quickdrain Rooter", "Tasha Greene", "85008", 12, [DR, LK], false, 90, 2, 4, 14, 4.3, 80,
    "Drain and sewer line cleaning, cameras on every job."),
  pro("pro_farwest", "Far West Plumbing", "Ray Dalton", "85301", 6, [WH, LK, DR], true, 30, 1, 15, 35, 4.6, 150,
    "West side plumbing, close to home."),
  pro("pro_eastvalley", "East Valley Water Works", "Nadia Haddad", "85203", 15, [WH, LK, DR], true, 50, 2, 10, 30, 4.5, 110,
    "Water heaters, softeners and leak repair."),
  pro("pro_tanktech", "TankTech Water Heaters", "Will Ferris", "85281", 15, [WH], true, 60, 3, 8, 24, 4.6, 100,
    "Only water heaters: tank, tankless and repairs."),
  pro("pro_brightline", "Brightline Electric", "Carmen Vega", "85012", 15, ["electrical"], true, 45, 2, 11, 33, 4.7, 140,
    "Residential electricians for repairs, panels and EV chargers."),
  pro("pro_voltwise", "Voltwise Electric", "Patrick Doyle", "85254", 15, ["electrical"], true, 60, 3, 5, 19, 4.6, 120,
    "Lighting, outlets and panel upgrades."),
  pro("pro_currentcraft", "Current Craft Electrical", "Imani Wright", "85282", 15, ["electrical"], false, 120, 4, 3, 8, 4.4, 70,
    "Electrical repairs and new installs."),
  pro("pro_lodestar", "Lodestar Electric", "Felix Bauer", "85022", 15, ["electrical"], true, 35, 2, 14, 46, 4.8, 160,
    "Troubleshooting specialists, same-week visits."),
  pro("pro_coolcurrent", "Cool Current Air", "Samir Patel", "85015", 18, ["ac-repair"], true, 30, 1, 9, 52, 4.7, 180,
    "AC repair and tune-ups, summer emergencies."),
  pro("pro_northwind", "Northwind Cooling", "Erin Walsh", "85257", 18, ["ac-repair"], true, 45, 1, 6, 29, 4.6, 140,
    "Central air, heat pumps and mini splits."),
  pro("pro_summitair", "Summit Air Comfort", "Hector Ruiz", "85283", 18, ["ac-repair"], true, 75, 2, 12, 38, 4.5, 120,
    "Heating and cooling service since day one of the valley heat."),
  pro("pro_dryheat", "Dry Heat HVAC", "Lena Fischer", "85302", 15, ["ac-repair"], false, 100, 3, 2, 6, 4.3, 60,
    "AC repair on the west side."),
  pro("pro_sunfish", "Sunfish Pool Care", "Mateo Cruz", "85254", 15, ["pool-care"], true, 40, 2, 7, 31, 4.7, 100,
    "Weekly pool service and equipment repair."),
  pro("pro_tidepool", "Tidepool Service Co", "Ava Lindgren", "85283", 18, ["pool-care"], true, 55, 2, 5, 21, 4.6, 90,
    "Green-to-clean and weekly care."),
  pro("pro_clearline", "Clearline Pools", "Jamal Price", "85021", 15, ["pool-care"], false, 90, 3, 3, 11, 4.4, 70,
    "Pumps, filters and one-time cleans."),
  pro("pro_fixwell", "Fixwell Handyman", "Omar Aziz", "85013", 15, ["handyman"], true, 35, 1, 8, 44, 4.8, 90,
    "Mounting, small repairs and honey-do lists."),
  pro("pro_toolbelt", "Toolbelt Home Services", "Ruth Klein", "85281", 15, ["handyman", "painting"], true, 50, 2, 6, 26, 4.6, 110,
    "Handyman work and interior painting."),
  pro("pro_oddjobs", "Odd Jobs Workshop", "Caleb Ward", "85028", 12, ["handyman"], false, 80, 2, 2, 7, 4.5, 60,
    "Furniture assembly, patching and fixes."),
  pro("pro_spruce", "Spruce & Shine Cleaning", "Lucia Romero", "85006", 15, ["house-cleaning"], true, 30, 1, 5, 58, 4.8, 90,
    "Standard, deep and move-out cleans."),
  pro("pro_tidynest", "Tidy Nest Cleaning", "Ivy Chen", "85253", 15, ["house-cleaning"], true, 45, 2, 4, 34, 4.7, 90,
    "Eco products, the same cleaner every visit."),
  pro("pro_yardsmith", "Yardsmith Landscaping", "Bruno Costa", "85032", 15, ["landscaping"], true, 60, 2, 10, 37, 4.6, 100,
    "Desert landscaping, irrigation and trimming."),
  pro("pro_evergreen", "Evergreen Edge Yard Care", "Dana Whitfield", "85210", 18, ["landscaping"], false, 90, 3, 4, 12, 4.4, 70,
    "Mowing, cleanups and drip systems."),
  pro("pro_ridgeline", "Ridgeline Roofing", "Victor Hale", "85020", 20, ["roofing"], true, 90, 3, 16, 40, 4.6, 200,
    "Tile, shingle and foam roofs. Storm repairs."),
  pro("pro_topcoat", "Topcoat Roofing", "Mina Saeed", "85201", 20, ["roofing"], true, 120, 4, 9, 23, 4.5, 160,
    "Roof repair and coatings."),
  pro("pro_truehue", "True Hue Painters", "Elliot Park", "85004", 15, ["painting"], true, 60, 3, 7, 29, 4.7, 110,
    "Interior and exterior painting with clean lines."),
  pro("pro_brushstroke", "Brushstroke Painting Co", "Sofia Marin", "85251", 15, ["painting"], false, 90, 4, 3, 9, 4.5, 70,
    "Cabinets and accent walls."),
  pro("pro_shieldline", "Shieldline Pest Control", "Grant Ellis", "85022", 18, ["pest-control"], true, 40, 1, 8, 47, 4.7, 90,
    "Scorpion and general pest treatments."),
  pro("pro_buzzoff", "Buzzoff Pest Control", "Tara Quinn", "85282", 18, ["pest-control"], true, 60, 2, 5, 20, 4.5, 80,
    "Bees, termites and recurring plans."),
];

/** Sponsored placements. Only verified pros that pass the relevance floor can be shown as Sponsored. */
export const PROMOTIONS: { pro: string; cat: string; status: "active" | "paused" }[] = [
  { pro: "pro_bluepeak", cat: WH, status: "active" },
  { pro: "pro_voltwise", cat: "electrical", status: "active" },
  { pro: "pro_tidynest", cat: "house-cleaning", status: "active" },
  { pro: "pro_summitair", cat: "ac-repair", status: "paused" },
  { pro: "pro_dryheat", cat: "ac-repair", status: "active" },
];

export type SeedClient = { id: string; first: string; last: string; zip: string };

export const CLIENTS: SeedClient[] = [
  { id: "client_maya", first: "Maya", last: "Ortiz", zip: "85016" },
  { id: "client_jordan", first: "Jordan", last: "Avery", zip: "85018" },
  { id: "client_priya", first: "Priya", last: "Natarajan", zip: "85251" },
  { id: "client_marcus", first: "Marcus", last: "Bell", zip: "85281" },
  { id: "client_elena", first: "Elena", last: "Petrova", zip: "85012" },
  { id: "client_tom", first: "Tom", last: "Whitaker", zip: "85020" },
  { id: "client_aisha", first: "Aisha", last: "Rahman", zip: "85254" },
  { id: "client_ben", first: "Ben", last: "Carter", zip: "85003" },
  { id: "client_grace", first: "Grace", last: "Kim", zip: "85283" },
  { id: "client_luis", first: "Luis", last: "Herrera", zip: "85301" },
  { id: "client_nora", first: "Nora", last: "Fitzgerald", zip: "85032" },
  { id: "client_sam", first: "Sam", last: "Okafor", zip: "85014" },
  { id: "client_hana", first: "Hana", last: "Sato", zip: "85257" },
  { id: "client_owen", first: "Owen", last: "Murphy", zip: "85028" },
  { id: "client_rosa", first: "Rosa", last: "Delgado", zip: "85006" },
  { id: "client_ethan", first: "Ethan", last: "Caldwell", zip: "85021" },
  { id: "client_leah", first: "Leah", last: "Goldberg", zip: "85015" },
  { id: "client_victor", first: "Victor", last: "Nguyen", zip: "85253" },
  { id: "client_chloe", first: "Chloe", last: "Martin", zip: "85210" },
  { id: "client_isaac", first: "Isaac", last: "Moreno", zip: "85022" },
];

export const ADMIN = { id: "admin_ops", first: "Riley", last: "Chen", zip: "85004" };

export const HERO = { client: "client_maya", pro: "pro_pipewright", otherPro: "pro_brightline" } as const;
