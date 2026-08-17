import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  checkDoubleBooking,
  createEvent,
  createVolunteer,
  deleteEvent,
  deleteVolunteer,
  getAllEvents,
  getAllVolunteers,
  getDashboardStats,
  getEventById,
  getSlotsForEvent,
  getTodayVolunteers,
  getUpcomingEvents,
  getVolunteerById,
  markConfirmationSent,
  updateEvent,
  updateVolunteer,
  updateVolunteerStatus,
  getCronJob,
  upsertCronJob,
  listCronJobs,
} from "./db";
import { getSlotById } from "./db";
import { listUsersForAdmin, updateUserRoleById } from "./db";
import { sendConfirmationEmail, sendReminderEmail, sendAdminNewSignupEmail } from "./email";
import { createHeartbeatJob, deleteHeartbeatJob } from "./_core/heartbeat";

// Admin-only middleware
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Public: Events & Slots ────────────────────────────────────────────────
  events: router({
    listUpcoming: publicProcedure
      .input(z.object({ season: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const events = await getUpcomingEvents(input?.season);
        // Attach slots to each event
        const result = await Promise.all(
          events.map(async (event) => {
            const slots = await getSlotsForEvent(event.id);
            return { ...event, slots };
          })
        );
        return result;
      }),

    listAll: adminProcedure
      .input(z.object({ season: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const events = await getAllEvents(input?.season);
        const result = await Promise.all(
          events.map(async (event) => {
            const slots = await getSlotsForEvent(event.id);
            return { ...event, slots };
          })
        );
        return result;
      }),

    create: adminProcedure
      .input(z.object({ eventDate: z.string(), season: z.string(), label: z.string().optional() }))
      .mutation(async ({ input }) => {
        const id = await createEvent(input.eventDate, input.season, input.label);
        return { id };
      }),

    update: adminProcedure
      .input(z.object({ id: z.number(), eventDate: z.string().optional(), label: z.string().optional(), isActive: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateEvent(id, data);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteEvent(input.id);
        return { success: true };
      }),
  }),

  // ─── Public: Volunteer Signup ──────────────────────────────────────────────
  volunteers: router({
    signup: publicProcedure
      .input(
        z.object({
          slotId: z.number(),
          eventId: z.number(),
          parentName: z.string().min(2).max(128),
          email: z.string().email(),
          phone: z.string().min(7).max(32),
          childName: z.string().min(1).max(128),
          sport: z.enum(["football", "cheer"]),
          grade: z.enum(["K-1", "2nd", "3rd", "4th", "5th"]),
        })
      )
      .mutation(async ({ input }) => {
        // Check double booking
        const alreadyBooked = await checkDoubleBooking(input.email, input.eventId);
        if (alreadyBooked) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "You are already signed up for a role on this date. Only one role per event is allowed.",
          });
        }
        // Create volunteer record
        const id = await createVolunteer(input);
        // Send confirmation email (non-blocking)
        const volunteer = await getVolunteerById(id);
        const event = volunteer ? await getEventById(input.eventId) : null;
        if (volunteer && event) {
          const slot = await getSlotById(input.slotId).catch(() => undefined);
          // Email volunteer — with role/time from slot
          sendConfirmationEmail(volunteer, event, slot ?? undefined)
            .then(() => markConfirmationSent(id))
            .catch(console.error);
          // Email admin notification
          sendAdminNewSignupEmail(volunteer, event, slot ?? undefined).catch(console.error);
        }
        return { id, success: true };
      }),

    // Admin: list all with filters
    list: adminProcedure
      .input(
        z.object({
          search: z.string().optional(),
          status: z.string().optional(),
          eventId: z.number().optional(),
          season: z.string().optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        return getAllVolunteers(input);
      }),

    today: adminProcedure.query(async () => {
      return getTodayVolunteers();
    }),

    stats: adminProcedure.query(async () => {
      return getDashboardStats();
    }),

    updateStatus: adminProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["confirmed", "checked_in", "completed", "no_show", "canceled"]),
        })
      )
      .mutation(async ({ input }) => {
        await updateVolunteerStatus(input.id, input.status);
        return { success: true };
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          parentName: z.string().optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          childName: z.string().optional(),
          sport: z.enum(["football", "cheer"]).optional(),
          grade: z.enum(["K-1", "2nd", "3rd", "4th", "5th"]).optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateVolunteer(id, data);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteVolunteer(input.id);
        return { success: true };
      }),

    exportData: adminProcedure
      .input(z.object({ season: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return getAllVolunteers({ season: input?.season });
      }),
  }),

  // ─── Admin: Cron / Heartbeat Management ──────────────────────────────────────
  cron: router({
    list: adminProcedure.query(async () => {
      return listCronJobs();
    }),

    setupMorningReminder: adminProcedure.mutation(async ({ ctx }) => {
      const existing = await getCronJob("morning-reminders");
      if (existing?.taskUid) {
        return { taskUid: existing.taskUid, alreadyExists: true };
      }
      const sessionCookie = (ctx.req as any).cookies?.["app_session_id"] ?? "";
      const result = await createHeartbeatJob(
        {
          name: "morning-reminders",
          cron: "0 30 12 * * *",
          path: "/api/scheduled/morning-reminders",
          method: "POST",
          description: "Send morning reminder emails to today's concession volunteers at 8:30 AM ET",
        },
        sessionCookie
      );
      await upsertCronJob("morning-reminders", result.taskUid, "Morning reminder emails at 8:30 AM ET");
      return { taskUid: result.taskUid, alreadyExists: false };
    }),

    deleteMorningReminder: adminProcedure.mutation(async ({ ctx }) => {
      const existing = await getCronJob("morning-reminders");
      if (!existing?.taskUid) {
        return { success: true, message: "No active cron job found" };
      }
      const sessionCookie = (ctx.req as any).cookies?.["app_session_id"] ?? "";
      await deleteHeartbeatJob(existing.taskUid, sessionCookie);
      await upsertCronJob("morning-reminders", null, "Morning reminder emails (disabled)");
      return { success: true };
    }),
  }),

  // ─── Admin: Access Management ───────────────────────────────────────────────
  adminAccess: router({
    listUsers: adminProcedure.query(async () => {
      return listUsersForAdmin();
    }),

    setRole: adminProcedure
      .input(z.object({ id: z.number(), role: z.enum(["user", "admin"]) }))
      .mutation(async ({ input, ctx }) => {
        if (input.id === ctx.user.id && input.role === "user") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You cannot remove your own administrator access.",
          });
        }

        try {
          return await updateUserRoleById(input.id, input.role);
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "Unable to update administrator access.",
          });
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
