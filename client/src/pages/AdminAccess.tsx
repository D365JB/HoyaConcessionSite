import { FormEvent, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { SpinnerIos20Regular as Loader2, LockClosed24Regular as LockKeyhole, Add24Regular as Plus, Search24Regular as Search, ShieldCheckmark24Regular as ShieldCheck, Settings24Regular as UserCog, People24Regular as UsersRound } from "@fluentui/react-icons";

function formatLastSignedIn(value: Date | string | null) {
  if (!value) return "Never";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const EMPTY_FORM = { name: "", email: "", password: "" };

export default function AdminAccess() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const utils = trpc.useUtils();
  const { data: accounts, isLoading } = trpc.adminAccess.listUsers.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
  });

  const createAdmin = trpc.adminAccess.create.useMutation({
    onSuccess: () => {
      utils.adminAccess.listUsers.invalidate();
      setForm(EMPTY_FORM);
      setDialogOpen(false);
      toast.success("Administrator account created.");
    },
    onError: (error) => toast.error(error.message),
  });

  const deactivateAdmin = trpc.adminAccess.deactivate.useMutation({
    onSuccess: () => {
      utils.adminAccess.listUsers.invalidate();
      toast.success("Administrator access removed.");
    },
    onError: (error) => toast.error(error.message),
  });

  const filteredAccounts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return accounts ?? [];
    return (accounts ?? []).filter((account) => [account.name, account.email].some((value) => value?.toLowerCase().includes(term)));
  }, [accounts, search]);

  const activeAdmins = (accounts ?? []).filter((account) => account.isActive).length;

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (form.password.length < 12) {
      toast.error("Use a password with at least 12 characters.");
      return;
    }
    createAdmin.mutate(form);
  };

  const confirmDeactivate = (account: NonNullable<typeof accounts>[number]) => {
    const label = account.name || account.email;
    if (!window.confirm(`Remove administrator access for ${label}? They will no longer be able to sign in.`)) return;
    deactivateAdmin.mutate({ id: account.id, userId: account.userId });
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-5">
        <section className="rounded-2xl p-5 text-white shadow-sm sm:p-6" style={{ background: "linear-gradient(135deg, #003087 0%, #002060 100%)" }}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: "#75e59c" }}><ShieldCheck className="h-4 w-4" /> Secure administration</div>
              <h1 className="text-2xl font-black tracking-tight">Admin Access</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">Create and manage password-protected accounts for the Hoyas Concession dashboard.</p>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-3 sm:text-center"><p className="text-2xl font-black">{activeAdmins}</p><p className="text-xs font-medium text-white/70">Active admins</p></div>
          </div>
        </section>

        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2" style={{ color: "#003087" }}><LockKeyhole className="h-5 w-5" /> Password-based administrator accounts</CardTitle>
              <CardDescription className="mt-1.5 max-w-2xl leading-5">Passwords are stored as secure hashes only. New admins can sign in immediately with the email and password you create.</CardDescription>
            </div>
            <Button onClick={() => setDialogOpen(true)} className="w-full text-white sm:w-auto" style={{ backgroundColor: "#007a35" }}><Plus className="mr-2 h-4 w-4" /> Create Admin</Button>
          </CardHeader>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="space-y-3 pb-3">
            <CardTitle className="flex items-center gap-2" style={{ color: "#003087" }}><UsersRound className="h-5 w-5" /> Administrator accounts</CardTitle>
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Search by name or email…" /></div>
          </CardHeader>
          <CardContent>
            {isLoading ? <div className="space-y-3">{[1, 2, 3].map((key) => <div key={key} className="h-20 animate-pulse rounded-xl bg-gray-100" />)}</div> : filteredAccounts.length ? (
              <div className="space-y-2">
                {filteredAccounts.map((account) => {
                  const isCurrentUser = account.userId === user?.id;
                  return <div key={account.id} className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-bold text-gray-900">{account.name || "Unnamed account"}</p><Badge className="border-0" style={{ backgroundColor: account.isActive ? "#e6f5ec" : "#f3f4f6", color: account.isActive ? "#007a35" : "#6b7280" }}>{account.isActive ? "Admin" : "Removed"}</Badge>{isCurrentUser && <span className="text-xs font-medium text-gray-400">You</span>}</div><p className="mt-1 truncate text-sm text-gray-500">{account.email}</p><p className="mt-1 text-xs text-gray-400">Last signed in: {formatLastSignedIn(account.lastSignedIn)}</p></div>
                    {account.isActive && (isCurrentUser ? <span className="inline-flex w-full items-center justify-center rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-400 sm:w-auto"><ShieldCheck className="mr-2 h-4 w-4" /> Your Admin Account</span> : <Button variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50 sm:w-auto" disabled={deactivateAdmin.isPending} onClick={() => confirmDeactivate(account)}><UserCog className="mr-2 h-4 w-4" /> Remove Admin</Button>)}
                  </div>;
                })}
              </div>
            ) : <div className="py-12 text-center text-gray-400"><UsersRound className="mx-auto mb-3 h-10 w-10 opacity-30" /><p className="font-medium">No administrator accounts found</p></div>}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle style={{ color: "#003087" }}>Create administrator</DialogTitle><DialogDescription>Give the new administrator a secure password with at least 12 characters.</DialogDescription></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="space-y-1.5"><Label htmlFor="admin-name">Name</Label><Input id="admin-name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="admin-email">Email</Label><Input id="admin-email" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="admin-password">Temporary password</Label><Input id="admin-password" type="password" minLength={12} required autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /><p className="text-xs text-gray-500">Use at least 12 characters. Share it securely with the new administrator.</p></div>
            <Button type="submit" className="w-full text-white" style={{ backgroundColor: "#007a35" }} disabled={createAdmin.isPending}>{createAdmin.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create Admin</Button>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
