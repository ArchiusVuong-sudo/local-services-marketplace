/** Text templates for the synthetic history. All invented. */

export const CATEGORY_WEIGHTS: readonly (readonly [string, number])[] = [
  ["ac-repair", 18],
  ["water-heater-repair", 10],
  ["leak-repair", 10],
  ["drain-cleaning", 9],
  ["pool-care", 10],
  ["electrical", 9],
  ["handyman", 9],
  ["house-cleaning", 9],
  ["landscaping", 7],
  ["roofing", 4],
  ["painting", 5],
  ["pest-control", 8],
];

export const BASE_PRICE_USD: Record<string, number> = {
  "water-heater-repair": 420,
  "leak-repair": 260,
  "drain-cleaning": 190,
  "ac-repair": 380,
  "pool-care": 160,
  electrical: 290,
  handyman: 220,
  "house-cleaning": 240,
  landscaping: 330,
  roofing: 850,
  painting: 1100,
  "pest-control": 130,
};

export const JOB_TEXT: Record<string, { title: string; note: string }[]> = {
  "water-heater-repair": [
    { title: "Water heater not heating", note: "No hot water since yesterday, the pilot keeps going out." },
    { title: "Leaking water heater tank", note: "Water pooling under the water heater in the closet." },
    { title: "Tankless heater error code", note: "Tankless unit shows an error and shuts off mid-shower." },
  ],
  "leak-repair": [
    { title: "Leak under the kitchen sink", note: "Slow drip under the kitchen sink, cabinet floor is wet." },
    { title: "Running toilet and leak", note: "Toilet runs all night and leaks at the base." },
    { title: "Water stain on ceiling", note: "New water stain on the ceiling below the upstairs bathroom." },
  ],
  "drain-cleaning": [
    { title: "Clogged kitchen drain", note: "Kitchen sink drains very slowly, plunger did not help." },
    { title: "Shower drain backed up", note: "Shower backs up after a few minutes." },
    { title: "Main line backup", note: "Toilets gurgle and the tub backs up when the washer runs." },
  ],
  "ac-repair": [
    { title: "AC blowing warm air", note: "AC runs but blows warm air, thermostat set to 76." },
    { title: "AC won't turn on", note: "Outdoor unit is silent and the house is heating up." },
    { title: "AC leaking water inside", note: "Water dripping from the air handler in the hallway closet." },
  ],
  "pool-care": [
    { title: "Weekly pool service", note: "Looking for weekly pool service, medium pool with a spa." },
    { title: "Green pool cleanup", note: "Pool turned green after a week away." },
    { title: "Pool pump making noise", note: "Pool pump is loud and the pressure is low." },
  ],
  electrical: [
    { title: "Breaker keeps tripping", note: "Kitchen breaker trips when the microwave and toaster run." },
    { title: "Install ceiling fans", note: "Need two ceiling fans installed where lights are now." },
    { title: "EV charger install", note: "Want a level 2 EV charger in the garage." },
  ],
  handyman: [
    { title: "Mount TV and shelves", note: "Mount a 65 inch TV and hang three floating shelves." },
    { title: "Drywall patch and paint", note: "Two fist-size holes in drywall to patch and paint." },
    { title: "Small repair list", note: "Sticking door, loose cabinet hinge and a wobbly railing." },
  ],
  "house-cleaning": [
    { title: "Deep clean before guests", note: "Deep clean of a 3 bedroom house before family visits." },
    { title: "Move-out cleaning", note: "Move-out clean for a 2 bedroom apartment." },
    { title: "Every other week cleaning", note: "Standard clean every other week, 4 bedrooms." },
  ],
  landscaping: [
    { title: "Fix broken sprinkler line", note: "Sprinkler line broke and part of the yard is flooding." },
    { title: "Yard cleanup and trimming", note: "Trim hedges and two trees, clear weeds from the gravel." },
    { title: "Monthly yard maintenance", note: "Looking for monthly yard care for a medium front yard." },
  ],
  roofing: [
    { title: "Roof leak after storm", note: "Monsoon storm left a leak over the living room." },
    { title: "Cracked roof tiles", note: "Several cracked roof tiles near the chimney." },
    { title: "Roof inspection", note: "Need a roof inspection before selling the house." },
  ],
  painting: [
    { title: "Paint two bedrooms", note: "Repaint two bedrooms, walls only, light colors." },
    { title: "Exterior stucco paint", note: "Exterior repaint of a single-story stucco house." },
    { title: "Kitchen cabinet painting", note: "Paint kitchen cabinets white, about 20 doors." },
  ],
  "pest-control": [
    { title: "Scorpion treatment", note: "Seeing scorpions in the garage at night." },
    { title: "Ant problem in kitchen", note: "Ants coming in along the kitchen window." },
    { title: "Recurring pest plan", note: "Want a quarterly pest plan for a new house." },
  ],
};

export const QUOTE_MESSAGES = [
  "Happy to help. I can come out at the time below and give you a firm price on site.",
  "We do this kind of job every week. Price covers parts and labor.",
  "I'll bring everything needed. If anything changes on site I'll tell you before starting.",
  "Thanks for the details. This price includes cleanup and a 90-day warranty on labor.",
  "I can do this. Text me at {phone} if you want to send photos first.",
  "Available at the time below. Call {phone} with any questions.",
];

export const DONE_NOTES = [
  "All done, tested and cleaned up.",
  "Finished. Left the old parts by the bin as asked.",
  "Job complete. Warranty details are in your email.",
  "Done and working. Thanks for having us.",
];

export const REVIEW_TEXT: Record<number, string[]> = {
  5: ["On time, fair price and very clean work.", "Explained everything and fixed it fast.", "Great communication from start to finish.", "Would hire again without a second thought."],
  4: ["Good work, arrived a bit late.", "Solid job, price was a little higher than hoped.", "Fixed the problem, friendly crew."],
  3: ["Got it done, but scheduling took a while.", "Okay job, had to call back once."],
  2: ["Slow to reply and the visit ran long."],
  1: ["Did not fix the problem the first time."],
};

export const REVIEW_AUTHORS = ["Alex P.", "Brianna S.", "Chris D.", "Dana L.", "Eli R.", "Fatima K.", "Gabe M.", "Holly T.", "Ian W.", "Jade N.", "Kyle B.", "Lena V.", "Mo A.", "Nina F.", "Oscar H.", "Paula G."];
