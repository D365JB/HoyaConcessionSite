import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { configureD1, getSlotById, getVolunteersForReminder, markReminderSent } from "./db";
import { configureWorkerEmail, sendReminderEmail } from "./email";

type EmailBinding = { send(message: { to: string; from: string; subject: string; html: string; text?: string }): Promise<void> };

interface CloudflareEnv {
  DB?: unknown;
  EMAIL?: EmailBinding;
  EMAIL_FROM: string;
}

type WorkerExecutionContext = { waitUntil(promise: Promise<unknown>): void };
type WorkerScheduledController = { scheduledTime: number };

function configureRuntime(env: CloudflareEnv) {
  if (env.DB) {
    configureD1(env.DB);
  } else {
    console.warn("[Runtime] D1 binding is not configured — database features are unavailable.");
  }
  if (env.EMAIL) {
    configureWorkerEmail(env.EMAIL, env.EMAIL_FROM);
  } else {
    console.warn("[Runtime] EMAIL binding is not configured — outbound email is disabled.");
  }
}

// Minimal Set-Cookie serializer covering the options the session cookie uses,
// avoiding a dependency whose export shape varies across versions.
function serializeCookie(name: string, value: string, options: Record<string, unknown>): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (typeof options.maxAge === "number") parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.expires instanceof Date) parts.push(`Expires=${options.expires.toUTCString()}`);
  parts.push(`Path=${typeof options.path === "string" ? options.path : "/"}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (typeof options.sameSite === "string") {
    parts.push(`SameSite=${options.sameSite.charAt(0).toUpperCase()}${options.sameSite.slice(1)}`);
  }
  if (typeof options.domain === "string") parts.push(`Domain=${options.domain}`);
  return parts.join("; ");
}

// Reuse the existing tRPC context by shimming the Express req/res it expects.
// login/logout write the session cookie via res.cookie/clearCookie; collect
// those writes here so they can be emitted as Set-Cookie on the fetch Response.
function buildContext(request: Request, setCookies: string[]) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const pushCookie = (name: string, value: string, options: Record<string, unknown> = {}) => {
    const opts: Record<string, unknown> = { ...options };
    // Express cookie maxAge is milliseconds; the cookie module expects seconds.
    if (typeof opts.maxAge === "number") opts.maxAge = Math.floor(opts.maxAge / 1000);
    setCookies.push(serializeCookie(name, value, opts));
  };
  const req = { protocol: "https", headers: { cookie: cookieHeader, "x-forwarded-proto": "https" } };
  const res = {
    cookie: (name: string, value: string, options: Record<string, unknown> = {}) => pushCookie(name, value, options),
    clearCookie: (name: string, options: Record<string, unknown> = {}) => pushCookie(name, "", { ...options, maxAge: undefined, expires: new Date(0) }),
  };
  return createContext({ req, res } as unknown as Parameters<typeof createContext>[0]);
}

async function handleApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/api/health") {
    return Response.json({ ok: true, runtime: "cloudflare-workers" });
  }
  if (url.pathname === "/api/trpc" || url.pathname.startsWith("/api/trpc/")) {
    const setCookies: string[] = [];
    const response = await fetchRequestHandler({
      endpoint: "/api/trpc",
      req: request,
      router: appRouter,
      createContext: () => buildContext(request, setCookies),
    });
    if (setCookies.length === 0) return response;
    const headers = new Headers(response.headers);
    for (const cookie of setCookies) headers.append("set-cookie", cookie);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
  return Response.json({ error: "not_found" }, { status: 404 });
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
  async fetch(request: Request, env: CloudflareEnv, _ctx: WorkerExecutionContext): Promise<Response> {
    configureRuntime(env);
    return handleApiRequest(request);
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
