import { and, asc, desc, eq, gte, lte, ne, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { concessionEvents, cronJobs, InsertUser, users, volunteerSlots, volunteers } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  for (const field of textFields) {
    const value = user[field];
    if (value !== undefined) {
      values[field] = value ?? null;
      updateSet[field] = value ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ─── Concession Events ────────────────────────────────────────────────────────

export async function getUpcomingEvents(season?: string) {
  const db = await getDb();
  if (!db) return [];
  // Show all active events - the season dates are fixed (2026 season)
  // and we want volunteers to see the full schedule regardless of current date
  if (season) {
    return db.select().from(concessionEvents).where(and(eq(concessionEvents.isActive, true), eq(concessionEvents.season, season))).orderBy(asc(concessionEvents.eventDate));
  }
  return db.select().from(concessionEvents).where(eq(concessionEvents.isActive, true)).orderBy(asc(concessionEvents.eventDate));
}

export async function getAllEvents(season?: string) {
  const db = await getDb();
  if (!db) return [];
  if (season) {
    return db.select().from(concessionEvents).where(eq(concessionEvents.season, season)).orderBy(asc(concessionEvents.eventDate));
  }
  return db.select().from(concessionEvents).orderBy(asc(concessionEvents.eventDate));
}

export async function getEventById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(concessionEvents).where(eq(concessionEvents.id, id)).limit(1);
  return result[0];
}

export async function createEvent(eventDate: string, season: string, label?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(concessionEvents).values({ eventDate: new Date(eventDate + "T12:00:00Z"), season, label, isActive: true });
  const eventId = (result as any).insertId as number;
  // Create the 5 standard slots
  const slots = [
    { role: "co_cook" as const, count: 1 },
    { role: "kitchen_assistant" as const, count: 1 },
    { role: "runner" as const, count: 1 },
    { role: "cashier" as const, count: 2 },
  ];
  for (const { role, count } of slots) {
    for (let i = 0; i < count; i++) {
      await db.insert(volunteerSlots).values({ eventId, role, slotIndex: i, isOpen: true });
    }
  }
  return eventId;
}

export async function updateEvent(id: number, data: { eventDate?: string; label?: string; isActive?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const updateData: Record<string, unknown> = {};
  if (data.label !== undefined) updateData.label = data.label;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.eventDate !== undefined) updateData.eventDate = new Date(data.eventDate + "T12:00:00Z");
  await db.update(concessionEvents).set(updateData as any).where(eq(concessionEvents.id, id));
}

export async function deleteEvent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(concessionEvents).where(eq(concessionEvents.id, id));
}

// ─── Volunteer Slots ──────────────────────────────────────────────────────────

export async function getSlotsForEvent(eventId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(volunteerSlots).where(eq(volunteerSlots.eventId, eventId)).orderBy(asc(volunteerSlots.role), asc(volunteerSlots.slotIndex));
}

export async function getSlotById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(volunteerSlots).where(eq(volunteerSlots.id, id)).limit(1);
  return result[0];
}

export async function setSlotOpen(slotId: number, isOpen: boolean) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(volunteerSlots).set({ isOpen }).where(eq(volunteerSlots.id, slotId));
}

// ─── Volunteers ───────────────────────────────────────────────────────────────

export async function getVolunteersForEvent(eventId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(volunteers).where(eq(volunteers.eventId, eventId)).orderBy(asc(volunteers.createdAt));
}

export async function getVolunteerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(volunteers).where(eq(volunteers.id, id)).limit(1);
  return result[0];
}

export async function checkDoubleBooking(email: string, eventId: number, excludeVolunteerId?: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const conditions = [
    eq(volunteers.email, email),
    eq(volunteers.eventId, eventId),
    ne(volunteers.status, "canceled"),
  ];
  if (excludeVolunteerId) conditions.push(ne(volunteers.id, excludeVolunteerId));
  const result = await db.select({ id: volunteers.id }).from(volunteers).where(and(...conditions)).limit(1);
  return result.length > 0;
}

export async function createVolunteer(data: {
  slotId: number;
  eventId: number;
  parentName: string;
  email: string;
  phone: string;
  childName: string;
  sport: "football" | "cheer";
  grade: "K-1" | "2nd" | "3rd" | "4th" | "5th";
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(volunteers).values({ ...data, status: "confirmed" });
  const id = (result as any).insertId as number;
  // Mark slot as taken
  await setSlotOpen(data.slotId, false);
  return id;
}

export async function updateVolunteerStatus(
  id: number,
  status: "confirmed" | "checked_in" | "completed" | "no_show" | "canceled"
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const volunteer = await getVolunteerById(id);
  if (!volunteer) throw new Error("Volunteer not found");
  const prevStatus = volunteer.status;
  await db.update(volunteers).set({ status }).where(eq(volunteers.id, id));
  // Auto-reopen slot when canceled
  if (status === "canceled") {
    await setSlotOpen(volunteer.slotId, true);
  }
  // Re-close slot when restoring from canceled back to active
  if (prevStatus === "canceled" && status !== "canceled") {
    await setSlotOpen(volunteer.slotId, false);
  }
}

export async function updateVolunteer(
  id: number,
  data: Partial<{
    parentName: string;
    email: string;
    phone: string;
    childName: string;
    sport: "football" | "cheer";
    grade: "K-1" | "2nd" | "3rd" | "4th" | "5th";
    notes: string;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(volunteers).set(data).where(eq(volunteers.id, id));
}

export async function deleteVolunteer(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const volunteer = await getVolunteerById(id);
  if (!volunteer) throw new Error("Volunteer not found");
  await db.delete(volunteers).where(eq(volunteers.id, id));
  // Reopen slot
  await setSlotOpen(volunteer.slotId, true);
}

export async function getAllVolunteers(filters?: {
  search?: string;
  status?: string;
  eventId?: number;
  season?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  // Build query with joins
  const rows = await db
    .select({
      volunteer: volunteers,
      event: concessionEvents,
      slot: volunteerSlots,
    })
    .from(volunteers)
    .innerJoin(concessionEvents, eq(volunteers.eventId, concessionEvents.id))
    .innerJoin(volunteerSlots, eq(volunteers.slotId, volunteerSlots.id))
    .orderBy(desc(concessionEvents.eventDate), asc(volunteers.parentName));

  let filtered = rows;

  if (filters?.eventId) {
    filtered = filtered.filter((r) => r.volunteer.eventId === filters.eventId);
  }
  if (filters?.season) {
    filtered = filtered.filter((r) => r.event.season === filters.season);
  }
  if (filters?.status) {
    filtered = filtered.filter((r) => r.volunteer.status === filters.status);
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.volunteer.parentName.toLowerCase().includes(q) ||
        r.volunteer.email.toLowerCase().includes(q) ||
        r.volunteer.childName.toLowerCase().includes(q) ||
        r.volunteer.phone.includes(q)
    );
  }

  return filtered;
}

export async function getTodayVolunteers() {
  const db = await getDb();
  if (!db) return [];
  const today = new Date().toISOString().split("T")[0];
  return db
    .select({
      volunteer: volunteers,
      event: concessionEvents,
      slot: volunteerSlots,
    })
    .from(volunteers)
    .innerJoin(concessionEvents, eq(volunteers.eventId, concessionEvents.id))
    .innerJoin(volunteerSlots, eq(volunteers.slotId, volunteerSlots.id))
    .where(sql`${concessionEvents.eventDate} = ${today}`)
    .orderBy(asc(volunteerSlots.role));
}

export async function getVolunteersForReminder() {
  const db = await getDb();
  if (!db) return [];
  const today = new Date().toISOString().split("T")[0];
  return db
    .select({
      volunteer: volunteers,
      event: concessionEvents,
      slot: volunteerSlots,
    })
    .from(volunteers)
    .innerJoin(concessionEvents, eq(volunteers.eventId, concessionEvents.id))
    .innerJoin(volunteerSlots, eq(volunteers.slotId, volunteerSlots.id))
    .where(
      and(
        sql`${concessionEvents.eventDate} = ${today}`,
        eq(volunteers.reminderSent, false),
        ne(volunteers.status, "canceled")
      )
    );
}

export async function markReminderSent(volunteerId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(volunteers).set({ reminderSent: true }).where(eq(volunteers.id, volunteerId));
}

export async function markConfirmationSent(volunteerId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(volunteers).set({ confirmationSent: true }).where(eq(volunteers.id, volunteerId));
}

export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return { totalVolunteers: 0, todayCount: 0, openSlots: 0, upcomingEvents: 0 };
  const today = new Date().toISOString().split("T")[0];

  const [totalResult] = await db.select({ count: sql<number>`COUNT(*)` }).from(volunteers).where(ne(volunteers.status, "canceled"));
  const [todayResult] = await db.select({ count: sql<number>`COUNT(*)` }).from(volunteers).innerJoin(concessionEvents, eq(volunteers.eventId, concessionEvents.id)).where(and(sql`${concessionEvents.eventDate} = ${today}`, ne(volunteers.status, "canceled")));
  // Count open slots and events across the full active season (not just future dates)
  const [openResult] = await db.select({ count: sql<number>`COUNT(*)` }).from(volunteerSlots).innerJoin(concessionEvents, eq(volunteerSlots.eventId, concessionEvents.id)).where(and(eq(volunteerSlots.isOpen, true), eq(concessionEvents.isActive, true)));
  const [upcomingResult] = await db.select({ count: sql<number>`COUNT(*)` }).from(concessionEvents).where(eq(concessionEvents.isActive, true));

  return {
    totalVolunteers: Number(totalResult?.count ?? 0),
    todayCount: Number(todayResult?.count ?? 0),
    openSlots: Number(openResult?.count ?? 0),
    upcomingEvents: Number(upcomingResult?.count ?? 0),
  };
}

// ─── Cron Jobs ────────────────────────────────────────────────────────────────

export async function upsertCronJob(name: string, taskUid: string | null, description?: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(cronJobs).values({ name, taskUid, description }).onDuplicateKeyUpdate({ set: { taskUid, description } });
}

export async function getCronJob(name: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(cronJobs).where(eq(cronJobs.name, name)).limit(1);
  return result[0];
}

export async function listCronJobs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cronJobs).orderBy(asc(cronJobs.name));
}
