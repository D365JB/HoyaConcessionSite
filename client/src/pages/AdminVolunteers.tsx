import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Search, Download, Loader2, Edit2, Trash2, CheckCircle2, XCircle, UserCheck, UserX, RotateCcw } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as XLSX from "xlsx";

const ROLE_LABELS: Record<string, string> = {
  co_cook: "Co-Cook",
  kitchen_assistant: "Kitchen Assistant",
  runner: "Runner",
  cashier: "Cashier",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  confirmed: { label: "Confirmed", color: "#003087", bg: "#e8eef7" },
  checked_in: { label: "Checked In", color: "#007a35", bg: "#e6f5ec" },
  completed: { label: "Completed", color: "#5c5c00", bg: "#fffde7" },
  no_show: { label: "No Show", color: "#c62828", bg: "#ffebee" },
  canceled: { label: "Canceled", color: "#757575", bg: "#f5f5f5" },
};

function formatDate(dateVal: string | Date): string {
  const d = typeof dateVal === "string" ? new Date(dateVal + "T12:00:00") : new Date(dateVal);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

const editSchema = z.object({
  parentName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7),
  childName: z.string().min(1),
  sport: z.enum(["football", "cheer"]),
  grade: z.enum(["K-1", "2nd", "3rd", "4th", "5th"]),
  notes: z.string().optional(),
});
type EditForm = z.infer<typeof editSchema>;

export default function AdminVolunteers() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editVolunteer, setEditVolunteer] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) navigate("/admin");
  }, [user, loading, navigate]);

  const utils = trpc.useUtils();

  const { data: volunteers, isLoading } = trpc.volunteers.list.useQuery(
    { search: search || undefined, status: statusFilter !== "all" ? statusFilter : undefined },
    { enabled: !!user && user.role === "admin" }
  );

  const updateStatus = trpc.volunteers.updateStatus.useMutation({
    onSuccess: () => { utils.volunteers.list.invalidate(); utils.volunteers.stats.invalidate(); utils.volunteers.today.invalidate(); toast.success("Status updated"); },
    onError: (e) => toast.error(e.message),
  });

  const updateVolunteer = trpc.volunteers.update.useMutation({
    onSuccess: () => { utils.volunteers.list.invalidate(); setEditVolunteer(null); toast.success("Volunteer updated"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteVolunteer = trpc.volunteers.delete.useMutation({
    onSuccess: () => { utils.volunteers.list.invalidate(); utils.volunteers.stats.invalidate(); setDeleteConfirm(null); toast.success("Volunteer removed"); },
    onError: (e) => toast.error(e.message),
  });

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<EditForm>({ resolver: zodResolver(editSchema) });

  const openEdit = (row: any) => {
    setEditVolunteer(row);
    reset({
      parentName: row.volunteer.parentName,
      email: row.volunteer.email,
      phone: row.volunteer.phone,
      childName: row.volunteer.childName,
      sport: row.volunteer.sport,
      grade: row.volunteer.grade,
      notes: row.volunteer.notes ?? "",
    });
  };

  const onEditSubmit = (data: EditForm) => {
    if (!editVolunteer) return;
    updateVolunteer.mutate({ id: editVolunteer.volunteer.id, ...data });
  };

  const handleExport = () => {
    if (!volunteers) return;
    const rows = volunteers.map((row: any) => ({
      "Parent Name": row.volunteer.parentName,
      "Email": row.volunteer.email,
      "Phone": row.volunteer.phone,
      "Child Name": row.volunteer.childName,
      "Sport": row.volunteer.sport === "football" ? "Football" : "Cheer",
      "Grade": row.volunteer.grade,
      "Event Date": formatDate(row.event.eventDate),
      "Role": ROLE_LABELS[row.slot.role] ?? row.slot.role,
      "Status": STATUS_CONFIG[row.volunteer.status]?.label ?? row.volunteer.status,
      "Signed Up": new Date(row.volunteer.createdAt).toLocaleDateString(),
      "Notes": row.volunteer.notes ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Volunteers");
    XLSX.writeFile(wb, `hoyas-volunteers-${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Export downloaded!");
  };

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
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="checked_in">Checked In</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="no_show">No Show</SelectItem>
              <SelectItem value="canceled">Canceled</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={handleExport}
            disabled={!volunteers || volunteers.length === 0}
            className="text-white btn-active-scale flex-shrink-0"
            style={{ backgroundColor: "#009A44" }}
          >
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
        </div>

        {/* Count */}
        <p className="text-sm text-gray-500">{volunteers ? `${volunteers.length} volunteer${volunteers.length !== 1 ? "s" : ""}` : "Loading..."}</p>

        {/* Table / Cards */}
        {isLoading ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}</div>
        ) : volunteers && volunteers.length > 0 ? (
          <div className="space-y-2">
            {volunteers.map((row: any) => {
              const sc = STATUS_CONFIG[row.volunteer.status] ?? STATUS_CONFIG.confirmed;
              return (
                <div key={row.volunteer.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-gray-900">{row.volunteer.parentName}</span>
                        <Badge style={{ backgroundColor: sc.bg, color: sc.color, border: "none" }} className="text-xs">
                          {sc.label}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-500 space-y-0.5">
                        <p>{row.volunteer.email} · {row.volunteer.phone}</p>
                        <p>Child: <span className="text-gray-700">{row.volunteer.childName}</span> · {row.volunteer.grade} · {row.volunteer.sport === "football" ? "Football" : "Cheer"}</p>
                        <p className="font-medium" style={{ color: "#003087" }}>
                          {formatDate(row.event.eventDate)} · {ROLE_LABELS[row.slot.role] ?? row.slot.role}
                        </p>
                        {row.volunteer.notes && <p className="text-xs italic text-gray-400">Note: {row.volunteer.notes}</p>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      {/* Status Actions */}
                      <div className="flex gap-1.5 flex-wrap justify-end">
                        {row.volunteer.status !== "checked_in" && row.volunteer.status !== "canceled" && (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" style={{ borderColor: "#009A44", color: "#009A44" }}
                            onClick={() => updateStatus.mutate({ id: row.volunteer.id, status: "checked_in" })}>
                            <UserCheck className="w-3 h-3 mr-1" />Check In
                          </Button>
                        )}
                        {row.volunteer.status === "checked_in" && (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" style={{ borderColor: "#5c5c00", color: "#5c5c00" }}
                            onClick={() => updateStatus.mutate({ id: row.volunteer.id, status: "completed" })}>
                            <CheckCircle2 className="w-3 h-3 mr-1" />Complete
                          </Button>
                        )}
                        {row.volunteer.status !== "no_show" && row.volunteer.status !== "canceled" && row.volunteer.status !== "completed" && (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" style={{ borderColor: "#c62828", color: "#c62828" }}
                            onClick={() => updateStatus.mutate({ id: row.volunteer.id, status: "no_show" })}>
                            <UserX className="w-3 h-3 mr-1" />No Show
                          </Button>
                        )}
                        {row.volunteer.status !== "canceled" && (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-gray-500"
                            onClick={() => updateStatus.mutate({ id: row.volunteer.id, status: "canceled" })}>
                            <XCircle className="w-3 h-3 mr-1" />Cancel
                          </Button>
                        )}
                        {row.volunteer.status === "canceled" && (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" style={{ borderColor: "#003087", color: "#003087" }}
                            onClick={() => updateStatus.mutate({ id: row.volunteer.id, status: "confirmed" })}>
                            <RotateCcw className="w-3 h-3 mr-1" />Restore
                          </Button>
                        )}
                      </div>
                      {/* Edit / Delete */}
                      <div className="flex gap-1.5 justify-end">
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => openEdit(row)}>
                          <Edit2 className="w-3 h-3 mr-1" />Edit
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-red-500 border-red-200" onClick={() => setDeleteConfirm(row)}>
                          <Trash2 className="w-3 h-3 mr-1" />Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-400">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No volunteers found</p>
            <p className="text-sm mt-1">Try adjusting your search or filters.</p>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editVolunteer} onOpenChange={() => setEditVolunteer(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ color: "#003087" }}>Edit Volunteer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onEditSubmit)} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Parent Name</Label>
                <Input {...register("parentName")} />
                {errors.parentName && <p className="text-xs text-destructive">{errors.parentName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" {...register("email")} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input {...register("phone")} />
              </div>
              <div className="space-y-1.5">
                <Label>Child Name</Label>
                <Input {...register("childName")} />
              </div>
              <div className="space-y-1.5">
                <Label>Sport</Label>
                <Controller name="sport" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="football">Football</SelectItem>
                      <SelectItem value="cheer">Cheer</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div className="space-y-1.5">
                <Label>Grade</Label>
                <Controller name="grade" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="K-1">K–1</SelectItem>
                      <SelectItem value="2nd">2nd</SelectItem>
                      <SelectItem value="3rd">3rd</SelectItem>
                      <SelectItem value="4th">4th</SelectItem>
                      <SelectItem value="5th">5th</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Input {...register("notes")} placeholder="Any notes..." />
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setEditVolunteer(null)} className="flex-1">Cancel</Button>
              <Button type="submit" disabled={updateVolunteer.isPending} className="flex-1 text-white" style={{ backgroundColor: "#003087" }}>
                {updateVolunteer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Volunteer?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Remove <strong>{deleteConfirm?.volunteer.parentName}</strong> from the {deleteConfirm ? formatDate(deleteConfirm.event.eventDate) : ""} event? This will reopen their slot.
          </p>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="flex-1">Cancel</Button>
            <Button
              onClick={() => deleteVolunteer.mutate({ id: deleteConfirm.volunteer.id })}
              disabled={deleteVolunteer.isPending}
              className="flex-1 bg-red-600 text-white hover:bg-red-700"
            >
              {deleteVolunteer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
