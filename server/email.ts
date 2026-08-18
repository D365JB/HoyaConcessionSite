import nodemailer from "nodemailer";
import type { Volunteer, ConcessionEvent, VolunteerSlot } from "../drizzle/schema";

type WorkerEmailBinding = {
  send(message: { to: string | string[]; from: string; subject: string; html: string; text?: string; replyTo?: string }): Promise<void>;
};

let workerEmail: WorkerEmailBinding | null = null;
let workerEmailFrom: string | null = null;

/** Configure the native Cloudflare Email binding for Worker deployments. */
export function configureWorkerEmail(binding: WorkerEmailBinding, from: string) {
  workerEmail = binding;
  workerEmailFrom = from;
}

const ROLE_LABELS: Record<string, string> = {
  co_cook: "Co-Cook",
  kitchen_assistant: "Kitchen Assistant",
  cashier: "Cashier",
};

const ROLE_TIMES: Record<string, string> = {
  co_cook: "5:45 PM – 8:15 PM",
  kitchen_assistant: "5:45 PM – 8:15 PM",
  cashier: "6:15 PM – 8:45 PM",
};

function formatClock(hhmm?: string | null): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return "";
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m || 0).padStart(2, "0")} ${period}`;
}

function slotTimeRange(slot?: VolunteerSlot): string {
  if (slot?.startTime && slot?.endTime) return `${formatClock(slot.startTime)} – ${formatClock(slot.endTime)}`;
  return slot ? (ROLE_TIMES[slot.role] ?? "") : "";
}

function slotArriveBy(slot?: VolunteerSlot): string {
  if (slot?.startTime) {
    const [h, m] = slot.startTime.split(":").map(Number);
    const d = new Date(2000, 0, 1, h, (m || 0) - 10);
    return formatClock(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
  }
  return slot?.role === "cashier" ? "6:05 PM" : "5:35 PM";
}

function getTransporter() {
  if (workerEmail && workerEmailFrom) {
    return {
      transporter: {
        sendMail: async (message: { to: string | string[]; subject: string; html: string; replyTo?: string }) =>
          workerEmail!.send({ to: message.to, from: workerEmailFrom!, subject: message.subject, html: message.html, replyTo: message.replyTo }),
      },
      from: workerEmailFrom,
    };
  }
  // On Cloudflare the EMAIL binding is always present, so a missing EMAIL_FROM is
  // the usual reason sends silently no-op; surface that distinctly from SMTP.
  if (workerEmail && !workerEmailFrom) {
    console.warn("[Email] Cloudflare EMAIL binding present but EMAIL_FROM is not set — skipping send. Set the EMAIL_FROM secret to a verified sender address.");
    return null;
  }
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT ?? "587");
  const from = process.env.SMTP_FROM ?? "Hoyas Concession <noreply@hoyas.org>";

  if (!host || !user || !pass) {
    console.warn("[Email] SMTP not configured — skipping email send");
    return null;
  }

  return { transporter: nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } }), from };
}

function formatDate(dateVal: string | Date): string {
  const s = typeof dateVal === "string" ? dateVal : dateVal.toISOString();
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

export async function sendConfirmationEmail(
  volunteer: Volunteer,
  event: ConcessionEvent,
  slot?: VolunteerSlot
) {
  const t = getTransporter();
  if (!t) return;

  const roleLabel = slot ? (ROLE_LABELS[slot.role] ?? slot.role) : "Volunteer";
  const roleTime = slotTimeRange(slot);
  const dateStr = formatDate(event.eventDate);

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="background:#003087;padding:24px 32px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:bold;">HOYAS CONCESSION</h1>
          <p style="color:#009A44;margin:4px 0 0;font-size:14px;font-weight:600;letter-spacing:1px;">VOLUNTEER CONFIRMATION</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="color:#003087;margin:0 0 16px;">You're signed up, ${volunteer.parentName}!</h2>
          <p style="color:#333;line-height:1.6;">Thank you for volunteering with the Hoyas concession program. Here are your details:</p>
          <table width="100%" cellpadding="8" cellspacing="0" style="background:#f8f9fa;border-radius:6px;margin:16px 0;">
            <tr><td style="color:#666;font-size:13px;width:40%;">Date</td><td style="color:#003087;font-weight:bold;">${dateStr}</td></tr>
            <tr><td style="color:#666;font-size:13px;">Role</td><td style="color:#003087;font-weight:bold;">${roleLabel}</td></tr>
            <tr><td style="color:#666;font-size:13px;">Time</td><td style="color:#003087;font-weight:bold;">${roleTime}</td></tr>
            ${event.location ? `<tr><td style="color:#666;font-size:13px;">Location</td><td style="color:#003087;font-weight:bold;">${event.location}</td></tr>` : ""}
            <tr><td style="color:#666;font-size:13px;">Child</td><td style="color:#333;">${volunteer.childName} (${volunteer.grade}, ${volunteer.sport === "football" ? "Football" : "Cheer"})</td></tr>
          </table>
          <div style="background:#e8f5e9;border-left:4px solid #009A44;padding:16px;border-radius:4px;margin:16px 0;">
            <p style="margin:0;color:#1b5e20;font-weight:bold;">Volunteer Reminders</p>
            <ul style="margin:8px 0 0;padding-left:20px;color:#2e7d32;font-size:14px;line-height:1.8;">
              <li>Volunteers must be at least 15 years old</li>
              <li>Wear closed-toe shoes</li>
              <li>Arrive 10 minutes early</li>
              <li>Training will be provided</li>
            </ul>
          </div>
          <p style="color:#666;font-size:13px;">Can't make your shift, or have a question? Just reply to this email and a coordinator will take care of it.</p>
        </td></tr>
        <tr><td style="background:#003087;padding:16px;text-align:center;">
          <p style="color:#ffffff;margin:0;font-size:12px;">© 2026 Hoyas Youth Sports · Concession Volunteer Program</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await t.transporter.sendMail({
    from: t.from,
    to: volunteer.email,
    subject: `✅ Confirmed: Hoyas Concession Volunteer – ${dateStr}`,
    replyTo: process.env.ADMIN_EMAIL || undefined,
    html,
  });
}

export async function sendAdminNewSignupEmail(
  volunteer: Volunteer,
  event: ConcessionEvent,
  slot?: VolunteerSlot,
  recipients: string[] = []
) {
  const t = getTransporter();
  if (!t) return;

  const envAdmin = process.env.ADMIN_EMAIL;
  const allRecipients = Array.from(
    new Set([...recipients, ...(envAdmin ? [envAdmin] : [])].map((e) => e.trim()).filter(Boolean))
  );
  if (allRecipients.length === 0) {
    console.warn("[Email] No admin recipients configured — skipping admin notification");
    return;
  }

  const roleLabel = slot ? (ROLE_LABELS[slot.role] ?? slot.role) : "Volunteer";
  const roleTime = slotTimeRange(slot);
  const dateStr = formatDate(event.eventDate);
  const sportLabel = volunteer.sport === "football" ? "Football" : "Cheer";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="background:#003087;padding:24px 32px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:bold;">HOYAS CONCESSION</h1>
          <p style="color:#009A44;margin:4px 0 0;font-size:14px;font-weight:600;letter-spacing:1px;">NEW VOLUNTEER SIGN-UP</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="color:#003087;margin:0 0 16px;">New volunteer registered!</h2>
          <p style="color:#333;line-height:1.6;">A new volunteer has signed up for the concession stand.</p>
          <table width="100%" cellpadding="8" cellspacing="0" style="background:#f8f9fa;border-radius:6px;margin:16px 0;">
            <tr style="background:#e8eef7;"><td colspan="2" style="color:#003087;font-weight:bold;font-size:13px;padding:10px 8px;">Event Details</td></tr>
            <tr><td style="color:#666;font-size:13px;width:40%;">Date</td><td style="color:#003087;font-weight:bold;">${dateStr}</td></tr>
            <tr><td style="color:#666;font-size:13px;">Role</td><td style="color:#003087;font-weight:bold;">${roleLabel}</td></tr>
            <tr><td style="color:#666;font-size:13px;">Time</td><td style="color:#003087;font-weight:bold;">${roleTime}</td></tr>
            ${event.location ? `<tr><td style="color:#666;font-size:13px;">Location</td><td style="color:#003087;font-weight:bold;">${event.location}</td></tr>` : ""}
            <tr style="background:#e8eef7;"><td colspan="2" style="color:#003087;font-weight:bold;font-size:13px;padding:10px 8px;">Volunteer Info</td></tr>
            <tr><td style="color:#666;font-size:13px;">Parent Name</td><td style="color:#333;font-weight:bold;">${volunteer.parentName}</td></tr>
            <tr><td style="color:#666;font-size:13px;">Email</td><td style="color:#333;">${volunteer.email}</td></tr>
            <tr><td style="color:#666;font-size:13px;">Phone</td><td style="color:#333;">${volunteer.phone}</td></tr>
            <tr><td style="color:#666;font-size:13px;">Child Name</td><td style="color:#333;">${volunteer.childName}</td></tr>
            <tr><td style="color:#666;font-size:13px;">Sport</td><td style="color:#333;">${sportLabel}</td></tr>
            <tr><td style="color:#666;font-size:13px;">Grade</td><td style="color:#333;">${volunteer.grade}</td></tr>
          </table>
          <p style="color:#666;font-size:13px;">Log in to the admin dashboard to manage volunteers.</p>
        </td></tr>
        <tr><td style="background:#003087;padding:16px;text-align:center;">
          <p style="color:#ffffff;margin:0;font-size:12px;">© 2026 Hoyas Youth Sports · Concession Volunteer Program</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await t.transporter.sendMail({
    from: t.from,
    to: allRecipients,
    subject: `🆕 New Volunteer: ${volunteer.parentName} – ${roleLabel} on ${dateStr}`,
    replyTo: volunteer.email,
    html,
  });
}

export async function sendReminderEmail(
  volunteer: Volunteer,
  event: ConcessionEvent,
  slot?: VolunteerSlot
) {
  const t = getTransporter();
  if (!t) return;

  const roleLabel = slot ? ROLE_LABELS[slot.role] ?? slot.role : "Volunteer";
  const roleTime = slotTimeRange(slot);
  const dateStr = formatDate(event.eventDate);
  const arriveTime = slotArriveBy(slot);

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="background:#003087;padding:24px 32px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:bold;">HOYAS CONCESSION</h1>
          <p style="color:#009A44;margin:4px 0 0;font-size:14px;font-weight:600;letter-spacing:1px;">REMINDER — TODAY IS YOUR SHIFT!</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="color:#003087;margin:0 0 16px;">Good morning, ${volunteer.parentName}!</h2>
          <p style="color:#333;line-height:1.6;">This is a friendly reminder that you are scheduled to volunteer at the Hoyas concession stand <strong>today</strong>.</p>
          <table width="100%" cellpadding="8" cellspacing="0" style="background:#f8f9fa;border-radius:6px;margin:16px 0;">
            <tr><td style="color:#666;font-size:13px;width:40%;">Date</td><td style="color:#003087;font-weight:bold;">${dateStr}</td></tr>
            <tr><td style="color:#666;font-size:13px;">Role</td><td style="color:#003087;font-weight:bold;">${roleLabel}</td></tr>
            <tr><td style="color:#666;font-size:13px;">Shift Time</td><td style="color:#003087;font-weight:bold;">${roleTime}</td></tr>
            ${event.location ? `<tr><td style="color:#666;font-size:13px;">Location</td><td style="color:#003087;font-weight:bold;">${event.location}</td></tr>` : ""}
            <tr><td style="color:#666;font-size:13px;">Arrive By</td><td style="color:#009A44;font-weight:bold;">${arriveTime} (10 min early)</td></tr>
          </table>
          <div style="background:#fff3e0;border-left:4px solid #f57c00;padding:16px;border-radius:4px;margin:16px 0;">
            <p style="margin:0;color:#e65100;font-weight:bold;">Don't forget!</p>
            <ul style="margin:8px 0 0;padding-left:20px;color:#bf360c;font-size:14px;line-height:1.8;">
              <li>Wear closed-toe shoes</li>
              <li>Arrive 10 minutes before your shift starts</li>
              <li>Training will be provided on-site</li>
            </ul>
          </div>
          <p style="color:#666;font-size:13px;">See you tonight! Go Hoyas! 🏈</p>
        </td></tr>
        <tr><td style="background:#003087;padding:16px;text-align:center;">
          <p style="color:#ffffff;margin:0;font-size:12px;">© 2026 Hoyas Youth Sports · Concession Volunteer Program</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await t.transporter.sendMail({
    from: t.from,
    to: volunteer.email,
    subject: `⏰ Reminder: Hoyas Concession Volunteer TONIGHT – ${roleLabel}`,
    replyTo: process.env.ADMIN_EMAIL || undefined,
    html,
  });
}

/** Sent to the volunteer when an admin marks them checked-in or no-show for a shift. */
export async function sendStatusEmail(
  volunteer: Volunteer,
  event: ConcessionEvent,
  slot: VolunteerSlot | undefined,
  status: "checked_in" | "no_show" | "canceled"
) {
  const t = getTransporter();
  if (!t) return;

  const roleLabel = slot ? (ROLE_LABELS[slot.role] ?? slot.role) : "Volunteer";
  const roleTime = slotTimeRange(slot);
  const dateStr = formatDate(event.eventDate);

  const isCheckIn = status === "checked_in";
  const isCanceled = status === "canceled";
  const accent = isCheckIn ? "#009A44" : isCanceled ? "#003087" : "#c62828";
  const banner = isCheckIn ? "CHECKED IN — THANK YOU!" : isCanceled ? "SHIFT CANCELED" : "WE MISSED YOU";
  const subject = isCheckIn
    ? `✅ Checked in — thanks for volunteering, ${volunteer.parentName}!`
    : isCanceled
    ? `Your Hoyas concession shift has been canceled`
    : `We missed you at the Hoyas concession stand`;
  const heading = isCheckIn
    ? `Thanks for being here, ${volunteer.parentName}!`
    : isCanceled
    ? `Your shift has been canceled, ${volunteer.parentName}`
    : `Hi ${volunteer.parentName}, we missed you`;
  const body = isCheckIn
    ? `You're all checked in for your shift today. Thank you for giving your time to support our Hoyas athletes — we truly appreciate you!`
    : isCanceled
    ? `Your volunteer shift below has been canceled and the spot has been reopened for another family. If this was a mistake or you'd like to sign up for a different date, just reply to this email and we'll help.`
    : `Our records show you were signed up to volunteer today but weren't able to check in. We hope everything is okay! If this was a mistake or something came up, just reply to this email and let us know.`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="background:#003087;padding:24px 32px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:bold;">HOYAS CONCESSION</h1>
          <p style="color:${accent};margin:4px 0 0;font-size:14px;font-weight:600;letter-spacing:1px;">${banner}</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="color:#003087;margin:0 0 16px;">${heading}</h2>
          <p style="color:#333;line-height:1.6;">${body}</p>
          <table width="100%" cellpadding="8" cellspacing="0" style="background:#f8f9fa;border-radius:6px;margin:16px 0;">
            <tr><td style="color:#666;font-size:13px;width:40%;">Date</td><td style="color:#003087;font-weight:bold;">${dateStr}</td></tr>
            <tr><td style="color:#666;font-size:13px;">Role</td><td style="color:#003087;font-weight:bold;">${roleLabel}</td></tr>
            ${roleTime ? `<tr><td style="color:#666;font-size:13px;">Shift Time</td><td style="color:#003087;font-weight:bold;">${roleTime}</td></tr>` : ""}
            ${event.location ? `<tr><td style="color:#666;font-size:13px;">Location</td><td style="color:#003087;font-weight:bold;">${event.location}</td></tr>` : ""}
          </table>
          <p style="color:#666;font-size:13px;">Questions? Just reply to this email and a coordinator will help. Go Hoyas! 🏈</p>
        </td></tr>
        <tr><td style="background:#003087;padding:16px;text-align:center;">
          <p style="color:#ffffff;margin:0;font-size:12px;">© 2026 Hoyas Youth Sports · Concession Volunteer Program</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await t.transporter.sendMail({
    from: t.from,
    to: volunteer.email,
    subject,
    replyTo: process.env.ADMIN_EMAIL || undefined,
    html,
  });
}

type DigestEventRow = {
  event: ConcessionEvent;
  slots: VolunteerSlot[];
  totalSlots: number;
  openSlots: number;
  filledSlots: number;
  volunteers: Volunteer[];
};

export async function sendAdminDigest(
  kind: "daily" | "weekly" | "monthly",
  rows: DigestEventRow[],
  recipients: string[] = [],
  opts: { exclusive?: boolean } = {}
) {
  const t = getTransporter();
  if (!t) return;

  const envAdmin = process.env.ADMIN_EMAIL;
  const merged = opts.exclusive ? recipients : [...recipients, ...(envAdmin ? [envAdmin] : [])];
  const allRecipients = Array.from(
    new Set(merged.map((e) => e.trim()).filter(Boolean))
  );
  if (allRecipients.length === 0) {
    console.warn("[Email] No admin recipients configured — skipping digest");
    return;
  }

  const totalOpen = rows.reduce((n, r) => n + r.openSlots, 0);
  const totalSlots = rows.reduce((n, r) => n + r.totalSlots, 0);
  const kindLabel = kind === "daily" ? "Today" : kind === "weekly" ? "This Week" : "Next 30 Days";
  const subject = totalOpen > 0
    ? `📋 Concession Coverage (${kindLabel}) — ${totalOpen} open spot${totalOpen === 1 ? "" : "s"}`
    : `📋 Concession Coverage (${kindLabel}) — fully covered ✅`;

  const eventRows = rows.map((r) => {
    const dateStr = formatDate(r.event.eventDate);
    const typeLabel = r.event.eventType === "game_day" ? "Game Day" : "Practice";
    const openByRole = r.slots.filter((s) => s.isOpen).reduce((acc, s) => { acc[s.role] = (acc[s.role] ?? 0) + 1; return acc; }, {} as Record<string, number>);
    const needs = Object.entries(openByRole).map(([role, n]) => `${ROLE_LABELS[role] ?? role} ×${n}`).join(", ");
    const covered = r.totalSlots - r.openSlots;
    const statusColor = r.openSlots === 0 ? "#009A44" : (r.openSlots >= r.totalSlots ? "#c62828" : "#c05600");
    const statusText = r.openSlots === 0 ? "Fully covered" : `${r.openSlots} open`;
    return `
      <tr>
        <td style="padding:12px 8px;border-bottom:1px solid #eee;vertical-align:top;">
          <div style="color:#003087;font-weight:bold;font-size:14px;">${dateStr}</div>
          <div style="color:#666;font-size:12px;margin-top:2px;">${typeLabel}${r.event.location ? ` · ${r.event.location}` : ""}${r.event.label ? ` · ${r.event.label}` : ""}</div>
          ${needs ? `<div style="color:#c05600;font-size:12px;margin-top:4px;">Still needs: ${needs}</div>` : ""}
        </td>
        <td style="padding:12px 8px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;vertical-align:top;">
          <div style="color:${statusColor};font-weight:bold;font-size:13px;">${statusText}</div>
          <div style="color:#999;font-size:11px;margin-top:2px;">${covered}/${r.totalSlots} filled</div>
        </td>
      </tr>`;
  }).join("");

  const summaryLine = totalOpen > 0
    ? `<strong style="color:#c05600;">${totalOpen}</strong> of ${totalSlots} volunteer spots still need to be filled.`
    : `All ${totalSlots} volunteer spots are covered — nice work! 🎉`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="background:#003087;padding:24px 32px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:bold;">HOYAS CONCESSION</h1>
          <p style="color:#009A44;margin:4px 0 0;font-size:14px;font-weight:600;letter-spacing:1px;">COVERAGE SUMMARY · ${kindLabel.toUpperCase()}</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#333;line-height:1.6;margin:0 0 16px;">${summaryLine}</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            ${eventRows}
          </table>
          <p style="color:#666;font-size:13px;margin-top:20px;">Log in to the admin dashboard to manage volunteers, or reply to this email with questions.</p>
        </td></tr>
        <tr><td style="background:#003087;padding:16px;text-align:center;">
          <p style="color:#ffffff;margin:0;font-size:12px;">© 2026 Hoyas Youth Sports · Concession Volunteer Program</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await t.transporter.sendMail({
    from: t.from,
    to: allRecipients,
    subject,
    replyTo: envAdmin || undefined,
    html,
  });
}
