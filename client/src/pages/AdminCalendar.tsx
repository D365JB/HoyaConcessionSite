import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft24Regular as ChevronLeft, ChevronRight24Regular as ChevronRight, SpinnerIos20Regular as Loader2, CheckmarkCircle24Regular as CheckCircle2, Warning24Regular as Warning, Mail24Regular as Mail } from "@fluentui/react-icons";

const ROLE_LABELS: Record<string, string> = { co_cook: "Co-Cook", kitchen_assistant: "Kitchen Assistant", cashier: "Cashier" };
const ROLE_ORDER = ["co_cook", "kitchen_assistant", "cashier"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseYmd(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}
function formatClock(hhmm?: string | null): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return "";
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m || 0).padStart(2, "0")} ${period}`;
}
function shiftTime(s: any): string {
  return s?.startTime && s?.endTime ? `${formatClock(s.startTime)} – ${formatClock(s.endTime)}` : "";
}

// Group an event's slots by role + shift time so multi-shift game days list each block.
function groupShifts(slots: any[]): { role: string; startTime: string | null; endTime: string | null; slots: any[] }[] {
  const map = new Map<string, { role: string; startTime: string | null; endTime: string | null; slots: any[] }>();
  for (const s of slots) {
    const key = `${s.role}|${s.startTime ?? ""}|${s.endTime ?? ""}`;
    const g = map.get(key) ?? { role: s.role, startTime: s.startTime ?? null, endTime: s.endTime ?? null, slots: [] as any[] };
    g.slots.push(s);
    map.set(key, g);
  }
  return Array.from(map.values()).sort((a, b) => {
    const ra = ROLE_ORDER.indexOf(a.role), rb = ROLE_ORDER.indexOf(b.role);
    return ra !== rb ? ra - rb : (a.startTime ?? "").localeCompare(b.startTime ?? "");
  });
}

// Fill is driven by actual volunteer records (who holds each slot), not the slot's
// isOpen flag, so a registered volunteer always shows even if a flag is out of sync.
function fillStats(r: any): { total: number; filled: number; open: number } {
  const registered = new Set((r.volunteers ?? []).map((v: any) => v.slotId));
  const total = (r.slots ?? []).length;
  const filled = (r.slots ?? []).filter((s: any) => registered.has(s.id)).length;
  return { total, filled, open: total - filled };
}

// Opens a print-friendly roster for one day (names + phones per role, plus open gaps) in a new tab.
function printDayRoster(dateLabel: string, rows: any[]) {
  const esc = (s: any) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
  const sections = rows.map((r) => {
    const bySlot: Record<number, any> = {};
    for (const v of r.volunteers ?? []) bySlot[v.slotId] = v;
    const groupsHtml = groupShifts(r.slots ?? []).map((g) => {
      const items = g.slots.map((s: any) => {
        const v = bySlot[s.id];
        return v
          ? `<li class="f">✓ ${esc(v.parentName)}${v.phone ? ` &nbsp;·&nbsp; ${esc(v.phone)}` : ""}</li>`
          : `<li class="o">☐ OPEN — needs a volunteer</li>`;
      }).join("");
      const t = shiftTime(g.slots[0]);
      return `<div class="role"><div class="rh">${esc(ROLE_LABELS[g.role] ?? g.role)}${t ? ` <span class="t">${esc(t)}</span>` : ""}</div><ul>${items}</ul></div>`;
    }).join("");
    const head = `${r.event.eventType === "game_day" ? "Game Day" : "Practice"}${r.event.location ? ` · ${esc(r.event.location)}` : ""}${r.event.label ? ` · ${esc(r.event.label)}` : ""}`;
    return `<section><h3>${head}</h3>${groupsHtml}</section>`;
  }).join("");
  const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Hoyas Concession Roster — ${esc(dateLabel)}</title><style>body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:32px;}h1{color:#003087;margin:0;font-size:22px;letter-spacing:.5px;}.sub{color:#555;margin:2px 0 20px;font-size:15px;}section{margin:0 0 16px;border:1px solid #ddd;border-radius:8px;padding:12px 16px;break-inside:avoid;}h3{color:#003087;margin:0 0 10px;font-size:16px;}.role{margin:8px 0;}.rh{font-weight:bold;margin-bottom:2px;}.t{color:#777;font-weight:normal;font-size:13px;}ul{margin:2px 0 8px;padding-left:20px;}li{margin:2px 0;font-size:14px;}li.o{color:#b26a00;font-weight:bold;}@media print{.noprint{display:none;}}</style></head><body><h1>HOYAS CONCESSION — Volunteer Roster</h1><p class="sub">${esc(dateLabel)}</p>${sections || "<p>No events.</p>"}<button class="noprint" onclick="window.print()" style="margin-top:12px;padding:8px 16px;background:#003087;color:#fff;border:none;border-radius:6px;cursor:pointer;">Print</button><script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script></body></html>`;
  const w = window.open("", "_blank", "width=820,height=900");
  if (w) { w.document.open(); w.document.write(doc); w.document.close(); }
}

export default function AdminCalendar() {
  useDocumentTitle("Calendar · Hoyas Concession Admin");
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) navigate("/admin");
  }, [user, loading, navigate]);

  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<string | null>(ymd(today));
  const [emailFor, setEmailFor] = useState<any>(null);
  const [emailMsg, setEmailMsg] = useState("");

  // Full 6-week grid range (includes leading/trailing days from adjacent months).
  const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(1 - monthStart.getDay());
  const monthEnd = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
  const gridEnd = new Date(monthEnd);
  gridEnd.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));

  const days: Date[] = [];
  for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) days.push(new Date(d));

  const { data: rows, isLoading } = trpc.events.calendar.useQuery(
    { start: ymd(gridStart), end: ymd(gridEnd) },
    { enabled: !!user && user.role === "admin" }
  );
  const sendMsg = trpc.events.emailVolunteers.useMutation({
    onSuccess: (res) => { toast.success(`Message sent to ${res.sent} of ${res.total} volunteer${res.total === 1 ? "" : "s"}.`); setEmailFor(null); setEmailMsg(""); },
    onError: (e) => toast.error(e.message),
  });

  const byDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const row of rows ?? []) {
      const key = (row.event.eventDate as string).slice(0, 10);
      (map[key] ??= []).push(row);
    }
    return map;
  }, [rows]);

  const monthRows = (rows ?? []).filter((r) => parseYmd(r.event.eventDate as string).getMonth() === viewDate.getMonth());
  const monthOpen = monthRows.reduce((n, r) => n + fillStats(r).open, 0);
  const monthTotal = monthRows.reduce((n, r) => n + fillStats(r).total, 0);

  const todayStr = ymd(today);
  const monthLabel = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const selectedRows = selectedDay ? byDate[selectedDay] ?? [] : [];

  const goMonth = (delta: number) => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1));
    setSelectedDay(null);
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold" style={{ color: "#003087" }}>{monthLabel}</h2>
            {monthRows.length > 0 ? (
              <p className="text-sm text-gray-500 mt-0.5">
                {monthRows.length} event{monthRows.length === 1 ? "" : "s"} · {monthTotal - monthOpen}/{monthTotal} spots filled
                {monthOpen > 0 ? <span className="font-semibold" style={{ color: "#b26a00" }}> · {monthOpen} still open</span> : <span className="font-semibold" style={{ color: "#007a35" }}> · fully covered</span>}
              </p>
            ) : (
              <p className="text-sm text-gray-400 mt-0.5">No events scheduled this month.</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-9 px-3" onClick={() => goMonth(-1)}><ChevronLeft className="w-4 h-4" /></Button>
            <Button size="sm" variant="outline" className="h-9 px-3 text-xs" onClick={() => { setViewDate(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDay(todayStr); }}>Today</Button>
            <Button size="sm" variant="outline" className="h-9 px-3" onClick={() => goMonth(1)}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: "#e6f5ec", border: "1px solid #007a35" }} /> Fully staffed</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: "#fff4e5", border: "1px solid #b26a00" }} /> Has open spots (gap)</span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" style={{ color: "#003087" }} /></div>
        ) : (
          <>
            {/* Calendar grid */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="text-center text-[11px] font-semibold text-gray-500 py-2">{w}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {days.map((d) => {
                  const key = ymd(d);
                  const dayRows = byDate[key] ?? [];
                  const inMonth = d.getMonth() === viewDate.getMonth();
                  const isToday = key === todayStr;
                  const isSelected = key === selectedDay;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedDay(dayRows.length ? key : null)}
                      className={`min-h-[62px] sm:min-h-[92px] border-b border-r border-gray-100 p-1 sm:p-1.5 text-left align-top transition-colors ${inMonth ? "bg-white hover:bg-gray-50" : "bg-gray-50/60"} ${isSelected ? "ring-2 ring-inset" : ""}`}
                      style={isSelected ? { boxShadow: "inset 0 0 0 2px #003087" } : undefined}
                    >
                      <span className={`inline-flex items-center justify-center text-xs w-5 h-5 rounded-full ${isToday ? "text-white font-bold" : inMonth ? "text-gray-700" : "text-gray-300"}`} style={isToday ? { backgroundColor: "#003087" } : undefined}>{d.getDate()}</span>
                      <div className="mt-0.5 space-y-0.5">
                        {dayRows.map((r) => {
                          const f = fillStats(r);
                          const gap = f.open > 0;
                          return (
                            <div
                              key={r.event.id}
                              className="text-[9px] sm:text-[10px] leading-tight px-1 py-0.5 rounded truncate font-medium"
                              style={{ backgroundColor: gap ? "#fff4e5" : "#e6f5ec", color: gap ? "#b26a00" : "#007a35" }}
                              title={`${r.event.eventType === "game_day" ? "Game Day" : "Practice"} — ${f.filled}/${f.total} filled`}
                            >
                              {r.event.eventType === "game_day" ? "Game" : "Prac"} {gap ? `${f.open} open` : "✓"}
                            </div>
                          );
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Day detail: who's registered + gaps */}
            {selectedDay && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold text-gray-900">
                    {parseYmd(selectedDay).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                  </h3>
                  {selectedRows.length > 0 && (
                    <Button size="sm" variant="outline" className="h-8 text-xs flex-shrink-0" onClick={() => printDayRoster(parseYmd(selectedDay).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }), selectedRows)}>
                      Print roster
                    </Button>
                  )}
                </div>
                {selectedRows.length === 0 ? (
                  <p className="text-sm text-gray-400">No events scheduled on this day.</p>
                ) : (
                  selectedRows.map((r) => {
                    const bySlot: Record<number, any> = {};
                    for (const v of r.volunteers ?? []) bySlot[v.slotId] = v;
                    const registered = new Set((r.volunteers ?? []).map((v: any) => v.slotId));
                    const f = fillStats(r);
                    const groups = groupShifts(r.slots ?? []);
                    return (
                      <div key={r.event.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <div className="flex items-center gap-2 flex-wrap mb-3">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: r.event.eventType === "game_day" ? "#e6f5ec" : "#e8eef7", color: r.event.eventType === "game_day" ? "#007a35" : "#003087" }}>{r.event.eventType === "game_day" ? "Game Day" : "Practice"}</span>
                          {r.event.location && <span className="text-xs text-gray-500">📍 {r.event.location}</span>}
                          {r.event.label && <span className="text-xs text-gray-400">· {r.event.label}</span>}
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: f.open > 0 ? "#fff4e5" : "#e6f5ec", color: f.open > 0 ? "#b26a00" : "#007a35" }}>
                            {f.open > 0 ? `${f.open} open` : "Fully staffed"}
                          </span>
                          {f.filled > 0 && (
                            <button type="button" onClick={() => setEmailFor(r)} className="text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 hover:opacity-80" style={{ backgroundColor: "#e8eef7", color: "#003087" }}>
                              <Mail className="w-3 h-3" /> Email volunteers
                            </button>
                          )}
                        </div>
                        <div className="divide-y divide-gray-50">
                          {groups.map((g, gi) => {
                            const filled = g.slots.filter((s: any) => registered.has(s.id));
                            const openCount = g.slots.length - filled.length;
                            return (
                              <div key={gi} className="py-2.5 first:pt-0 last:pb-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="text-sm font-semibold text-gray-800">{ROLE_LABELS[g.role] ?? g.role}</span>
                                  {shiftTime(g.slots[0]) && <span className="text-xs text-gray-400">{shiftTime(g.slots[0])}</span>}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {filled.map((s: any) => (
                                    <span key={s.id} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "#e6f5ec", color: "#007a35" }}>
                                      <CheckCircle2 className="w-3 h-3" />{bySlot[s.id]?.parentName ?? "Registered"}
                                    </span>
                                  ))}
                                  {Array.from({ length: openCount }).map((_, i) => (
                                    <span key={`open-${i}`} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "#fff4e5", color: "#b26a00" }}>
                                      <Warning className="w-3 h-3" />Open
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={!!emailFor} onOpenChange={() => setEmailFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: "#003087" }}>Email volunteers</DialogTitle>
          </DialogHeader>
          {emailFor && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                Sends to all {fillStats(emailFor).filled} registered volunteer{fillStats(emailFor).filled === 1 ? "" : "s"} for the {emailFor.event.eventType === "game_day" ? "game day" : "practice"} on {parseYmd(emailFor.event.eventDate).toLocaleDateString("en-US", { month: "long", day: "numeric" })}. Replies go to the admin inbox.
              </p>
              <textarea
                value={emailMsg}
                onChange={(e) => setEmailMsg(e.target.value)}
                rows={5}
                placeholder="e.g. Reminder: please arrive by 5:30 tonight — we're expecting a big crowd. Thank you!"
                className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
              />
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setEmailFor(null)} className="flex-1">Cancel</Button>
                <Button
                  onClick={() => sendMsg.mutate({ eventId: emailFor.event.id, message: emailMsg.trim() })}
                  disabled={sendMsg.isPending || !emailMsg.trim()}
                  className="flex-1 text-white"
                  style={{ backgroundColor: "#003087" }}
                >
                  {sendMsg.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send message"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
