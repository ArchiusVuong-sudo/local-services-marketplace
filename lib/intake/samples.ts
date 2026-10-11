/** 12 synthetic intake notes with the fields a correct reading must get. Used by the tests and the eval. */
export type SampleNote = { note: string; category: string; zip: string | null; budget: number | null; timing: string | null };

export const HERO_NOTE = "Water heater leaking in the garage, 85016. Need it fixed this week, budget about $450";

export const SAMPLE_NOTES: SampleNote[] = [
  { note: HERO_NOTE, category: "water-heater-repair", zip: "85016", budget: 450, timing: "this_week" },
  { note: "Our AC is blowing warm air and it's 108 outside. 85251, need someone today if possible. Up to $600.", category: "ac-repair", zip: "85251", budget: 600, timing: "asap" },
  { note: "Kitchen sink is clogged again and backing up into the other side. ZIP 85281. Around $200.", category: "drain-cleaning", zip: "85281", budget: 200, timing: null },
  { note: "Looking for weekly pool cleaning, the water is turning green. We're in 85254, budget $150 a month.", category: "pool-care", zip: "85254", budget: 150, timing: "flexible" },
  { note: "Breaker keeps tripping when the microwave runs, and one outlet is warm. 85012, budget $300, this week.", category: "electrical", zip: "85012", budget: 300, timing: "this_week" },
  { note: "Need a handyman to mount a TV, hang shelves and fix a sticking door. 85003. About $250, no rush.", category: "handyman", zip: "85003", budget: 250, timing: "flexible" },
  { note: "Move-out deep clean for a 3 bedroom house in 85283 by next Friday, budget $350.", category: "house-cleaning", zip: "85283", budget: 350, timing: "next_two_weeks" },
  { note: "Sprinkler line broke and the front yard is flooding, also need the hedges trimmed. 85020, $400.", category: "landscaping", zip: "85020", budget: 400, timing: null },
  { note: "Monsoon storm cracked some roof tiles and now there's a stain on the ceiling. 85018. Budget around $800.", category: "roofing", zip: "85018", budget: 800, timing: null },
  { note: "Want the living room and two bedrooms repainted, walls only. 85014, thinking around twelve hundred dollars.", category: "painting", zip: "85014", budget: 1200, timing: null },
  { note: "Seeing scorpions in the garage and the kids' room, want a recurring treatment. 85032, budget $120.", category: "pest-control", zip: "85032", budget: 120, timing: "flexible" },
  { note: "Toilet base is leaking onto the bathroom floor. 85015. Can pay $180.", category: "leak-repair", zip: "85015", budget: 180, timing: null },
];
