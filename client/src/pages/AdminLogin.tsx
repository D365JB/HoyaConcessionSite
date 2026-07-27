import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";

export default function AdminLogin() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && user) {
      navigate("/admin/dashboard");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f5f7fa" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#003087" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#f5f7fa" }}>
      <header style={{ backgroundColor: "#003087" }} className="py-4 shadow-lg">
        <div className="container flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-black text-lg" style={{ color: "#003087" }}>H</div>
          <div>
            <h1 className="text-white font-black text-lg" style={{ fontFamily: "Montserrat, sans-serif" }}>HOYAS CONCESSION</h1>
            <p className="text-xs font-semibold tracking-wide" style={{ color: "#009A44" }}>ADMIN PORTAL</p>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "#e8eef7" }}>
            <ShieldCheck className="w-8 h-8" style={{ color: "#003087" }} />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: "#003087", fontFamily: "Montserrat, sans-serif" }}>Admin Access</h2>
          <p className="text-gray-500 text-sm mb-6">Sign in with your Manus account to access the admin dashboard.</p>
          <Button
            onClick={() => startLogin()}
            className="w-full text-white font-semibold h-11 btn-active-scale"
            style={{ backgroundColor: "#003087" }}
          >
            Sign In with Manus
          </Button>
          <a href="/" className="block mt-4 text-sm text-gray-400 hover:text-gray-600 transition-colors">
            ← Back to Volunteer Sign-Up
          </a>
        </div>
      </div>
    </div>
  );
}
