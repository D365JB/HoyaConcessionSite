/**
 * Hoyas Concession 2025 Season Seed (corrected)
 * Mon/Tue/Thu, Aug 4 - Nov 5, 2025
 * - Skip Sep 8 (Mon) per "skip Sep 7" instruction (Sep 7 is a Sunday)
 * - Keep Sep 9 (Tue) as instructed
 * - Skip Sep 22 (Mon), Sep 23 (Tue), Sep 25 (Thu) — no practice Sep 21-25
 * - End by Nov 5 (Wed); last valid events are Mon Nov 3 and Tue Nov 4
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const DATES = [
  "2025-08-04","2025-08-05","2025-08-07",
  "2025-08-11","2025-08-12","2025-08-14",
  "2025-08-18","2025-08-19","2025-08-21",
  "2025-08-25","2025-08-26","2025-08-28",
  "2025-09-01","2025-09-02","2025-09-04",
  "2025-09-09","2025-09-11",
  "2025-09-15","2025-09-16","2025-09-18",
  "2025-09-29","2025-09-30",
  "2025-10-02","2025-10-06","2025-10-07","2025-10-09",
  "2025-10-13","2025-10-14","2025-10-16",
  "2025-10-20","2025-10-21","2025-10-23",
  "2025-10-27","2025-10-28","2025-10-30",
  "2025-11-03","2025-11-04",
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
      "INSERT INTO concession_events (eventDate, season, isActive) VALUES (?, '2025', 1)",
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
