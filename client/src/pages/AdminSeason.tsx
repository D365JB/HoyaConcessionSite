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
import { Plus, Trash2, Edit2, Loader2, CalendarDays, ToggleLeft, ToggleRight, Bell, BellOff, CheckCircle2 } from "lucide-react";

function formatDate(dateVal: string | Date): string {
  const d = typeof dateVal === "string" ? new Date(dateVal + "T12:00:00") : new Date(dateVal);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export default function AdminSeason() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [addOpen, setAddOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<any>(null);
  const [newDate, setNewDate] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newSeason, setNewSeason] = useState("2026");
  const [cronSetupDone, setCronSetupDone] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) navigate("/admin");
  }, [user, loading, navigate]);

  const utils = trpc.useUtils();
  const { data: events, isLoading } = trpc.events.listAll.useQuery(undefined, { enabled: !!user && user.role === "admin" });
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

  const createEvent = trpc.events.create.useMutation({
    onSuccess: () => { utils.events.listAll.invalidate(); utils.events.listUpcoming.invalidate(); setAddOpen(false); setNewDate(""); setNewLabel(""); toast.success("Event added!"); },
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
        {/* Morning Reminders Cron Card */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: morningReminderJob?.taskUid ? "#e6f5ec" : "#f5f5f5" }}>
                {morningReminderJob?.taskUid ? <Bell className="w-5 h-5" style={{ color: "#009A44" }} /> : <BellOff className="w-5 h-5 text-gray-400" />}
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Morning Reminder Emails</h3>
                <p className="text-xs text-gray-500 mt-0.5">Automatically emails volunteers at 8:30 AM on their shift day.</p>
                {morningReminderJob?.taskUid ? (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#009A44" }} />
                    <span className="text-xs font-medium" style={{ color: "#007a35" }}>Active — runs daily at 8:30 AM ET</span>
                  </div>
                ) : (
                  <p className="text-xs text-orange-600 mt-1.5 font-medium">Not scheduled — click Enable to activate</p>
                )}
              </div>
            </div>
            <div className="flex-shrink-0">
              {morningReminderJob?.taskUid ? (
                <Button size="sm" variant="outline" className="text-xs h-8 border-red-200 text-red-500 hover:bg-red-50"
                  onClick={() => deleteCron.mutate()} disabled={deleteCron.isPending}>
                  {deleteCron.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><BellOff className="w-3 h-3 mr-1" />Disable</>}
                </Button>
              ) : (
                <Button size="sm" className="text-xs h-8 text-white" style={{ backgroundColor: "#009A44" }}
                  onClick={() => setupCron.mutate()} disabled={setupCron.isPending}>
                  {setupCron.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Bell className="w-3 h-3 mr-1" />Enable</>}
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-amber-600 mt-3 pt-3 border-t border-gray-100">
            Note: SMTP credentials must be configured in Settings → Secrets for emails to send.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{events ? `${events.length} total events` : "Loading..."}</p>
          </div>
          <Button
            onClick={() => setAddOpen(true)}
            className="text-white btn-active-scale"
            style={{ backgroundColor: "#003087" }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Event
          </Button>
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
                        <span className="text-xs text-gray-500">Season {event.season}</span>
                        {event.label && <span className="text-xs text-gray-400">· {event.label}</span>}
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
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ color: "#003087" }}>Add Concession Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Event Date *</Label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Season</Label>
              <Input value={newSeason} onChange={(e) => setNewSeason(e.target.value)} placeholder="2026" />
            </div>
            <div className="space-y-1.5">
              <Label>Label (optional)</Label>
              <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Homecoming Game" />
            </div>
            <p className="text-xs text-gray-500">Adding an event will automatically create 5 volunteer slots (Co-Cook, Kitchen Assistant, Runner, 2× Cashier).</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setAddOpen(false)} className="flex-1">Cancel</Button>
              <Button
                onClick={() => { if (!newDate) { toast.error("Please select a date"); return; } createEvent.mutate({ eventDate: newDate, season: newSeason, label: newLabel || undefined }); }}
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
        <DialogContent className="max-w-sm">
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
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setEditEvent(null)} className="flex-1">Cancel</Button>
                <Button
                  onClick={() => updateEvent.mutate({ id: editEvent.id, eventDate: editEvent._newDate, label: editEvent._newLabel })}
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
    </DashboardLayout>
  );
}
