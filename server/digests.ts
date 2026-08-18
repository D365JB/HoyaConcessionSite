import { getActiveAdminEmails, getEventsWithFill, isAdminDigestsEnabled } from "./db";
import { sendAdminDigest } from "./email";

export type DigestKind = "daily" | "weekly" | "monthly";

// Eastern-time date parts for the given instant (schedule + ranges run in ET).
function etDateParts(ms: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { year: get("year"), month: get("month"), day: get("day"), weekday: get("weekday") };
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

const SPAN_DAYS: Record<DigestKind, number> = { daily: 0, weekly: 6, monthly: 29 };

/** Build and send one coverage digest. `force` bypasses the on/off setting (manual sends). */
export async function runDigest(kind: DigestKind, opts: { nowMs?: number; force?: boolean } = {}) {
  const nowMs = opts.nowMs ?? Date.now();
  if (!opts.force && !(await isAdminDigestsEnabled())) return { sent: false as const, reason: "disabled" as const, kind, events: 0 };
  const { year, month, day } = etDateParts(nowMs);
  const start = `${year}-${month}-${day}`;
  const end = addDaysISO(start, SPAN_DAYS[kind]);
  const rows = await getEventsWithFill(start, end);
  if (rows.length === 0) return { sent: false as const, reason: "no-events" as const, kind, events: 0 };
  const recipients = await getActiveAdminEmails();
  await sendAdminDigest(kind, rows, recipients);
  return { sent: true as const, reason: "ok" as const, kind, events: rows.length };
}

/** Cron entry point: one digest per morning — month-start beats Monday beats daily. */
export async function runScheduledDigests(scheduledTime: number) {
  const { day, weekday } = etDateParts(scheduledTime);
  const kind: DigestKind = day === "01" ? "monthly" : weekday === "Mon" ? "weekly" : "daily";
  return runDigest(kind, { nowMs: scheduledTime });
}
