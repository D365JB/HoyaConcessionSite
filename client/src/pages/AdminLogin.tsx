import { FormEvent, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function AdminLogin() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!loading && user?.role === "admin") navigate("/admin/dashboard");
  }, [user, loading, navigate]);

  const login = trpc.auth.login.useMutation({
    onSuccess: async (nextUser) => {
      utils.auth.me.setData(undefined, nextUser);
      await utils.auth.me.invalidate();
      navigate("/admin/dashboard");
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    login.mutate({ email, password });
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#f5f7fa" }}><Loader2 className="h-8 w-8 animate-spin" style={{ color: "#003087" }} /></div>;

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: "#f5f7fa" }}>
      <header className="py-4 shadow-lg" style={{ backgroundColor: "#003087" }}>
        <div className="container flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg font-black" style={{ color: "#003087" }}>H</div>
          <div><h1 className="text-lg font-black text-white" style={{ fontFamily: "Montserrat, sans-serif" }}>HOYAS CONCESSION</h1><p className="text-xs font-semibold tracking-wide" style={{ color: "#009A44" }}>ADMIN PORTAL</p></div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-5 sm:p-6">
        <section className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-lg sm:p-8">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: "#e8eef7" }}><ShieldCheck className="h-8 w-8" style={{ color: "#003087" }} /></div>
          <div className="mb-6 text-center"><h2 className="text-2xl font-bold" style={{ color: "#003087", fontFamily: "Montserrat, sans-serif" }}>Admin Sign In</h2><p className="mt-2 text-sm leading-5 text-gray-500">Use the email address and password assigned by a Hoyas Concession administrator.</p></div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="email">Email address</Label><Input id="email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="password">Password</Label><div className="relative"><LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><Input id="password" className="pl-9" type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></div></div>
            <Button type="submit" className="h-11 w-full font-semibold text-white btn-active-scale" style={{ backgroundColor: "#003087" }} disabled={login.isPending}>{login.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Sign In</Button>
          </form>
          <a href="/" className="mt-5 block text-center text-sm text-gray-400 transition-colors hover:text-gray-600">← Back to Volunteer Sign-Up</a>
        </section>
      </main>
    </div>
  );
}
