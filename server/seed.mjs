/**
 * Seed script: generates all concession event dates and volunteer slots.
 *
 * Schedule: Mondays, Tuesdays, Thursdays from Aug 4 through Nov 5, 2025
 * Exceptions per spec:
 *   - Labor Day week: replace Monday September 7 with Wednesday September 9
 *     (In 2026: Labor Day = Sep 7 Mon; replace with Sep 9 Wed)
 *     Using 2025 dates as written in spec literally.
 *   - Skip entire week of September 21 (Mon Sep 21, Tue Sep 22, Thu Sep 24)
 *
 * NOTE: Sep 9, 2025 is a Tuesday (already in schedule).
 * The spec says "replace Monday Sep 7 with Wednesday Sep 9."
 * We skip Sep 7 (Mon) and since Sep 9 is already a Tue, it stays.
 * No additional Wednesday insertion needed for 2025.
 */

import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const connection = await mysql.createConnection(DATABASE_URL);

function generateDates(startDate, endDate) {
  const dates = [];
  const current = new Date(startDate + "T12:00:00Z");
  const end = new Date(endDate + "T12:00:00Z");

  while (current <= end) {
    const day = current.getUTCDay();
    if (day === 1 || day === 2 || day === 4) {
      dates.push(current.toISOString().split("T")[0]);
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

const START = "2025-08-04";
const END = "2025-11-05";

// Labor Day 2025 = Monday Sep 1. Spec says "replace Monday Sep 7 with Wednesday Sep 9"
// but in 2025 Labor Day is Sep 1. We interpret this as: skip the Labor Day Monday (Sep 1)
// and add the Wednesday of that week (Sep 3) as a replacement.
// Skip week of Sep 21: Mon Sep 22, Tue Sep 23, Thu Sep 25 in 2025.
const SKIP_DATES = new Set([
  "2025-09-01", // Labor Day Monday - replaced by Sep 3 (Wed)
  "2025-09-22", // Skip week of Sep 21: Monday
  "2025-09-23", // Skip week of Sep 21: Tuesday
  "2025-09-25", // Skip week of Sep 21: Thursday
});

// Add Sep 3 (Wed) as Labor Day replacement
const EXTRA_DATES = ["2025-09-03"];

const allDates = [
  ...generateDates(START, END).filter((d) => !SKIP_DATES.has(d)),
  ...EXTRA_DATES,
].sort();

console.log(`Total event dates: ${allDates.length}`);
allDates.forEach((d) => console.log(d));

const ROLE_SLOTS = [
  { role: "co_cook", count: 1 },
  { role: "kitchen_assistant", count: 1 },
  { role: "cashier", count: 2 },
];

// Clear existing seed data
await connection.execute("DELETE FROM volunteers");
await connection.execute("DELETE FROM volunteer_slots");
await connection.execute("DELETE FROM concession_events");

for (const dateStr of allDates) {
  const [eventResult] = await connection.execute(
    "INSERT INTO concession_events (eventDate, season, isActive) VALUES (?, '2025', true)",
    [dateStr]
  );
  const eventId = eventResult.insertId;

  for (const { role, count } of ROLE_SLOTS) {
    for (let i = 0; i < count; i++) {
      await connection.execute(
        "INSERT INTO volunteer_slots (eventId, role, slotIndex, isOpen) VALUES (?, ?, ?, true)",
        [eventId, role, i]
      );
    }
  }
}

console.log("✅ Seed complete!");
await connection.end();
