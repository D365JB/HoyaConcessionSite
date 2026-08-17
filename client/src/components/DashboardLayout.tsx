import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { Grid24Regular as LayoutDashboard, SignOut24Regular as LogOut, People24Regular as Users, CalendarLtr24Regular as Calendar, Open24Regular as ExternalLink, PanelLeft24Regular as PanelLeft, ShieldCheckmark24Regular as ShieldCheck } from "@fluentui/react-icons";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin/dashboard" },
  { icon: Users, label: "Volunteers", path: "/admin/volunteers" },
  { icon: Calendar, label: "Season", path: "/admin/season" },
  { icon: ShieldCheck, label: "Admin Access", path: "/admin/access" },
  { icon: ExternalLink, label: "Public Page", path: "/" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 180;
const MAX_WIDTH = 360;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: "#f5f7fa" }}>
        <div className="flex flex-col items-center gap-6 p-8 max-w-sm w-full bg-white rounded-2xl shadow-lg">
          <img src="/logo.png" alt="Hoyas logo" className="w-16 h-16" />
          <div className="text-center">
            <h1 className="text-xl font-bold" style={{ color: "#003087" }}>Admin Access Required</h1>
            <p className="text-sm text-gray-500 mt-2">Sign in to access the Hoyas Concession admin dashboard.</p>
          </div>
          <Button onClick={() => { window.location.href = "/admin"; }} className="w-full text-white" style={{ backgroundColor: "#003087" }}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({ children, setSidebarWidth }: { children: React.ReactNode; setSidebarWidth: (w: number) => void }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          <SidebarHeader className="h-16 justify-center" style={{ backgroundColor: "#003087" }}>
            <div className="flex items-center gap-3 px-2 w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors focus:outline-none"
                style={{ color: "rgba(255,255,255,0.7)" }}
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
              {!isCollapsed && (
                <div className="min-w-0">
                  <p className="text-white font-black text-sm leading-tight" style={{ fontFamily: "Montserrat, sans-serif" }}>HOYAS</p>
                  <p className="text-xs font-semibold" style={{ color: "#009A44" }}>CONCESSION ADMIN</p>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0" style={{ backgroundColor: "#002060" }}>
            <SidebarMenu className="px-2 py-2">
              {menuItems.map((item) => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-10 transition-all font-medium"
                      style={{
                        color: isActive ? "#ffffff" : "rgba(255,255,255,0.65)",
                        backgroundColor: isActive ? "#009A44" : "transparent",
                      }}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3" style={{ backgroundColor: "#002060", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/10 transition-colors w-full text-left focus:outline-none">
                  <Avatar className="h-8 w-8 border border-white/20 shrink-0">
                    <AvatarFallback className="text-xs font-bold text-white" style={{ backgroundColor: "#009A44" }}>
                      {user?.name?.charAt(0).toUpperCase() ?? "A"}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate leading-none text-white">{user?.name ?? "Admin"}</p>
                      <p className="text-xs truncate mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>{user?.email ?? ""}</p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Resize handle */}
        {!isMobile && !isCollapsed && (
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors z-10"
            onMouseDown={() => setIsResizing(true)}
          />
        )}
      </div>

      <SidebarInset>
        <header className="flex h-14 items-center gap-3 border-b px-4 sm:px-6 bg-white sticky top-0 z-30">
          <SidebarTrigger className="-ml-1" />
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm" style={{ color: "#003087" }}>
              {menuItems.find((m) => m.path === location)?.label ?? "Admin"}
            </span>
          </div>
          <div className="ml-auto">
            <span className="text-xs text-gray-400">2026 Season</span>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6" style={{ backgroundColor: "#f5f7fa" }}>
          {children}
        </main>
      </SidebarInset>
    </>
  );
}
