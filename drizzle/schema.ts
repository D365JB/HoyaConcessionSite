import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Core user table backing auth flow.
 */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`).$onUpdate(() => new Date()),
  lastSignedIn: integer("lastSignedIn", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Local credentials for password-based administrator login. Passwords are never
 * stored directly: this table holds a salted password hash only.
 */
export const localAdminAccounts = sqliteTable("local_admin_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("passwordHash").notNull(),
  isActive: integer("isActive", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`).$onUpdate(() => new Date()),
});

export type LocalAdminAccount = typeof localAdminAccounts.$inferSelect;
export type InsertLocalAdminAccount = typeof localAdminAccounts.$inferInsert;

/**
 * Concession event dates (each game night)
 */
export const concessionEvents = sqliteTable("concession_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventDate: text("eventDate").notNull(),
  label: text("label"),
  eventType: text("eventType", { enum: ["practice", "game_day"] }).notNull().default("practice"),
  location: text("location"),
  isActive: integer("isActive", { mode: "boolean" }).notNull().default(true),
  season: text("season").notNull().default("2025"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`).$onUpdate(() => new Date()),
});

export type ConcessionEvent = typeof concessionEvents.$inferSelect;
export type InsertConcessionEvent = typeof concessionEvents.$inferInsert;

/**
 * Volunteer seasons (e.g. "2026", "2027"). Exactly one is marked current.
 */
export const seasons = sqliteTable("seasons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  isCurrent: integer("isCurrent", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export type Season = typeof seasons.$inferSelect;
export type InsertSeason = typeof seasons.$inferInsert;

/**
 * Volunteer position slots per event
 */
export const volunteerSlots = sqliteTable("volunteer_slots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: integer("eventId").notNull().references(() => concessionEvents.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["co_cook", "kitchen_assistant", "cashier"] }).notNull(),
  slotIndex: integer("slotIndex").notNull(),
  isOpen: integer("isOpen", { mode: "boolean" }).notNull().default(true),
  startTime: text("startTime"),
  endTime: text("endTime"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`).$onUpdate(() => new Date()),
});

export type VolunteerSlot = typeof volunteerSlots.$inferSelect;
export type InsertVolunteerSlot = typeof volunteerSlots.$inferInsert;

/**
 * Volunteer signups
 */
export const volunteers = sqliteTable("volunteers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slotId: integer("slotId").notNull().references(() => volunteerSlots.id, { onDelete: "cascade" }),
  eventId: integer("eventId").notNull().references(() => concessionEvents.id, { onDelete: "cascade" }),
  parentName: text("parentName").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  childName: text("childName").notNull(),
  sport: text("sport", { enum: ["football", "cheer"] }).notNull(),
  grade: text("grade", { enum: ["K-1", "2nd", "3rd", "4th", "5th"] }).notNull(),
  status: text("status", { enum: ["confirmed", "checked_in", "completed", "no_show", "canceled"] }).notNull().default("confirmed"),
  reminderSent: integer("reminderSent", { mode: "boolean" }).notNull().default(false),
  confirmationSent: integer("confirmationSent", { mode: "boolean" }).notNull().default(false),
  notes: text("notes"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`).$onUpdate(() => new Date()),
});

export type Volunteer = typeof volunteers.$inferSelect;
export type InsertVolunteer = typeof volunteers.$inferInsert;

/**
 * Persisted heartbeat/cron job records (for morning reminder scheduling)
 */
export const cronJobs = sqliteTable("cron_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  taskUid: text("taskUid"),
  description: text("description"),
  isActive: integer("isActive", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`).$onUpdate(() => new Date()),
});

export type CronJob = typeof cronJobs.$inferSelect;
export type InsertCronJob = typeof cronJobs.$inferInsert;
