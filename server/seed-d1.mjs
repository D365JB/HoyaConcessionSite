// Generates cloudflare/seed.sql for the D1 database: a 2026 fall season of
// Mon/Tue/Thu game nights, each with the 4 standard volunteer slots.
// Apply with: wrangler d1 execute hoyas-concession-db --remote --file=cloudflare/seed.sql
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function generateDates(startDate, endDate) {
  const dates = [];
  const current = new Date(startDate + "T12:00:00Z");
  const end = new Date(endDate + "T12:00:00Z");
  while (current <= end) {
    const day = current.getUTCDay();
    if (day === 1 || day === 2 || day === 4) dates.push(current.toISOString().split("T")[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

const START = "2026-08-31";
const END = "2026-11-05";
const SKIP = new Set(["2026-09-07"]); // Labor Day 2026
const SEASON = "2026";
const LOCATION = "Hoya Field Concession Stand";
const SLOTS = [
  { role: "co_cook", count: 1 },
  { role: "kitchen_assistant", count: 1 },
  { role: "cashier", count: 2 },
];

const dates = generateDates(START, END).filter((d) => !SKIP.has(d)).sort();

let sql = "DELETE FROM volunteers;\nDELETE FROM volunteer_slots;\nDELETE FROM concession_events;\n";
for (const d of dates) {
  sql += `INSERT INTO concession_events (eventDate, season, location, isActive) VALUES ('${d}', '${SEASON}', '${LOCATION}', 1);\n`;
  for (const { role, count } of SLOTS) {
    for (let i = 0; i < count; i++) {
      // Look up the event id by its (unique) date so we don't depend on predicted ids.
      sql += `INSERT INTO volunteer_slots (eventId, role, slotIndex, isOpen) SELECT id, '${role}', ${i}, 1 FROM concession_events WHERE eventDate = '${d}';\n`;
    }
  }
}

writeFileSync(join(__dirname, "../cloudflare/seed.sql"), sql);
console.log(`Wrote ${dates.length} events (${dates[0]} .. ${dates[dates.length - 1]}) to cloudflare/seed.sql`);
