/**
 * Records ZIP centroids once from the keyless public api.zippopotam.us into fixtures/zip-centroids.json.
 * The app never calls the network for ZIPs; it reads the recorded fixture.
 */
import { writeFileSync } from "node:fs";

const ZIPS = [
  "85003", "85004", "85006", "85008", "85012", "85013", "85014", "85015", "85016", "85018",
  "85020", "85021", "85022", "85028", "85032", "85251", "85253", "85254", "85257", "85281",
  "85282", "85283", "85201", "85203", "85210", "85301", "85302",
];

type Place = { "place name": string; latitude: string; longitude: string; "state abbreviation": string };

async function main(): Promise<void> {
  const out: { zip: string; place: string; state: string; lat: number; lng: number }[] = [];
  for (const zip of ZIPS) {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!res.ok) throw new Error(`ZIP ${zip}: HTTP ${res.status}`);
    const body = (await res.json()) as { places: Place[] };
    const p = body.places[0];
    if (!p) throw new Error(`ZIP ${zip}: no place`);
    out.push({ zip, place: p["place name"], state: p["state abbreviation"], lat: Number(p.latitude), lng: Number(p.longitude) });
  }
  const fixture = {
    source: "api.zippopotam.us",
    recorded_at: new Date().toISOString().slice(0, 10),
    note: "Recorded once by scripts/record-zips.ts. Public ZIP centroids, no personal data.",
    zips: out,
  };
  writeFileSync(new URL("../fixtures/zip-centroids.json", import.meta.url), JSON.stringify(fixture, null, 2) + "\n");
  console.log(`recorded ${out.length} ZIP centroids`);
}

main().catch((e) => { console.error(e); process.exit(1); });
