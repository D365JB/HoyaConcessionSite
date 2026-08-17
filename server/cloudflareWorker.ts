import { httpServerHandler } from "cloudflare:node";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { configureHyperdrive, getSlotById, getVolunteersForReminder, markReminderSent } from "./db";
import { configureWorkerEmail, sendReminderEmail } from "./email";

type HyperdriveBinding = { host: string; user: string; password: string; database: string; port: number };
type EmailBinding = { send(message: { to: string; from: string; subject: string; html: string; text?: string }): Promise<void> };

interface CloudflareEnv {
  HYPERDRIVE: HyperdriveBinding;
  EMAIL: EmailBinding;
  EMAIL_FROM: string;
}

type WorkerExecutionContext = { waitUntil(promise: Promise<unknown>): void };
type WorkerScheduledController = { scheduledTime: number };

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ limit: "2mb", extended: true }));

app.get("/api/health", (_req, res) => res.json({ ok: true, runtime: "cloudflare-workers" }));
app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
app.listen(3000);

const httpHandler = httpServerHandler({ port: 3000 });

function configureRuntime(env: CloudflareEnv) {
  configureHyperdrive(env.HYPERDRIVE);
  configureWorkerEmail(env.EMAIL, env.EMAIL_FROM);
}

async function sendMorningReminders() {
  const rows = await getVolunteersForReminder();
  let sent = 0;
  for (const row of rows) {
    try {
      const slot = await getSlotById(row.volunteer.slotId);
      await sendReminderEmail(row.volunteer, row.event, slot);
      await markReminderSent(row.volunteer.id);
      sent++;
    } catch (error) {
      console.error("[Cloudflare reminder] Failed to send", row.volunteer.id, error);
    }
  }
  return sent;
}

export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: WorkerExecutionContext): Promise<Response> {
    configureRuntime(env);
    return httpHandler.fetch(request, env, ctx);
  },

  async scheduled(controller: WorkerScheduledController, env: CloudflareEnv, ctx: WorkerExecutionContext) {
    configureRuntime(env);
    const easternHour = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      hour12: false,
    }).format(new Date(controller.scheduledTime));

    // The Wrangler cron fires in both possible UTC hours; this guard keeps the
    // actual email run at 8:30 AM Eastern through standard and daylight time.
    if (easternHour === "08") ctx.waitUntil(sendMorningReminders());
  },
};
