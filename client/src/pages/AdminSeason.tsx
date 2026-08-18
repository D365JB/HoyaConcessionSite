import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Add24Regular as Plus, Delete24Regular as Trash2, Edit24Regular as Edit2, SpinnerIos20Regular as Loader2, CalendarLtr24Regular as CalendarDays, ToggleLeft24Regular as ToggleLeft, ToggleRight24Regular as ToggleRight, ArrowUpload24Regular as Upload, ArrowDownload24Regular as Download, Mail24Regular as Mail } from "@fluentui/react-icons";

const LOCATIONS = ["Lost Mountain Park", "Harrison High School"];
const ROLE_ROWS = [
  { role: "co_cook" as const, label: "Co-Cook" },
  { role: "kitchen_assistant" as const, label: "Kitchen Assistant" },
  { role: "cashier" as const, label: "Cashier" },
];

function formatDate(dateVal: string | Date): string {
  const s = typeof dateVal === "string" ? dateVal : dateVal.toISOString();
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function normalizeCsvDate(raw: string): string | null {
  const t = (raw ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return null;
}

type ParsedEvent = { eventDate: string; season: string; label?: string; location?: string };

function parseEventsCsv(text: string, season: string): { events: ParsedEvent[]; skipped: number } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { events: [], skipped: 0 };
  const rows = lines.map(parseCsvLine);
  const startIdx = /date/i.test(rows[0][0] ?? "") ? 1 : 0;
  const events: ParsedEvent[] = [];
  let skipped = 0;
  for (let i = startIdx; i < rows.length; i++) {
    const date = normalizeCsvDate(rows[i][0]);
    if (!date) { skipped++; continue; }
    const location = rows[i][1]?.trim();
    const label = rows[i][2]?.trim();
    events.push({ eventDate: date, season, location: location || undefined, label: label || undefined });
  }
  return { events, skipped };
}

function downloadEventTemplate() {
  const csv = "Date,Location,Label\n2026-08-31,Hoya Field Concession Stand,Season Opener\n2026-09-07,Hoya Field Concession Stand,\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "hoyas-events-template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AdminSeason() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [addOpen, setAddOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<any>(null);
  const [editSlots, setEditSlots] = useState<{ role: "co_cook" | "kitchen_assistant" | "cashier"; startTime: string; endTime: string }[]>([]);
  const [newDate, setNewDate] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newLocation, setNewLocation] = useState("Lost Mountain Park");
  const [newSeason, setNewSeason] = useState("2026");
  const [newType, setNewType] = useState<"practice" | "game_day">("practice");
  const [gameConfig, setGameConfig] = useState([
    { role: "co_cook" as const, count: 2, startTime: "16:30", endTime: "20:30" },
    { role: "kitchen_assistant" as const, count: 2, startTime: "16:30", endTime: "20:30" },
    { role: "cashier" as const, count: 3, startTime: "17:00", endTime: "21:00" },
  ]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkSeason, setBulkSeason] = useState("2026");
  const [newSeasonName, setNewSeasonName] = useState("");
  const [cronSetupDone, setCronSetupDone] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) navigate("/admin");
  }, [user, loading, navigate]);

  const utils = trpc.useUtils();
  const { data: events, isLoading } = trpc.events.listAll.useQuery(undefined, { enabled: !!user && user.role === "admin" });
  const { data: seasonList } = trpc.seasons.list.useQuery(undefined, { enabled: !!user && user.role === "admin" });
  const { data: currentSeason } = trpc.seasons.current.useQuery();

  useEffect(() => {
    if (currentSeason?.name) { setNewSeason(currentSeason.name); setBulkSeason(currentSeason.name); }
  }, [currentSeason?.name]);

  // Load an event's open slots into editable rows when the Edit dialog opens.
  useEffect(() => {
    if (editEvent) {
      setEditSlots((editEvent.slots ?? []).filter((s: any) => s.isOpen).map((s: any) => ({ role: s.role, startTime: s.startTime ?? "", endTime: s.endTime ?? "" })));
    }
  }, [editEvent?.id]);
  const { data: cronJobs, refetch: refetchCron } = trpc.cron.list.useQuery(undefined, { enabled: !!user && user.role === "admin" });
  const morningReminderJob = cronJobs?.find((j: any) => j.name === "morning-reminders");

  const setupCron = trpc.cron.setupMorningReminder.useMutation({
    onSuccess: (data) => { refetchCron(); setCronSetupDone(true); toast.success(data.alreadyExists ? "Morning reminders already active!" : "Morning reminders scheduled!"); },
    onError: (e) => toast.error(`Failed to schedule: ${e.message}`),
  });

  const deleteCron = trpc.cron.deleteMorningReminder.useMutation({
    onSuccess: () => { refetchCron(); toast.success("Morning reminders disabled"); },
    onError: (e) => toast.error(`Failed to disable: ${e.message}`),
  });

  const { data: notifSettings } = trpc.settings.getNotifications.useQuery(undefined, { enabled: !!user && user.role === "admin" });
  const setNotif = trpc.settings.setNotifications.useMutation({
    onSuccess: () => { utils.settings.getNotifications.invalidate(); toast.success("Notification settings updated"); },
    onError: (e) => toast.error(e.message),
  });

  const createEvent = trpc.events.create.useMutation({
    onSuccess: () => { utils.events.listAll.invalidate(); utils.events.listUpcoming.invalidate(); setAddOpen(false); setNewDate(""); setNewLabel(""); setNewType("practice"); toast.success("Event added!"); },
    onError: (e) => toast.error(e.message),
  });

  const addSeason = trpc.seasons.create.useMutation({
    onSuccess: () => { utils.seasons.list.invalidate(); utils.seasons.current.invalidate(); setNewSeasonName(""); toast.success("Season added!"); },
    onError: (e) => toast.error(e.message),
  });
  const setSeasonCurrent = trpc.seasons.setCurrent.useMutation({
    onSuccess: () => { utils.seasons.list.invalidate(); utils.seasons.current.invalidate(); toast.success("Current season updated"); },
    onError: (e) => toast.error(e.message),
  });

  const bulkCreate = trpc.events.bulkCreate.useMutation({
    onSuccess: (data) => {
      utils.events.listAll.invalidate(); utils.events.listUpcoming.invalidate();
      setBulkOpen(false); setBulkText("");
      if (data.errors.length) toast.warning(`Imported ${data.created} event(s); ${data.errors.length} skipped.`);
      else toast.success(`Imported ${data.created} event(s)!`);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateEvent = trpc.events.update.useMutation({
    onSuccess: () => { utils.events.listAll.invalidate(); utils.events.listUpcoming.invalidate(); setEditEvent(null); toast.success("Event updated!"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteEvent = trpc.events.delete.useMutation({
    onSuccess: () => { utils.events.listAll.invalidate(); utils.events.listUpcoming.invalidate(); utils.volunteers.stats.invalidate(); toast.success("Event deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const navItems = [
    { label: "Dashboard", href: "/admin/dashboard", icon: "grid" },
    { label: "Volunteers", href: "/admin/volunteers", icon: "users" },
    { label: "Season", href: "/admin/season", icon: "calendar" },
    { label: "Public Page", href: "/", icon: "external-link" },
  ];

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" style={{ color: "#003087" }} /></div>;
  if (!user || user.role !== "admin") return null;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Seasons Card */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Seasons</h3>
              <p className="text-xs text-gray-500 mt-0.5">Current: <span className="font-semibold" style={{ color: "#003087" }}>{currentSeason?.name ?? "—"}</span> · new events default to it. Click a season to make it current.</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(seasonList ?? []).map((s: any) => (
                  <button key={s.id} onClick={() => setSeasonCurrent.mutate({ id: s.id })}
                    className="text-xs px-2.5 py-1 rounded-full border transition-colors"
                    style={s.isCurrent ? { backgroundColor: "#003087", color: "#fff", borderColor: "#003087" } : { backgroundColor: "#fff", color: "#003087", borderColor: "#d1d5db" }}
                    title={s.isCurrent ? "Current season" : "Set as current"}>
                    {s.name}{s.isCurrent ? " ✓" : ""}
                  </button>
                ))}
                {(!seasonList || seasonList.length === 0) && <span className="text-xs text-gray-400">No seasons yet</span>}
              </div>
            </div>
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">New season</Label>
                <Input value={newSeasonName} onChange={(e) => setNewSeasonName(e.target.value)} placeholder="2027" className="h-8 w-24 text-sm" />
              </div>
              <Button size="sm" className="h-8 text-xs text-white" style={{ backgroundColor: "#007a35" }}
                onClick={() => { if (!newSeasonName.trim()) { toast.error("Enter a season name"); return; } addSeason.mutate({ name: newSeasonName.trim() }); }}
                disabled={addSeason.isPending}>
                {addSeason.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Plus className="w-3 h-3 mr-1" />Add</>}
              </Button>
            </div>
          </div>
        </div>

        {/* Email Notification Settings Card */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#eef2ff" }}>
              <Mail className="w-5 h-5" style={{ color: "#003087" }} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Email Notifications</h3>
              <p className="text-xs text-gray-500 mt-0.5">Control which automatic emails the app sends.</p>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            <div className="flex items-center justify-between py-3 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-900">Morning reminder emails</p>
                <p className="text-xs text-gray-500">Email volunteers at 8:30 AM ET on their shift day.</p>
              </div>
              <Button size="sm" variant="outline"
                className={`text-xs h-8 flex-shrink-0 ${morningReminderJob?.taskUid ? "border-green-200 text-green-600 hover:bg-green-50" : "border-gray-200 text-gray-400 hover:bg-gray-50"}`}
                disabled={setupCron.isPending || deleteCron.isPending}
                onClick={() => (morningReminderJob?.taskUid ? deleteCron.mutate() : setupCron.mutate())}>
                {setupCron.isPending || deleteCron.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : morningReminderJob?.taskUid ? <><ToggleRight className="w-4 h-4 mr-1" />On</> : <><ToggleLeft className="w-4 h-4 mr-1" />Off</>}
              </Button>
            </div>
            <div className="flex items-center justify-between py-3 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-900">Admin sign-up alerts</p>
                <p className="text-xs text-gray-500">Email admins each time a volunteer signs up.</p>
              </div>
              <Button size="sm" variant="outline"
                className={`text-xs h-8 flex-shrink-0 ${notifSettings?.adminSignupNotifications ? "border-green-200 text-green-600 hover:bg-green-50" : "border-gray-200 text-gray-400 hover:bg-gray-50"}`}
                disabled={setNotif.isPending || !notifSettings}
                onClick={() => setNotif.mutate({ adminSignupNotifications: !notifSettings?.adminSignupNotifications })}>
                {notifSettings?.adminSignupNotifications ? <><ToggleRight className="w-4 h-4 mr-1" />On</> : <><ToggleLeft className="w-4 h-4 mr-1" />Off</>}
              </Button>
            </div>
            <div className="flex items-center justify-between py-3 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-900">Volunteer check-in / no-show emails</p>
                <p className="text-xs text-gray-500">Email the volunteer when you tap Check In or No Show.</p>
              </div>
              <Button size="sm" variant="outline"
                className={`text-xs h-8 flex-shrink-0 ${notifSettings?.volunteerStatusEmails ? "border-green-200 text-green-600 hover:bg-green-50" : "border-gray-200 text-gray-400 hover:bg-gray-50"}`}
                disabled={setNotif.isPending || !notifSettings}
                onClick={() => setNotif.mutate({ volunteerStatusEmails: !notifSettings?.volunteerStatusEmails })}>
                {notifSettings?.volunteerStatusEmails ? <><ToggleRight className="w-4 h-4 mr-1" />On</> : <><ToggleLeft className="w-4 h-4 mr-1" />Off</>}
              </Button>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
            Emails send automatically from noreply@hoyaconcessions.com — no extra setup needed.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{events ? `${events.length} total events` : "Loading..."}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setBulkOpen(true)}
              className="btn-active-scale"
            >
              <Upload className="w-4 h-4 mr-2" />
              Bulk Import
            </Button>
            <Button
              onClick={() => setAddOpen(true)}
              className="text-white btn-active-scale"
              style={{ backgroundColor: "#003087" }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Event
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}</div>
        ) : events && events.length > 0 ? (
          <div className="space-y-2">
            {events.map((event: any) => {
              const openSlots = event.slots.filter((s: any) => s.isOpen).length;
              const totalSlots = event.slots.length;
              return (
                <div key={event.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: event.isActive ? "#003087" : "#ccc" }}>
                      <CalendarDays className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{formatDate(event.eventDate)}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: event.eventType === "game_day" ? "#e6f5ec" : "#e8eef7", color: event.eventType === "game_day" ? "#007a35" : "#003087" }}>{event.eventType === "game_day" ? "Game Day" : "Practice"}</span>
                        <span className="text-xs text-gray-500">Season {event.season}</span>
                        {event.label && <span className="text-xs text-gray-400">· {event.label}</span>}
                        {event.location && <span className="text-xs text-gray-400">· {event.location}</span>}
                        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: openSlots > 0 ? "#e8eef7" : "#e6f5ec", color: openSlots > 0 ? "#003087" : "#007a35" }}>
                          {openSlots}/{totalSlots} open
                        </span>
                        {!event.isActive && <Badge className="text-xs" style={{ backgroundColor: "#f5f5f5", color: "#999", border: "none" }}>Inactive</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      size="sm" variant="outline" className="h-8 px-2 text-xs"
                      onClick={() => updateEvent.mutate({ id: event.id, isActive: !event.isActive })}
                      title={event.isActive ? "Deactivate" : "Activate"}
                    >
                      {event.isActive ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => setEditEvent(event)}>
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm" variant="outline" className="h-8 px-2 text-xs text-red-500 border-red-200"
                      onClick={() => { if (confirm(`Delete event on ${formatDate(event.eventDate)}? This will remove all volunteers.`)) deleteEvent.mutate({ id: event.id }); }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-400">
            <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No events in season</p>
          </div>
        )}
      </div>

      {/* Add Event Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ color: "#003087" }}>Add Concession Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Event Date *</Label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Event Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["practice", "game_day"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNewType(t)}
                    className="rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
                    style={newType === t ? { backgroundColor: "#003087", color: "#fff", borderColor: "#003087" } : { backgroundColor: "#fff", color: "#003087", borderColor: "#d1d5db" }}
                  >
                    {t === "practice" ? "Practice" : "Game Day"}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Select value={newLocation} onValueChange={setNewLocation}>
                <SelectTrigger><SelectValue placeholder="Select a location" /></SelectTrigger>
                <SelectContent>
                  {LOCATIONS.map((loc) => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Season</Label>
              <Select value={newSeason} onValueChange={setNewSeason}>
                <SelectTrigger><SelectValue placeholder="Select season" /></SelectTrigger>
                <SelectContent>
                  {(seasonList ?? []).map((s: any) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Label (optional)</Label>
              <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Homecoming Game" />
            </div>
            {newType === "practice" ? (
              <p className="text-xs text-gray-500">Practice creates the standard slots: Co-Cook ×1 (5:45–8:15 PM), Kitchen Assistant ×1 (5:45–8:15 PM), Cashier ×2 (6:15–8:45 PM).</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Game Day slots</Label>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setGameConfig((c) => [...c, { role: "cashier" as const, count: 1, startTime: "17:00", endTime: "21:00" }])}>
                    <Plus className="w-3 h-3 mr-1" /> Add slot
                  </Button>
                </div>
                <div className="grid grid-cols-[1fr_3rem_auto_auto_1.5rem] items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-400 px-0.5">
                  <span>Role</span><span>Spots</span><span>Start</span><span>End</span><span></span>
                </div>
                {gameConfig.map((rc, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_3rem_auto_auto_1.5rem] items-center gap-1.5 text-xs">
                    <select value={rc.role} onChange={(e) => setGameConfig((c) => c.map((x, i) => i === idx ? { ...x, role: e.target.value as typeof x.role } : x))} className="rounded border border-gray-200 px-1.5 py-1 bg-white">
                      {ROLE_ROWS.map((r) => <option key={r.role} value={r.role}>{r.label}</option>)}
                    </select>
                    <input type="number" min={0} max={20} value={rc.count} onChange={(e) => setGameConfig((c) => c.map((x, i) => i === idx ? { ...x, count: Number(e.target.value) } : x))} className="w-12 rounded border border-gray-200 px-1.5 py-1" title="Spots" />
                    <input type="time" value={rc.startTime} onChange={(e) => setGameConfig((c) => c.map((x, i) => i === idx ? { ...x, startTime: e.target.value } : x))} className="rounded border border-gray-200 px-1 py-1" title="Start" />
                    <input type="time" value={rc.endTime} onChange={(e) => setGameConfig((c) => c.map((x, i) => i === idx ? { ...x, endTime: e.target.value } : x))} className="rounded border border-gray-200 px-1 py-1" title="End" />
                    <button type="button" onClick={() => setGameConfig((c) => c.length > 1 ? c.filter((_, i) => i !== idx) : c)} disabled={gameConfig.length <= 1} className="text-gray-400 hover:text-red-500 disabled:opacity-30" title="Remove slot">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <p className="text-[11px] text-gray-400">Add a row per shift — you can add the same role more than once for different game times.</p>
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setAddOpen(false)} className="flex-1">Cancel</Button>
              <Button
                onClick={() => {
                  if (!newDate) { toast.error("Please select a date"); return; }
                  createEvent.mutate({
                    eventDate: newDate,
                    season: newSeason,
                    label: newLabel || undefined,
                    location: newLocation || undefined,
                    eventType: newType,
                    slotConfig: newType === "game_day" ? gameConfig.map(({ role, count, startTime, endTime }) => ({ role, count, startTime, endTime })) : undefined,
                  });
                }}
                disabled={createEvent.isPending}
                className="flex-1 text-white"
                style={{ backgroundColor: "#003087" }}
              >
                {createEvent.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Event"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Event Dialog */}
      <Dialog open={!!editEvent} onOpenChange={() => setEditEvent(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ color: "#003087" }}>Edit Event</DialogTitle>
          </DialogHeader>
          {editEvent && (
            <div className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label>Event Date</Label>
                <Input
                  type="date"
                  defaultValue={typeof editEvent.eventDate === "string" ? editEvent.eventDate : new Date(editEvent.eventDate).toISOString().split("T")[0]}
                  onChange={(e) => setEditEvent({ ...editEvent, _newDate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Label (optional)</Label>
                <Input
                  defaultValue={editEvent.label ?? ""}
                  onChange={(e) => setEditEvent({ ...editEvent, _newLabel: e.target.value })}
                  placeholder="e.g. Homecoming Game"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Select value={editEvent._newLocation ?? editEvent.location ?? ""} onValueChange={(v) => setEditEvent({ ...editEvent, _newLocation: v })}>
                  <SelectTrigger><SelectValue placeholder="Select a location" /></SelectTrigger>
                  <SelectContent>
                    {LOCATIONS.map((loc) => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {editEvent.eventType === "game_day" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Volunteer slots</Label>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditSlots((c) => [...c, { role: "cashier" as const, startTime: "17:00", endTime: "21:00" }])}>
                      <Plus className="w-3 h-3 mr-1" /> Add slot
                    </Button>
                  </div>
                  {(editEvent.slots ?? []).filter((s: any) => !s.isOpen).map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between rounded border border-gray-100 bg-gray-50 px-2 py-1.5 text-xs text-gray-500">
                      <span>{ROLE_ROWS.find((r) => r.role === s.role)?.label ?? s.role}{s.startTime ? ` · ${s.startTime}–${s.endTime ?? ""}` : ""}</span>
                      <span className="font-medium text-gray-400">● Filled</span>
                    </div>
                  ))}
                  {editSlots.length > 0 && (
                    <div className="grid grid-cols-[1fr_auto_auto_1.5rem] items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-400 px-0.5">
                      <span>Role</span><span>Start</span><span>End</span><span></span>
                    </div>
                  )}
                  {editSlots.map((rc, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_auto_auto_1.5rem] items-center gap-1.5 text-xs">
                      <select value={rc.role} onChange={(e) => setEditSlots((c) => c.map((x, i) => i === idx ? { ...x, role: e.target.value as typeof x.role } : x))} className="rounded border border-gray-200 px-1.5 py-1 bg-white">
                        {ROLE_ROWS.map((r) => <option key={r.role} value={r.role}>{r.label}</option>)}
                      </select>
                      <input type="time" value={rc.startTime} onChange={(e) => setEditSlots((c) => c.map((x, i) => i === idx ? { ...x, startTime: e.target.value } : x))} className="rounded border border-gray-200 px-1 py-1" title="Start" />
                      <input type="time" value={rc.endTime} onChange={(e) => setEditSlots((c) => c.map((x, i) => i === idx ? { ...x, endTime: e.target.value } : x))} className="rounded border border-gray-200 px-1 py-1" title="End" />
                      <button type="button" onClick={() => setEditSlots((c) => c.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-500" title="Remove slot">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <p className="text-[11px] text-gray-400">Open spots are editable. Filled spots are locked — cancel the volunteer from the event roster to free one up.</p>
                </div>
              )}
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setEditEvent(null)} className="flex-1">Cancel</Button>
                <Button
                  onClick={() => updateEvent.mutate({ id: editEvent.id, eventDate: editEvent._newDate, label: editEvent._newLabel, location: editEvent._newLocation, openSlots: editEvent.eventType === "game_day" ? editSlots.map((s) => ({ role: s.role, startTime: s.startTime || undefined, endTime: s.endTime || undefined })) : undefined })}
                  disabled={updateEvent.isPending}
                  className="flex-1 text-white"
                  style={{ backgroundColor: "#003087" }}
                >
                  {updateEvent.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ color: "#003087" }}>Bulk Import Events</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-xs text-gray-500">One row per game night — columns <b>Date, Location, Label</b> (Location/Label optional). Dates accept <b>YYYY-MM-DD</b> or <b>M/D/YYYY</b>. Each event auto-creates the 4 standard slots (Co-Cook, Kitchen Assistant, 2× Cashier).</p>
            <Button type="button" variant="outline" size="sm" onClick={downloadEventTemplate} className="h-8 text-xs">
              <Download className="w-3.5 h-3.5 mr-1.5" /> Download CSV template
            </Button>
            <div className="space-y-1.5">
              <Label>Season</Label>
              <Select value={bulkSeason} onValueChange={setBulkSeason}>
                <SelectTrigger><SelectValue placeholder="Select season" /></SelectTrigger>
                <SelectContent>
                  {(seasonList ?? []).map((s: any) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Upload CSV file (or paste below)</Label>
              <Input type="file" accept=".csv,text/csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) f.text().then(setBulkText); }} />
            </div>
            <textarea
              className="w-full h-40 rounded-md border border-gray-200 p-2 text-sm font-mono focus:outline-none focus:ring-2"
              placeholder={"Date,Location,Label\n2026-08-31,Hoya Field Concession Stand,Season Opener\n2026-09-07,Hoya Field Concession Stand"}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
            />
            {bulkText.trim() && (() => {
              const { events: parsed, skipped } = parseEventsCsv(bulkText, bulkSeason);
              return (
                <p className="text-xs">
                  <span className="font-semibold" style={{ color: "#007a35" }}>{parsed.length} event(s) ready</span>
                  {skipped > 0 && <span className="text-orange-600"> · {skipped} row(s) skipped (bad date)</span>}
                </p>
              );
            })()}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setBulkOpen(false)} className="flex-1">Cancel</Button>
              <Button
                onClick={() => {
                  const { events: parsed } = parseEventsCsv(bulkText, bulkSeason);
                  if (parsed.length === 0) { toast.error("No valid rows found. Check the date column."); return; }
                  bulkCreate.mutate({ events: parsed });
                }}
                disabled={bulkCreate.isPending}
                className="flex-1 text-white"
                style={{ backgroundColor: "#003087" }}
              >
                {bulkCreate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Import Events"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
