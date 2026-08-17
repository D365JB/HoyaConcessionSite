import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Search, ShieldCheck, UserCog, UserRoundPlus, UsersRound } from "lucide-react";

function formatLastSignedIn(value: Date | string | null) {
  if (!value) return "Never";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminAccess() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.adminAccess.listUsers.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
  });

  const setRole = trpc.adminAccess.setRole.useMutation({
    onSuccess: (_result, input) => {
      utils.adminAccess.listUsers.invalidate();
      toast.success(input.role === "admin" ? "Administrator access granted." : "Administrator access removed.");
    },
    onError: (error) => toast.error(error.message),
  });

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users ?? [];
    return (users ?? []).filter((account) =>
      [account.name, account.email].some((value) => value?.toLowerCase().includes(term))
    );
  }, [search, users]);

  const admins = (users ?? []).filter((account) => account.role === "admin").length;

  const requestRoleChange = (account: NonNullable<typeof users>[number], nextRole: "user" | "admin") => {
    const action = nextRole === "admin" ? "grant administrator access to" : "remove administrator access from";
    const label = account.name || account.email || "this account";
    if (!window.confirm(`Are you sure you want to ${action} ${label}?`)) return;
    setRole.mutate({ id: account.id, role: nextRole });
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-5">
        <section className="rounded-2xl p-5 sm:p-6 text-white shadow-sm" style={{ background: "linear-gradient(135deg, #003087 0%, #002060 100%)" }}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: "#75e59c" }}>
                <ShieldCheck className="h-4 w-4" /> Secure administration
              </div>
              <h1 className="text-2xl font-black tracking-tight">Admin Access</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
                Grant dashboard access to people who have already signed in with their Manus account. Only current administrators can manage this list.
              </p>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-3 text-left sm:text-center">
              <p className="text-2xl font-black">{admins}</p>
              <p className="text-xs font-medium text-white/70">Active admins</p>
            </div>
          </div>
        </section>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2" style={{ color: "#003087" }}>
                  <UserRoundPlus className="h-5 w-5" /> Create a new admin
                </CardTitle>
                <CardDescription className="mt-1.5 max-w-2xl leading-5">
                  Have the person sign in through the <strong>Admin</strong> link once. Their account will appear below, where you can select <strong>Make Admin</strong>.
                </CardDescription>
              </div>
              <a href="/admin" className="text-sm font-semibold hover:underline" style={{ color: "#009A44" }}>Open sign-in page</a>
            </div>
          </CardHeader>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="space-y-3 pb-3">
            <div className="flex items-center gap-2">
              <UsersRound className="h-5 w-5" style={{ color: "#003087" }} />
              <CardTitle style={{ color: "#003087" }}>Signed-in accounts</CardTitle>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Search by name or email…" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[1, 2, 3].map((key) => <div key={key} className="h-20 animate-pulse rounded-xl bg-gray-100" />)}</div>
            ) : filteredUsers.length ? (
              <div className="space-y-2">
                {filteredUsers.map((account) => {
                  const isCurrentUser = account.id === user?.id;
                  const isAdmin = account.role === "admin";
                  const isProtectedAdmin = isCurrentUser || account.isOwner;
                  return (
                    <div key={account.id} className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-bold text-gray-900">{account.name || "Unnamed account"}</p>
                          <Badge className="border-0" style={{ backgroundColor: isAdmin ? "#e6f5ec" : "#eef2f7", color: isAdmin ? "#007a35" : "#52606d" }}>
                            {isAdmin ? "Admin" : "User"}
                          </Badge>
                          {isCurrentUser && <span className="text-xs font-medium text-gray-400">You</span>}
                          {account.isOwner && <span className="text-xs font-medium text-gray-400">Project owner</span>}
                        </div>
                        <p className="mt-1 truncate text-sm text-gray-500">{account.email || "No email available"}</p>
                        <p className="mt-1 text-xs text-gray-400">Last signed in: {formatLastSignedIn(account.lastSignedIn)}</p>
                      </div>
                      {isAdmin ? (
                        isProtectedAdmin ? (
                          <span className="inline-flex w-full items-center justify-center rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-400 sm:w-auto">
                            <ShieldCheck className="mr-2 h-4 w-4" /> Protected Admin
                          </span>
                        ) : (
                          <Button
                            variant="outline"
                            className="w-full border-red-200 text-red-600 hover:bg-red-50 sm:w-auto"
                            disabled={setRole.isPending}
                            onClick={() => requestRoleChange(account, "user")}
                          >
                            <UserCog className="mr-2 h-4 w-4" /> Remove Admin
                          </Button>
                        )
                      ) : (
                        <Button
                          className="w-full text-white sm:w-auto"
                          style={{ backgroundColor: "#009A44" }}
                          disabled={setRole.isPending}
                          onClick={() => requestRoleChange(account, "admin")}
                        >
                          <ShieldCheck className="mr-2 h-4 w-4" /> Make Admin
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-gray-400">
                <UsersRound className="mx-auto mb-3 h-10 w-10 opacity-30" />
                <p className="font-medium">No signed-in accounts found</p>
                <p className="mt-1 text-sm">New administrators must sign in once before they can be promoted.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
