import nodemailer from "nodemailer";
import type { Volunteer, ConcessionEvent, VolunteerSlot } from "../drizzle/schema";

const ROLE_LABELS: Record<string, string> = {
  co_cook: "Co-Cook",
  kitchen_assistant: "Kitchen Assistant",
  runner: "Runner",
  cashier: "Cashier",
};

const ROLE_TIMES: Record<string, string> = {
  co_cook: "5:45 PM – 8:15 PM",
  kitchen_assistant: "5:45 PM – 8:15 PM",
  runner: "6:15 PM – 8:45 PM",
  cashier: "6:15 PM – 8:45 PM",
};

function getTransporter() {
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
  const d = typeof dateVal === "string" ? new Date(dateVal + "T12:00:00") : dateVal;
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

export async function sendConfirmationEmail(
  volunteer: Volunteer,
  event: ConcessionEvent,
  slot?: VolunteerSlot
) {
  const t = getTransporter();
  if (!t) return;

  const roleLabel = slot ? ROLE_LABELS[slot.role] ?? slot.role : "Volunteer";
  const roleTime = slot ? ROLE_TIMES[slot.role] ?? "" : "";
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
          <p style="color:#666;font-size:13px;">Questions? Reply to this email or contact your team coordinator.</p>
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
  const roleTime = slot ? ROLE_TIMES[slot.role] ?? "" : "";
  const dateStr = formatDate(event.eventDate);
  const arriveTime = slot?.role === "co_cook" || slot?.role === "kitchen_assistant" ? "5:35 PM" : "6:05 PM";

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
    html,
  });
}
