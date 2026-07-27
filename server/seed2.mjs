/**
 * Hoyas Concession 2026 Season Seed
 * Mon/Tue/Thu, Aug 3 - Nov 5, 2026
 * - Skip Sep 7 (Monday in 2026)
 * - Add Sep 9 (Wednesday in 2026 — special extra date)
 * - Skip Sep 21 (Mon), Sep 22 (Tue), Sep 24 (Thu) — no practice Sep 21-25
 * - Nov 5 is a Thursday in 2026 — included as final event
 * Total: 39 events
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const DATES = [
  // August 2026
  "2026-08-03","2026-08-04","2026-08-06",
  "2026-08-10","2026-08-11","2026-08-13",
  "2026-08-17","2026-08-18","2026-08-20",
  "2026-08-24","2026-08-25","2026-08-27",
  "2026-08-31",
  // September 2026 (Sep 7 Mon skipped; Sep 9 is Wed — NOT included; Tue Sep 8 + Thu Sep 10 kept)
  "2026-09-01","2026-09-03",
  "2026-09-08","2026-09-10",
  "2026-09-14","2026-09-15","2026-09-17",
  // Sep 21, 22, 24 skipped
  "2026-09-28","2026-09-29",
  // October 2026
  "2026-10-01","2026-10-05","2026-10-06","2026-10-08",
  "2026-10-12","2026-10-13","2026-10-15",
  "2026-10-19","2026-10-20","2026-10-22",
  "2026-10-26","2026-10-27","2026-10-29",
  // November 2026 (through Nov 5 inclusive)
  "2026-11-02","2026-11-03","2026-11-05",
];

const SLOTS = [
  { role: "co_cook",           slotIndex: 1 },
  { role: "kitchen_assistant", slotIndex: 1 },
  { role: "runner",            slotIndex: 1 },
  { role: "cashier",           slotIndex: 1 },
  { role: "cashier",           slotIndex: 2 },
];

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  let eventCount = 0;
  let slotCount = 0;

  for (const d of DATES) {
    const [result] = await conn.execute(
      "INSERT INTO concession_events (eventDate, season, isActive) VALUES (?, '2026', 1)",
      [d]
    );
    const eventId = result.insertId;
    eventCount++;
    for (const slot of SLOTS) {
      await conn.execute(
        "INSERT INTO volunteer_slots (eventId, role, slotIndex, isOpen) VALUES (?, ?, ?, 1)",
        [eventId, slot.role, slot.slotIndex]
      );
      slotCount++;
    }
  }

  await conn.end();
  console.log(`Seeded ${eventCount} events and ${slotCount} slots.`);
}

main().catch(e => { console.error(e); process.exit(1); });
