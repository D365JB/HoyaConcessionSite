import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL not set"); process.exit(1); }

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
// Skip Labor Day Mon Sep 1 and week of Sep 21 (Mon Sep 22, Tue Sep 23, Thu Sep 25)
const SKIP = new Set(["2025-09-01","2025-09-22","2025-09-23","2025-09-25"]);
// Add Wed Sep 3 as Labor Day replacement
const EXTRA = ["2025-09-03"];
const allDates = [...generateDates(START, END).filter((d) => !SKIP.has(d)), ...EXTRA].sort();
console.log("Total events: " + allDates.length);
allDates.forEach((d) => console.log(d));

const SLOTS = [
  {role:"co_cook",count:1},
  {role:"kitchen_assistant",count:1},
  {role:"runner",count:1},
  {role:"cashier",count:2}
];

await connection.execute("DELETE FROM volunteers");
await connection.execute("DELETE FROM volunteer_slots");
await connection.execute("DELETE FROM concession_events");

for (const dateStr of allDates) {
  const [res] = await connection.execute(
    "INSERT INTO concession_events (eventDate, season, isActive) VALUES (?, '2025', 1)",
    [dateStr]
  );
  const eventId = res.insertId;
  for (const { role, count } of SLOTS) {
    for (let i = 0; i < count; i++) {
      await connection.execute(
        "INSERT INTO volunteer_slots (eventId, role, slotIndex, isOpen) VALUES (?, ?, ?, 1)",
        [eventId, role, i]
      );
    }
  }
}
console.log("Seed complete!");
await connection.end();
