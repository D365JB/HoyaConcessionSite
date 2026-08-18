import { and, asc, desc, eq, gte, lte, ne, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { appSettings, concessionEvents, cronJobs, InsertUser, localAdminAccounts, seasons, users, volunteerSlots, volunteers } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let d1Binding: any = null;

/** Configure the Cloudflare D1 database binding for the Worker runtime. */
export function configureD1(binding: unknown) {
  d1Binding = binding;
  _db = null;
}

export async function getDb() {
  if (!d1Binding) return null;
  if (!_db) _db = drizzle(d1Binding);
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

  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

/** Returns accounts that have signed in through Manus OAuth and can be granted admin access. */
export async function listUsersForAdmin() {
  const db = await getDb();
  if (!db) return [];
  const accounts = await db
    .select({
      id: users.id,
      openId: users.openId,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .orderBy(asc(users.name), asc(users.email));
  return accounts.map((account) => ({
    ...account,
    isOwner: account.openId === ENV.ownerOpenId,
  }));
}

/**
 * Grants or revokes role access. The project owner's account is protected so
 * it cannot be demoted through the dashboard.
 */
export async function updateUserRoleById(userId: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) throw new Error("User not found");
  if (target.openId === ENV.ownerOpenId && role !== "admin") {
    throw new Error("The project owner's administrator access cannot be removed");
  }

  await db.update(users).set({ role }).where(eq(users.id, userId));
  return { id: target.id, role };
}

// ─── Local Password Admin Accounts ────────────────────────────────────────────

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function getLocalAdminAccountByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [result] = await db
    .select({ account: localAdminAccounts, user: users })
    .from(localAdminAccounts)
    .innerJoin(users, eq(localAdminAccounts.userId, users.id))
    .where(eq(localAdminAccounts.email, normalizeEmail(email)))
    .limit(1);
  return result;
}

export async function getLocalAdminUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [result] = await db
    .select({ user: users })
    .from(localAdminAccounts)
    .innerJoin(users, eq(localAdminAccounts.userId, users.id))
    .where(and(eq(localAdminAccounts.userId, userId), eq(localAdminAccounts.isActive, true)))
    .limit(1);
  return result?.user;
}

export async function countActiveLocalAdminAccounts() {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(localAdminAccounts)
    .where(eq(localAdminAccounts.isActive, true));
  return Number(result?.count ?? 0);
}

export async function listLocalAdminAccounts() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: localAdminAccounts.id,
      userId: users.id,
      name: users.name,
      email: localAdminAccounts.email,
      role: users.role,
      isActive: localAdminAccounts.isActive,
      createdAt: localAdminAccounts.createdAt,
      lastSignedIn: users.lastSignedIn,
    })
    .from(localAdminAccounts)
    .innerJoin(users, eq(localAdminAccounts.userId, users.id))
    .orderBy(asc(users.name), asc(localAdminAccounts.email));
}

/** Emails of every active administrator, used to notify all admins of new signups. */
export async function getActiveAdminEmails(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ email: localAdminAccounts.email })
    .from(localAdminAccounts)
    .where(eq(localAdminAccounts.isActive, true));
  return rows.map((r) => r.email).filter((e): e is string => !!e && e.includes("@"));
}

export async function createLocalAdminAccount(input: { name: string; email: string; passwordHash: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const email = normalizeEmail(input.email);
  const existingAccount = await getLocalAdminAccountByEmail(email);
  if (existingAccount) throw new Error("An administrator account already uses this email address");

  const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  let userId: number;

  if (existingUser) {
    userId = existingUser.id;
    await db.update(users).set({ name: input.name, role: "admin", loginMethod: "password" }).where(eq(users.id, userId));
  } else {
    const [insertResult] = await db.insert(users).values({
      openId: `local:${crypto.randomUUID()}`,
      name: input.name,
      email,
      loginMethod: "password",
      role: "admin",
      lastSignedIn: new Date(),
    }).returning({ id: users.id });
    userId = insertResult.id;
  }

  const [accountResult] = await db.insert(localAdminAccounts).values({ userId, email, passwordHash: input.passwordHash, isActive: true }).returning({ id: localAdminAccounts.id });
  return { id: accountResult.id, userId, email };
}

export async function updateLocalAdminPassword(accountId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(localAdminAccounts).set({ passwordHash }).where(eq(localAdminAccounts.id, accountId));
}

export async function deactivateLocalAdminAccount(accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [account] = await db.select().from(localAdminAccounts).where(eq(localAdminAccounts.id, accountId)).limit(1);
  if (!account) throw new Error("Administrator account not found");
  if (!account.isActive) return;
  if (await countActiveLocalAdminAccounts() <= 1) throw new Error("At least one active administrator account is required");
  await db.update(localAdminAccounts).set({ isActive: false }).where(eq(localAdminAccounts.id, accountId));
  await db.update(users).set({ role: "user" }).where(eq(users.id, account.userId));
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

// ─── Seasons ──────────────────────────────────────────────

export async function listSeasons() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(seasons).orderBy(desc(seasons.name));
}

export async function getCurrentSeason(): Promise<string> {
  const db = await getDb();
  if (!db) return "2026";
  const [current] = await db.select().from(seasons).where(eq(seasons.isCurrent, true)).limit(1);
  if (current) return current.name;
  const [latest] = await db.select().from(seasons).orderBy(desc(seasons.name)).limit(1);
  return latest?.name ?? "2026";
}

export async function createSeason(name: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Season name is required");
  const existing = await db.select({ id: seasons.id }).from(seasons).where(eq(seasons.name, trimmed)).limit(1);
  if (existing.length) throw new Error("That season already exists");
  const hasAny = (await db.select({ id: seasons.id }).from(seasons).limit(1)).length > 0;
  const [result] = await db.insert(seasons).values({ name: trimmed, isCurrent: !hasAny }).returning({ id: seasons.id });
  return { id: result.id, name: trimmed };
}

export async function setCurrentSeason(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(seasons).set({ isCurrent: false });
  await db.update(seasons).set({ isCurrent: true }).where(eq(seasons.id, id));
}

// ─── App settings (key/value) ──────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(appSettings).values({ key, value }).onConflictDoUpdate({ target: appSettings.key, set: { value } });
}

/** Admin per-signup notifications are on unless explicitly turned off. */
export async function isAdminNotificationsEnabled(): Promise<boolean> {
  return (await getSetting("adminSignupNotifications")) !== "off";
}

/** Volunteer check-in / no-show emails are on unless explicitly turned off. */
export async function isVolunteerStatusEmailsEnabled(): Promise<boolean> {
  return (await getSetting("volunteerStatusEmails")) !== "off";
}

export const STANDARD_SLOT_DEFINITIONS = [
  { role: "co_cook" as const, count: 1 },
  { role: "kitchen_assistant" as const, count: 1 },
  { role: "cashier" as const, count: 2 },
] as const;

export type SlotRole = "co_cook" | "kitchen_assistant" | "cashier";
export type SlotConfig = { role: SlotRole; count: number; startTime?: string; endTime?: string };

// Practice runs the same every night: fixed roles, counts, and shift times.
export const PRACTICE_SLOT_CONFIG: SlotConfig[] = [
  { role: "co_cook", count: 1, startTime: "17:45", endTime: "20:15" },
  { role: "kitchen_assistant", count: 1, startTime: "17:45", endTime: "20:15" },
  { role: "cashier", count: 2, startTime: "18:15", endTime: "20:45" },
];

// Game days vary by number of games; this is only a starting default to edit.
export const GAME_DAY_SLOT_CONFIG: SlotConfig[] = [
  { role: "co_cook", count: 2, startTime: "16:30", endTime: "20:30" },
  { role: "kitchen_assistant", count: 2, startTime: "16:30", endTime: "20:30" },
  { role: "cashier", count: 3, startTime: "17:00", endTime: "21:00" },
];

export async function createEvent(params: {
  eventDate: string;
  season: string;
  label?: string;
  location?: string;
  eventType?: "practice" | "game_day";
  slotConfig?: SlotConfig[];
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const eventType = params.eventType ?? "practice";
  const config = params.slotConfig && params.slotConfig.length
    ? params.slotConfig
    : eventType === "game_day" ? GAME_DAY_SLOT_CONFIG : PRACTICE_SLOT_CONFIG;
  const [result] = await db
    .insert(concessionEvents)
    .values({ eventDate: params.eventDate, season: params.season, label: params.label, location: params.location, eventType, isActive: true })
    .returning({ id: concessionEvents.id });
  const eventId = result.id;
  // Unique slotIndex per role so multiple time blocks of one role don't collide.
  const roleCounters: Record<string, number> = {};
  for (const rc of config) {
    for (let i = 0; i < rc.count; i++) {
      const slotIndex = roleCounters[rc.role] ?? 0;
      roleCounters[rc.role] = slotIndex + 1;
      await db.insert(volunteerSlots).values({ eventId, role: rc.role, slotIndex, isOpen: true, startTime: rc.startTime ?? null, endTime: rc.endTime ?? null });
    }
  }
  return eventId;
}

export async function updateEvent(id: number, data: { eventDate?: string; label?: string; location?: string; eventType?: "practice" | "game_day"; isActive?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const updateData: Record<string, unknown> = {};
  if (data.label !== undefined) updateData.label = data.label;
  if (data.location !== undefined) updateData.location = data.location;
  if (data.eventType !== undefined) updateData.eventType = data.eventType;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.eventDate !== undefined) updateData.eventDate = data.eventDate;
  await db.update(concessionEvents).set(updateData as any).where(eq(concessionEvents.id, id));
}

export async function deleteEvent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // D1/SQLite may not enforce FK cascades, so remove children explicitly.
  await db.delete(volunteers).where(eq(volunteers.eventId, id));
  await db.delete(volunteerSlots).where(eq(volunteerSlots.eventId, id));
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
  const [result] = await db.insert(volunteers).values({ ...data, status: "confirmed" }).returning({ id: volunteers.id });
  const id = result.id;
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
  await db.insert(cronJobs).values({ name, taskUid, description }).onConflictDoUpdate({ target: cronJobs.name, set: { taskUid, description } });
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
