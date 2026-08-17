import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import AdminDashboard from "./pages/AdminDashboard";
import AdminLogin from "./pages/AdminLogin";
import AdminVolunteers from "./pages/AdminVolunteers";
import AdminSeason from "./pages/AdminSeason";
import AdminAccess from "./pages/AdminAccess";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

/** Wraps any admin page — redirects to /admin if not authenticated or not an admin. */
function ProtectedAdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate("/admin");
    if (!loading && user && user.role !== "admin") navigate("/admin");
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f5f7fa" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#003087" }} />
      </div>
    );
  }

  if (!user || user.role !== "admin") return null;

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/admin" component={AdminLogin} />
      <Route path="/admin/dashboard">
        <ProtectedAdminRoute component={AdminDashboard} />
      </Route>
      <Route path="/admin/volunteers">
        <ProtectedAdminRoute component={AdminVolunteers} />
      </Route>
      <Route path="/admin/season">
        <ProtectedAdminRoute component={AdminSeason} />
      </Route>
      <Route path="/admin/access">
        <ProtectedAdminRoute component={AdminAccess} />
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
