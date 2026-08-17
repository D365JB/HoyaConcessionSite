import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  date,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Local credentials for password-based administrator login. Passwords are never
 * stored directly: this table holds a salted password hash only.
 */
export const localAdminAccounts = mysqlTable("local_admin_accounts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LocalAdminAccount = typeof localAdminAccounts.$inferSelect;
export type InsertLocalAdminAccount = typeof localAdminAccounts.$inferInsert;

/**
 * Concession event dates (each game night)
 */
export const concessionEvents = mysqlTable("concession_events", {
  id: int("id").autoincrement().primaryKey(),
  eventDate: date("eventDate").notNull(),
  label: varchar("label", { length: 128 }),
  isActive: boolean("isActive").default(true).notNull(),
  season: varchar("season", { length: 32 }).default("2025").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ConcessionEvent = typeof concessionEvents.$inferSelect;
export type InsertConcessionEvent = typeof concessionEvents.$inferInsert;

/**
 * Volunteer position slots per event
 */
export const volunteerSlots = mysqlTable("volunteer_slots", {
  id: int("id").autoincrement().primaryKey(),
  eventId: int("eventId").notNull().references(() => concessionEvents.id, { onDelete: "cascade" }),
  role: mysqlEnum("role", ["co_cook", "kitchen_assistant", "runner", "cashier"]).notNull(),
  slotIndex: int("slotIndex").notNull(),
  isOpen: boolean("isOpen").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VolunteerSlot = typeof volunteerSlots.$inferSelect;
export type InsertVolunteerSlot = typeof volunteerSlots.$inferInsert;

/**
 * Volunteer signups
 */
export const volunteers = mysqlTable("volunteers", {
  id: int("id").autoincrement().primaryKey(),
  slotId: int("slotId").notNull().references(() => volunteerSlots.id, { onDelete: "cascade" }),
  eventId: int("eventId").notNull().references(() => concessionEvents.id, { onDelete: "cascade" }),
  parentName: varchar("parentName", { length: 128 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  childName: varchar("childName", { length: 128 }).notNull(),
  sport: mysqlEnum("sport", ["football", "cheer"]).notNull(),
  grade: mysqlEnum("grade", ["K-1", "2nd", "3rd", "4th", "5th"]).notNull(),
  status: mysqlEnum("status", ["confirmed", "checked_in", "completed", "no_show", "canceled"]).default("confirmed").notNull(),
  reminderSent: boolean("reminderSent").default(false).notNull(),
  confirmationSent: boolean("confirmationSent").default(false).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Volunteer = typeof volunteers.$inferSelect;
export type InsertVolunteer = typeof volunteers.$inferInsert;

/**
 * Persisted heartbeat/cron job records (for morning reminder scheduling)
 */
export const cronJobs = mysqlTable("cron_jobs", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  taskUid: varchar("taskUid", { length: 128 }),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CronJob = typeof cronJobs.$inferSelect;
export type InsertCronJob = typeof cronJobs.$inferInsert;
