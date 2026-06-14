import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useStoreSettings } from "@/hooks/use-store-settings";
import { useLogout } from "@workspace/api-client-react";
import {
  LayoutDashboard, Users, ShieldCheck, Key, LogOut, Menu,
  Settings, ChevronDown, ChevronRight, Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const { settings } = useStoreSettings();
  const [location] = useLocation();
  const logoutMutation = useLogout();
  const [adminOpen, setAdminOpen] = useState(
    location.startsWith("/admin")
  );

  const isOwner = user?.roleName === "Owner";

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // ignore
    } finally {
      logout();
    }
  };

  const navLinkClass = (href: string) =>
    cn(
      "flex items-center gap-3 px-3 py-2 rounded-md transition-colors font-medium text-sm",
      location === href
        ? "bg-sidebar-accent text-sidebar-accent-foreground"
        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    );

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="space-y-1">
      <Link href="/dashboard" className={navLinkClass("/dashboard")} onClick={onNavigate}>
        <LayoutDashboard className="h-4 w-4 shrink-0" />
        Dashboard
      </Link>
      <Link href="/users" className={navLinkClass("/users")} onClick={onNavigate}>
        <Users className="h-4 w-4 shrink-0" />
        Users
      </Link>
      <Link href="/roles" className={navLinkClass("/roles")} onClick={onNavigate}>
        <ShieldCheck className="h-4 w-4 shrink-0" />
        Roles
      </Link>
      <Link href="/settings/password" className={navLinkClass("/settings/password")} onClick={onNavigate}>
        <Key className="h-4 w-4 shrink-0" />
        Change Password
      </Link>

      {isOwner && (
        <div className="pt-2">
          <button
            onClick={() => setAdminOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
          >
            <span className="flex items-center gap-2">
              <Settings className="h-3.5 w-3.5" />
              Administration
            </span>
            {adminOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>

          {adminOpen && (
            <div className="mt-1 pl-2 border-l-2 border-sidebar-border ml-4 space-y-1">
              <Link
                href="/admin/store-settings"
                className={navLinkClass("/admin/store-settings")}
                onClick={onNavigate}
              >
                <Store className="h-4 w-4 shrink-0" />
                Store Settings
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const storeName = settings?.storeName ?? "THREE NINE POS";
  const logoUrl = settings?.logoUrl ?? null;

  const SidebarHeader = () => (
    <div className="p-5 border-b border-sidebar-border flex items-center gap-3">
      {logoUrl ? (
        <img src={logoUrl} alt="Logo" className="h-9 w-9 rounded-lg object-contain bg-white p-0.5" />
      ) : (
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
          {storeName.charAt(0)}
        </div>
      )}
      <div className="overflow-hidden">
        <h1 className="text-sm font-bold tracking-tight text-sidebar-foreground truncate leading-tight">
          {storeName}
        </h1>
        <p className="text-xs text-sidebar-foreground/40 font-mono">POS SYSTEM</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-sidebar border-r border-sidebar-border h-full">
        <SidebarHeader />
        <nav className="flex-1 px-4 py-4 overflow-y-auto">
          <NavLinks />
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground text-sm"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-3" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        {/* Header */}
        <header className="h-14 flex items-center justify-between px-4 border-b bg-card shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="-ml-2">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0 bg-sidebar border-r-0">
                  <SidebarHeader />
                  <nav className="p-4">
                    <NavLinks />
                  </nav>
                  <div className="p-4 border-t border-sidebar-border">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-sidebar-foreground"
                      onClick={handleLogout}
                    >
                      <LogOut className="h-4 w-4 mr-3" />
                      Logout
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Store name in header on desktop */}
            <div className="hidden md:block">
              <span className="text-sm font-semibold text-muted-foreground">{storeName}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-sm font-semibold leading-tight">
                {user?.fullName || user?.username}
              </span>
              <span className="text-xs text-muted-foreground">{user?.roleName}</span>
            </div>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
              {user?.fullName?.charAt(0).toUpperCase() || user?.username?.charAt(0).toUpperCase() || "U"}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-5 md:p-8 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
