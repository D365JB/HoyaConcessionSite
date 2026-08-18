import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CalendarLtr24Regular as CalendarDays, Clock24Regular as Clock, People24Regular as Users, ChevronDown24Regular as ChevronDown, ChevronUp24Regular as ChevronUp, CheckmarkCircle24Regular as CheckCircle2, ErrorCircle24Regular as AlertCircle, SpinnerIos20Regular as Loader2 } from "@fluentui/react-icons";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; time: string; description: string; requirements: string[] }> = {
  co_cook: {
    label: "Co-Cook",
    time: "5:45 PM – 8:15 PM",
    description: "Prepare food, follow food safety procedures, stock food, assist with kitchen cleanup.",
    requirements: ["Closed-toe shoes required", "Arrive by 5:35 PM", "Training provided"],
  },
  kitchen_assistant: {
    label: "Kitchen Assistant",
    time: "5:45 PM – 8:15 PM",
    description: "Prepare baskets, restock supplies, assist the cook, kitchen cleanup.",
    requirements: ["Closed-toe shoes required", "Arrive by 5:35 PM", "Training provided"],
  },
  cashier: {
    label: "Cashier",
    time: "6:15 PM – 8:45 PM",
    description: "Take orders, process payments, customer service, sweep and mop before leaving.",
    requirements: ["Closed-toe shoes required", "Arrive by 6:05 PM", "Training provided"],
  },
};

const ROLE_ORDER = ["co_cook", "kitchen_assistant", "cashier"];

function formatClock(hhmm?: string | null): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return "";
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m || 0).padStart(2, "0")} ${period}`;
}

function slotRange(slot: { startTime?: string | null; endTime?: string | null } | undefined, fallback: string): string {
  if (slot?.startTime && slot?.endTime) return `${formatClock(slot.startTime)} – ${formatClock(slot.endTime)}`;
  return fallback;
}

const signupSchema = z.object({
  parentName: z.string().min(2, "Parent name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(7, "Phone number is required"),
  childName: z.string().min(1, "Child name is required"),
  sport: z.enum(["football", "cheer"]),
  grade: z.enum(["K-1", "2nd", "3rd", "4th", "5th"]),
});
type SignupForm = z.infer<typeof signupSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEventDate(dateVal: string | Date): string {
  const s = typeof dateVal === "string" ? dateVal : dateVal.toISOString();
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function formatShortDate(dateVal: string | Date): string {
  const s = typeof dateVal === "string" ? dateVal : dateVal.toISOString();
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

// ─── Signup Dialog ────────────────────────────────────────────────────────────

function SignupDialog({
  open,
  onClose,
  slot,
  event,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  slot: { id: number; role: string; startTime?: string | null; endTime?: string | null } | null;
  event: { id: number; eventDate: string | Date } | null;
  onSuccess: () => void;
}) {
  const utils = trpc.useUtils();
  const signup = trpc.volunteers.signup.useMutation({
    onSuccess: () => {
      toast.success("You're signed up! Check your email for confirmation.");
      utils.events.listUpcoming.invalidate();
      onSuccess();
      onClose();
    },
    onError: (err) => {
      toast.error(err.message || "Signup failed. Please try again.");
    },
  });

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  });

  const roleMeta = slot ? ROLE_META[slot.role] : null;

  const onSubmit = (data: SignupForm) => {
    if (!slot || !event) return;
    signup.mutate({ ...data, slotId: slot.id, eventId: event.id });
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: "#003087" }}>
              {roleMeta?.label.charAt(0)}
            </div>
            <div>
              <DialogTitle className="text-lg font-bold" style={{ color: "#003087" }}>
                Sign Up: {roleMeta?.label}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">{event ? formatEventDate(event.eventDate) : ""}</p>
            </div>
          </div>
          {roleMeta && (
            <div className="rounded-lg p-3 text-sm mt-2" style={{ backgroundColor: "#e8eef7" }}>
              <p className="font-semibold mb-1" style={{ color: "#003087" }}>
                <Clock className="inline w-3.5 h-3.5 mr-1" />{slotRange(slot ?? undefined, roleMeta.time)}
              </p>
              <p className="text-gray-700 mb-2">{roleMeta.description}</p>
              <ul className="space-y-0.5">
                {roleMeta.requirements.map((r) => (
                  <li key={r} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <CheckCircle2 className="w-3 h-3 flex-shrink-0" style={{ color: "#009A44" }} />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="parentName">Parent Name *</Label>
              <Input id="parentName" placeholder="Jane Smith" {...register("parentName")} />
              {errors.parentName && <p className="text-xs text-destructive">{errors.parentName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" placeholder="jane@email.com" {...register("email")} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone *</Label>
              <Input id="phone" type="tel" placeholder="(555) 555-5555" {...register("phone")} />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="childName">Child's Name *</Label>
              <Input id="childName" placeholder="Alex Smith" {...register("childName")} />
              {errors.childName && <p className="text-xs text-destructive">{errors.childName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Sport *</Label>
              <Controller
                name="sport"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select sport" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="football">Football</SelectItem>
                      <SelectItem value="cheer">Cheer</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.sport && <p className="text-xs text-destructive">{errors.sport.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Grade *</Label>
              <Controller
                name="grade"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select grade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="K-1">K–1</SelectItem>
                      <SelectItem value="2nd">2nd</SelectItem>
                      <SelectItem value="3rd">3rd</SelectItem>
                      <SelectItem value="4th">4th</SelectItem>
                      <SelectItem value="5th">5th</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.grade && <p className="text-xs text-destructive">{errors.grade.message}</p>}
            </div>
          </div>

          <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: "#e6f5ec", borderLeft: "3px solid #009A44" }}>
            <p className="font-semibold mb-1" style={{ color: "#007a35" }}>Volunteer Requirements</p>
            <ul className="space-y-0.5 text-gray-700">
              <li>• Volunteers must be at least 15 years old</li>
              <li>• Closed-toe shoes required</li>
              <li>• Arrive 10 minutes before your shift</li>
              <li>• Training will be provided on-site</li>
            </ul>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={signup.isPending}
              className="flex-1 text-white font-semibold btn-active-scale"
              style={{ backgroundColor: "#003087" }}
            >
              {signup.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing up...</> : "Confirm Sign Up"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({
  event,
  onSelectSlot,
}: {
  event: any;
  onSelectSlot: (slot: any, event: any) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const openSlots = event.slots.filter((s: any) => s.isOpen);
  const totalSlots = event.slots.length;
  const filledSlots = totalSlots - openSlots.length;

  const groupedSlots = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const role of ROLE_ORDER) {
      groups[role] = event.slots.filter((s: any) => s.role === role);
    }
    return groups;
  }, [event.slots]);

  // Group by role + shift time so game days with multiple time blocks show each shift.
  const shiftGroups = useMemo(() => {
    const map = new Map<string, { role: string; startTime: string | null; endTime: string | null; slots: any[] }>();
    for (const s of event.slots) {
      const key = `${s.role}|${s.startTime ?? ""}|${s.endTime ?? ""}`;
      const g = map.get(key) ?? { role: s.role, startTime: s.startTime ?? null, endTime: s.endTime ?? null, slots: [] as any[] };
      g.slots.push(s);
      map.set(key, g);
    }
    return Array.from(map.values()).sort((a, b) => {
      const ra = ROLE_ORDER.indexOf(a.role), rb = ROLE_ORDER.indexOf(b.role);
      return ra !== rb ? ra - rb : (a.startTime ?? "").localeCompare(b.startTime ?? "");
    });
  }, [event.slots]);

  const isFull = openSlots.length === 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-200 hover:shadow-md">
      {/* Header */}
      <div className="p-4 sm:p-5" style={{ borderLeft: `4px solid ${isFull ? "#009A44" : "#003087"}` }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: "#003087" }}>
              <span className="text-lg leading-none">
                {typeof event.eventDate === "string"
                  ? (() => { const s = typeof event.eventDate === "string" ? event.eventDate : event.eventDate.toISOString(); const [y,m,d] = s.slice(0,10).split("-").map(Number); return new Date(Date.UTC(y,m-1,d,12,0,0)).getUTCDate(); })()
                  : new Date(event.eventDate).getUTCDate()}
              </span>
              <span className="text-[10px] uppercase opacity-80">
                {typeof event.eventDate === "string"
                  ? (() => { const s = typeof event.eventDate === "string" ? event.eventDate : event.eventDate.toISOString(); const [y,m,d] = s.slice(0,10).split("-").map(Number); return new Date(Date.UTC(y,m-1,d,12,0,0)).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }); })()
                  : new Date(event.eventDate).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}
              </span>
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900 text-base leading-tight">{formatEventDate(event.eventDate)}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge className="text-xs px-2 py-0" style={{ backgroundColor: event.eventType === "game_day" ? "#e6f5ec" : "#e8eef7", color: event.eventType === "game_day" ? "#007a35" : "#003087" }}>
                  {event.eventType === "game_day" ? "Game Day" : "Practice"}
                </Badge>
                {event.location && <span className="text-xs text-gray-500">📍 {event.location}</span>}
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {filledSlots}/{totalSlots} filled
                </span>
                {isFull ? (
                  <Badge className="text-xs px-2 py-0" style={{ backgroundColor: "#e6f5ec", color: "#007a35" }}>
                    <CheckCircle2 className="w-3 h-3 mr-1" />Fully Staffed
                  </Badge>
                ) : (
                  <Badge className="text-xs px-2 py-0" style={{ backgroundColor: "#e8eef7", color: "#003087" }}>
                    {openSlots.length} open
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
          </button>
        </div>

        {/* Slot summary pills */}
        {!expanded && (
          <div className="flex flex-wrap gap-2 mt-3">
            {ROLE_ORDER.map((role) => {
              const slots = groupedSlots[role] || [];
              const open = slots.filter((s: any) => s.isOpen);
              if (slots.length === 0) return null;
              return (
                <span
                  key={role}
                  className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{
                    backgroundColor: open.length > 0 ? "#e8eef7" : "#f0f0f0",
                    color: open.length > 0 ? "#003087" : "#999",
                  }}
                >
                  {ROLE_META[role]?.label}
                  {slots.length > 1 ? ` (${open.length}/${slots.length})` : open.length === 0 ? " ✓" : ""}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Expanded roles */}
      {expanded && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {shiftGroups.map((group, gi) => {
            const slots = group.slots;
            const meta = ROLE_META[group.role];
            if (!meta || slots.length === 0) return null;
            return (
              <div key={gi} className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-gray-900">{meta.label}</h4>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />{slotRange(slots[0], meta.time)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{meta.description}</p>
                    <ul className="mt-2 space-y-0.5">
                      {meta.requirements.map((r) => (
                        <li key={r} className="text-xs text-gray-500 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 flex-shrink-0" style={{ color: "#009A44" }} />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {slots.map((slot: any, idx: number) => (
                    <div key={slot.id} className="flex items-center gap-2">
                      {slot.isOpen ? (
                        <Button
                          size="sm"
                          onClick={() => onSelectSlot(slot, event)}
                          className="text-white font-semibold btn-active-scale h-8 px-4 text-sm"
                          style={{ backgroundColor: "#007a35" }}
                        >
                          {slots.length > 1 ? `Sign Up (Slot ${idx + 1})` : "Sign Up"}
                        </Button>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium"
                          style={{ backgroundColor: "#f0f0f0", color: "#999" }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {slots.length > 1 ? `Slot ${idx + 1} Filled` : "Filled"}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  const { data: events, isLoading, error } = trpc.events.listUpcoming.useQuery();
  const { data: currentSeason } = trpc.seasons.current.useQuery();
  const [selectedSlot, setSelectedSlot] = useState<{ id: number; role: string; startTime?: string | null; endTime?: string | null } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<{ id: number; eventDate: string | Date } | null>(null);
  const [signupOpen, setSignupOpen] = useState(false);
  const [successEvent, setSuccessEvent] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "practice" | "game_day">("all");
  const [openOnly, setOpenOnly] = useState(true);

  const filteredEvents = (events ?? []).filter((e: any) => {
    if (typeFilter !== "all" && e.eventType !== typeFilter) return false;
    if (openOnly && !(e.slots ?? []).some((s: any) => s.isOpen)) return false;
    return true;
  });

  const handleSelectSlot = (slot: any, event: any) => {
    setSelectedSlot(slot);
    setSelectedEvent(event);
    setSignupOpen(true);
  };

  const handleSignupSuccess = () => {
    setSuccessEvent(selectedEvent ? formatEventDate(selectedEvent.eventDate) : "");
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f5f7fa" }}>
      {/* Header */}
      <header style={{ backgroundColor: "#003087" }} className="sticky top-0 z-40 shadow-lg">
        <div className="container py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Hoyas logo" className="w-10 h-10 sm:w-12 sm:h-12" />
              <div>
                <h1 className="text-white font-black text-lg sm:text-xl leading-tight" style={{ fontFamily: "Montserrat, sans-serif" }}>
                  HOYAS CONCESSION
                </h1>
                <p className="text-xs sm:text-sm font-semibold tracking-wide" style={{ color: "#009A44" }}>
                  VOLUNTEER SIGN-UP
                </p>
              </div>
            </div>
            <a
              href="/admin"
              className="text-xs sm:text-sm text-white/70 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10"
            >
              Admin
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #003087 0%, #002060 60%, #009A44 100%)" }} className="py-10 sm:py-14">
        <div className="container text-center">
          <h2 className="text-2xl sm:text-4xl font-black text-white mb-3" style={{ fontFamily: "Montserrat, sans-serif" }}>
            Volunteer at the Concession Stand
          </h2>
          <p className="text-white/80 text-base sm:text-lg max-w-xl mx-auto mb-6">
            Support our Hoya athletes by volunteering for concession stand duties. Choose a date and role below to sign up.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            {[
              { icon: "🏈", text: "Football & Cheer" },
              { icon: "🍔", text: "Concession Stand" },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 text-white">
                <span>{icon}</span>
                <span className="font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Info Bar */}
      <div style={{ backgroundColor: "#007a35" }} className="py-3">
        <div className="container">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-white text-xs sm:text-sm font-medium">
            <span>✓ Volunteers must be 15+</span>
            <span>✓ Closed-toe shoes required</span>
            <span>✓ Arrive 10 min early</span>
            <span>✓ Training provided</span>
          </div>
        </div>
      </div>

      {/* Success Banner */}
      {successEvent && (
        <div className="container mt-6">
          <div className="rounded-xl p-4 flex items-start gap-3" style={{ backgroundColor: "#e6f5ec", border: "1px solid #009A44" }}>
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#009A44" }} />
            <div>
              <p className="font-semibold" style={{ color: "#007a35" }}>You're signed up!</p>
              <p className="text-sm text-gray-700">You've been registered for <strong>{successEvent}</strong>. Check your email for a confirmation.</p>
            </div>
            <button onClick={() => setSuccessEvent(null)} aria-label="Dismiss confirmation" className="ml-auto text-gray-400 hover:text-gray-600">✕</button>
          </div>
        </div>
      )}

      {/* Events List */}
      <main className="container py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Upcoming Opportunities
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {events ? `${filteredEvents.length} shown · Click an event to see open positions` : "Loading schedule..."}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <CalendarDays className="w-4 h-4" />
            <span>{currentSeason?.name ?? "2026"} Season</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 mb-5">
          {([["all", "All"], ["practice", "Practices"], ["game_day", "Game Days"]] as const).map(([val, lbl]) => (
            <button
              key={val}
              onClick={() => setTypeFilter(val)}
              className="text-sm font-semibold px-5 py-2.5 rounded-full border transition-colors"
              style={typeFilter === val ? { backgroundColor: "#003087", color: "#fff", borderColor: "#003087" } : { backgroundColor: "#fff", color: "#003087", borderColor: "#d1d5db" }}
            >
              {lbl}
            </button>
          ))}
          <button
            onClick={() => setOpenOnly((v) => !v)}
            className="text-sm font-semibold px-5 py-2.5 rounded-full border transition-colors ml-auto"
            style={openOnly ? { backgroundColor: "#007a35", color: "#fff", borderColor: "#007a35" } : { backgroundColor: "#fff", color: "#007a35", borderColor: "#d1d5db" }}
          >
            {openOnly ? "✓ Open spots only" : "Open spots only"}
          </button>
        </div>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#003087" }} />
            <p className="text-gray-500">Loading schedule...</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl p-6 text-center" style={{ backgroundColor: "#fff3f3", border: "1px solid #ffcccc" }}>
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-400" />
            <p className="text-red-600 font-medium">Failed to load schedule</p>
            <p className="text-sm text-red-400 mt-1">Please refresh the page to try again.</p>
          </div>
        )}

        {events && events.length === 0 && (
          <div className="text-center py-20">
            <CalendarDays className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">No upcoming events</p>
            <p className="text-sm text-gray-400 mt-1">Check back soon for the next practice night schedule.</p>
          </div>
        )}

        {events && events.length > 0 && (
          <div className="space-y-3">
            {filteredEvents.length === 0 ? (
              <p className="text-center text-gray-400 py-10 text-sm">No opportunities match this filter.</p>
            ) : filteredEvents.map((event: any) => (
              <EventCard key={event.id} event={event} onSelectSlot={handleSelectSlot} />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ backgroundColor: "#003087" }} className="mt-12 py-8">
        <div className="container text-center">
          <p className="text-white font-bold text-lg mb-1" style={{ fontFamily: "Montserrat, sans-serif" }}>HOYAS YOUTH SPORTS</p>
          <p className="text-white/60 text-sm">Concession Volunteer Program · {currentSeason?.name ?? "2026"} Season</p>
          <p className="text-white/40 text-xs mt-3">Questions? Contact your team coordinator.</p>
        </div>
      </footer>

      <SignupDialog
        open={signupOpen}
        onClose={() => setSignupOpen(false)}
        slot={selectedSlot}
        event={selectedEvent}
        onSuccess={handleSignupSuccess}
      />
    </div>
  );
}
