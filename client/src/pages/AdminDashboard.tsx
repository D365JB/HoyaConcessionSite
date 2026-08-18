import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SpinnerIos20Regular as Loader2, People24Regular as Users, CalendarLtr24Regular as CalendarDays, CheckmarkCircle24Regular as CheckCircle2, ErrorCircle24Regular as AlertCircle, Clock24Regular as Clock } from "@fluentui/react-icons";

const ROLE_LABELS: Record<string, string> = {
  co_cook: "Co-Cook",
  kitchen_assistant: "Kitchen Assistant",
  cashier: "Cashier",
  volunteer: "Volunteer",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  confirmed: { label: "Confirmed", color: "#003087", bg: "#e8eef7" },
  checked_in: { label: "Checked In", color: "#007a35", bg: "#e6f5ec" },
  completed: { label: "Completed", color: "#5c5c00", bg: "#fffde7" },
  no_show: { label: "No Show", color: "#c62828", bg: "#ffebee" },
  canceled: { label: "Canceled", color: "#757575", bg: "#f5f5f5" },
};

function formatDate(dateVal: string | Date): string {
  const s = typeof dateVal === "string" ? dateVal : dateVal.toISOString();
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

export default function AdminDashboard() {
  useDocumentTitle("Dashboard · Hoyas Concession Admin");
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate("/admin");
    if (!loading && user && user.role !== "admin") navigate("/admin");
  }, [user, loading, navigate]);

  const { data: stats, isLoading: statsLoading } = trpc.volunteers.stats.useQuery(undefined, { enabled: !!user && user.role === "admin" });
  const { data: todayVolunteers, isLoading: todayLoading } = trpc.volunteers.today.useQuery(undefined, { enabled: !!user && user.role === "admin" });
  const { data: upcomingEvents, isLoading: eventsLoading } = trpc.events.listUpcoming.useQuery(undefined, { enabled: !!user && user.role === "admin" });

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" style={{ color: "#003087" }} /></div>;
  }

  if (!user || user.role !== "admin") return null;

  const navItems = [
    { label: "Dashboard", href: "/admin/dashboard", icon: "grid" },
    { label: "Volunteers", href: "/admin/volunteers", icon: "users" },
    { label: "Season", href: "/admin/season", icon: "calendar" },
    { label: "Public Page", href: "/", icon: "external-link" },
  ];

  const statCards = [
    { title: "Total Volunteers", value: stats?.totalVolunteers ?? 0, icon: Users, color: "#003087", bg: "#e8eef7" },
    { title: "Today's Volunteers", value: stats?.todayCount ?? 0, icon: CheckCircle2, color: "#009A44", bg: "#e6f5ec" },
    { title: "Open Slots", value: stats?.openSlots ?? 0, icon: AlertCircle, color: "#f57c00", bg: "#fff3e0" },
    { title: "Upcoming Events", value: stats?.upcomingEvents ?? 0, icon: CalendarDays, color: "#7b1fa2", bg: "#f3e5f5" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(({ title, value, icon: Icon, color, bg }) => (
            <Card key={title} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-500">{title}</p>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: bg }}>
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                </div>
                {statsLoading ? (
                  <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
                ) : (
                  <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Volunteers */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2" style={{ color: "#003087" }}>
                <Clock className="w-4 h-4" />
                Today's Volunteers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {todayLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}</div>
              ) : todayVolunteers && todayVolunteers.length > 0 ? (
                <div className="space-y-2">
                  {todayVolunteers.map((row: any) => {
                    const sc = STATUS_CONFIG[row.volunteer.status] ?? STATUS_CONFIG.confirmed;
                    return (
                      <div key={row.volunteer.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-gray-900 truncate">{row.volunteer.parentName}</p>
                          <p className="text-xs text-gray-500">{ROLE_LABELS[row.slot.role] ?? row.slot.role}</p>
                        </div>
                        <Badge className="text-xs flex-shrink-0 ml-2" style={{ backgroundColor: sc.bg, color: sc.color, border: "none" }}>
                          {sc.label}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No volunteers scheduled today</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Events */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2" style={{ color: "#003087" }}>
                <CalendarDays className="w-4 h-4" />
                Upcoming Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              {eventsLoading ? (
                <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
              ) : upcomingEvents && upcomingEvents.length > 0 ? (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {upcomingEvents.slice(0, 10).map((event: any) => {
                    const openSlots = event.slots.filter((s: any) => s.isOpen).length;
                    return (
                      <div key={event.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                        <span className="text-sm font-medium text-gray-800">{formatDate(event.eventDate)}</span>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: openSlots > 0 ? "#e8eef7" : "#e6f5ec", color: openSlots > 0 ? "#003087" : "#007a35" }}>
                          {openSlots > 0 ? `${openSlots} open` : "Full"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No upcoming events</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
