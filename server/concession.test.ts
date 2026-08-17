import { describe, expect, it, beforeEach, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { createLocalAdminAccount, listLocalAdminAccounts } from "./db";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(null), // DB not needed for unit tests
    checkDoubleBooking: vi.fn().mockResolvedValue(false),
    createVolunteer: vi.fn().mockResolvedValue(42),
    getVolunteerById: vi.fn().mockResolvedValue({
      id: 42,
      slotId: 1,
      eventId: 1,
      parentName: "Jane Smith",
      email: "jane@example.com",
      phone: "555-1234",
      childName: "Alex",
      sport: "football",
      grade: "3rd",
      status: "confirmed",
      reminderSent: false,
      confirmationSent: false,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    getEventById: vi.fn().mockResolvedValue({
      id: 1,
      eventDate: "2025-08-04",
      label: null,
      isActive: true,
      season: "2025",
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    getUpcomingEvents: vi.fn().mockResolvedValue([]),
    getAllEvents: vi.fn().mockResolvedValue([]),
    getSlotsForEvent: vi.fn().mockResolvedValue([]),
    getSlotById: vi.fn().mockResolvedValue({ id: 1, eventId: 1, role: "co_cook", slotIndex: 0, isOpen: false }),
    getAllVolunteers: vi.fn().mockResolvedValue([]),
    getTodayVolunteers: vi.fn().mockResolvedValue([]),
    getDashboardStats: vi.fn().mockResolvedValue({ totalVolunteers: 0, todayCount: 0, openSlots: 0, upcomingEvents: 0 }),
    markConfirmationSent: vi.fn().mockResolvedValue(undefined),
    updateVolunteerStatus: vi.fn().mockResolvedValue(undefined),
    updateVolunteer: vi.fn().mockResolvedValue(undefined),
    deleteVolunteer: vi.fn().mockResolvedValue(undefined),
    createEvent: vi.fn().mockResolvedValue(10),
    updateEvent: vi.fn().mockResolvedValue(undefined),
    deleteEvent: vi.fn().mockResolvedValue(undefined),
    listCronJobs: vi.fn().mockResolvedValue([]),
    getCronJob: vi.fn().mockResolvedValue(undefined),
    upsertCronJob: vi.fn().mockResolvedValue(undefined),
    listLocalAdminAccounts: vi.fn().mockResolvedValue([
      { id: 1, userId: 1, name: "Admin User", email: "admin@hoyas.org", role: "admin", isActive: true, createdAt: new Date(), lastSignedIn: new Date() },
      { id: 2, userId: 2, name: "Regular User", email: "user@example.com", role: "admin", isActive: true, createdAt: new Date(), lastSignedIn: new Date() },
    ]),
    createLocalAdminAccount: vi.fn().mockImplementation(async ({ email }: { email: string }) => ({ id: 2, userId: 2, email })),
    deactivateLocalAdminAccount: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("./email", () => ({
  sendConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendReminderEmail: vi.fn().mockResolvedValue(undefined),
  sendAdminNewSignupEmail: vi.fn().mockResolvedValue(undefined),
}));

// ─── Context helpers ──────────────────────────────────────────────────────────

function makePublicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {}, cookies: {} } as any,
    res: { clearCookie: vi.fn() } as any,
  };
}

function makeAdminCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-openid",
      email: "admin@hoyas.org",
      name: "Admin User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {}, cookies: {} } as any,
    res: { clearCookie: vi.fn() } as any,
  };
}

function makeUserCtx(): TrpcContext {
  return {
    user: {
      id: 2,
      openId: "user-openid",
      email: "user@example.com",
      name: "Regular User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {}, cookies: {} } as any,
    res: { clearCookie: vi.fn() } as any,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("auth.me", () => {
  it("returns null for unauthenticated requests", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user for authenticated requests", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.auth.me();
    expect(result?.role).toBe("admin");
  });
});

describe("events.listUpcoming", () => {
  it("is publicly accessible without authentication", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.events.listUpcoming();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("events.listAll (admin only)", () => {
  it("throws FORBIDDEN for non-admin users", async () => {
    const caller = appRouter.createCaller(makeUserCtx());
    await expect(caller.events.listAll()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("succeeds for admin users", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.events.listAll();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("volunteers.signup", () => {
  const validPayload = {
    slotId: 1,
    eventId: 1,
    parentName: "Jane Smith",
    email: "jane@example.com",
    phone: "555-1234",
    childName: "Alex",
    sport: "football" as const,
    grade: "3rd" as const,
  };

  it("creates a volunteer and returns id", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.volunteers.signup(validPayload);
    expect(result.id).toBe(42);
    expect(result.success).toBe(true);
  });

  it("prevents double booking for same email + event", async () => {
    const { checkDoubleBooking } = await import("./db");
    vi.mocked(checkDoubleBooking).mockResolvedValueOnce(true);
    const caller = appRouter.createCaller(makePublicCtx());
    await expect(caller.volunteers.signup(validPayload)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects invalid email", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    await expect(caller.volunteers.signup({ ...validPayload, email: "not-an-email" })).rejects.toThrow();
  });

  it("rejects invalid grade", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    await expect(caller.volunteers.signup({ ...validPayload, grade: "6th" as any })).rejects.toThrow();
  });

  it("rejects invalid sport", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    await expect(caller.volunteers.signup({ ...validPayload, sport: "basketball" as any })).rejects.toThrow();
  });
});

describe("volunteers.updateStatus (admin only)", () => {
  it("throws UNAUTHORIZED for unauthenticated users", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    await expect(caller.volunteers.updateStatus({ id: 1, status: "checked_in" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws FORBIDDEN for non-admin users", async () => {
    const caller = appRouter.createCaller(makeUserCtx());
    await expect(caller.volunteers.updateStatus({ id: 1, status: "checked_in" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("succeeds for admin users", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.volunteers.updateStatus({ id: 1, status: "checked_in" });
    expect(result.success).toBe(true);
  });

  it("accepts all valid status values", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const statuses = ["confirmed", "checked_in", "completed", "no_show", "canceled"] as const;
    for (const status of statuses) {
      const result = await caller.volunteers.updateStatus({ id: 1, status });
      expect(result.success).toBe(true);
    }
  });
});

describe("volunteers.list (admin only)", () => {
  it("throws FORBIDDEN for non-admin users", async () => {
    const caller = appRouter.createCaller(makeUserCtx());
    await expect(caller.volunteers.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns array for admin users", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.volunteers.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("volunteers.stats (admin only)", () => {
  it("returns stats object for admin", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.volunteers.stats();
    expect(result).toHaveProperty("totalVolunteers");
    expect(result).toHaveProperty("todayCount");
    expect(result).toHaveProperty("openSlots");
    expect(result).toHaveProperty("upcomingEvents");
  });
});

describe("events.create (admin only)", () => {
  it("throws FORBIDDEN for non-admin users", async () => {
    const caller = appRouter.createCaller(makeUserCtx());
    await expect(caller.events.create({ eventDate: "2025-10-01", season: "2025" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("creates event for admin users", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.events.create({ eventDate: "2025-10-01", season: "2025" });
    expect(result.id).toBe(10);
  });
});

describe("auth.logout", () => {
  it("clears session cookie and returns success", async () => {
    const ctx = makeAdminCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect((ctx.res.clearCookie as any).mock.calls.length).toBeGreaterThan(0);
  });
});

describe("adminAccess (admin only)", () => {
  it("rejects the user list for non-admin users", async () => {
    const caller = appRouter.createCaller(makeUserCtx());
    await expect(caller.adminAccess.listUsers()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lists signed-in accounts for an admin", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.adminAccess.listUsers();
    expect(result).toHaveLength(2);
    expect(vi.mocked(listLocalAdminAccounts)).toHaveBeenCalled();
  });

  it("allows an admin to create another password-based admin account", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    await expect(caller.adminAccess.create({ name: "New Admin", email: "newadmin@example.com", password: "A secure test password" })).resolves.toEqual({ id: 2, userId: 2, email: "newadmin@example.com" });
    expect(vi.mocked(createLocalAdminAccount)).toHaveBeenCalledWith(expect.objectContaining({ name: "New Admin", email: "newadmin@example.com", passwordHash: expect.stringMatching(/^scrypt\$/) }));
  });

  it("prevents an admin from removing their own access", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    await expect(caller.adminAccess.deactivate({ id: 1, userId: 1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
