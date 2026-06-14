import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useStoreSettings } from "@/hooks/use-store-settings";
import { useLogout } from "@workspace/api-client-react";
import {
  LayoutDashboard, Users, ShieldCheck, Key, LogOut, Menu,
  Settings, ChevronDown, ChevronRight, Store, Layers,
  Package, FlaskConical, Warehouse, ClipboardList, ChefHat,
  BarChart3, TrendingUp, ShoppingCart, Table2, Receipt, QrCode,
  Clock, CalendarDays, Calendar, ShoppingBag, PieChart, Printer, ShieldAlert,
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

  const isOwner = user?.roleName === "Owner";
  const isManager = user?.roleName === "Manager";
  const isCashier = user?.roleName === "Cashier";
  const isKitchen = user?.roleName === "Kitchen";
  const canManage = isOwner || isManager;

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => ({
    products: location.startsWith("/products"),
    inventory: location.startsWith("/inventory"),
    reports: location.startsWith("/reports"),
    admin: location.startsWith("/admin"),
    pos: location.startsWith("/pos") || location.startsWith("/tables") || location.startsWith("/transactions"),
    shifts: location.startsWith("/shifts"),
  }));

  function toggleGroup(key: string) {
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
  }

  const handleLogout = async () => {
    try { await logoutMutation.mutateAsync(); } catch { }
    finally { logout(); }
  };

  const navLinkClass = (href: string, exact = false) =>
    cn(
      "flex items-center gap-3 px-3 py-2 rounded-md transition-colors font-medium text-sm",
      (exact ? location === href : location === href || location.startsWith(href + "/"))
        ? "bg-sidebar-accent text-sidebar-accent-foreground"
        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    );

  const groupHeaderClass = "w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors";

  const productLinks = [
    { href: "/products/categories", label: "Categories", icon: Layers },
    { href: "/products", label: "Products", icon: Package },
    { href: "/products/ingredients", label: "Ingredients", icon: FlaskConical },
    { href: "/products/recipes", label: "Recipes", icon: ChefHat },
  ];

  const inventoryLinks = [
    { href: "/inventory/stock", label: "Stock Management", icon: Warehouse },
    { href: "/inventory/movements", label: "Stock Movements", icon: ClipboardList },
  ];

  const reportLinks = [
    { href: "/reports/daily", label: "Daily Report", icon: CalendarDays },
    { href: "/reports/weekly", label: "Weekly Report", icon: Calendar },
    { href: "/reports/monthly", label: "Monthly Report", icon: BarChart3 },
    { href: "/reports/products", label: "Product Report", icon: ShoppingBag },
    { href: "/reports/profit", label: "Profit Report", icon: TrendingUp },
    { href: "/reports/profit-analysis", label: "HPP Analysis", icon: PieChart },
  ];

  const posLinks = [
    { href: "/pos", label: "Cashier Screen", icon: ShoppingCart },
    { href: "/tables", label: "Table Management", icon: Table2 },
    { href: "/transactions", label: "Transactions", icon: Receipt },
  ];

  const adminLinks = [
    { href: "/admin/store-settings", label: "Store Settings", icon: Store },
    { href: "/admin/qris-settings", label: "QRIS Settings", icon: QrCode },
    { href: "/admin/printer-management", label: "Printer Management", icon: Printer },
    { href: "/admin/maintenance", label: "System Maintenance", icon: ShieldAlert },
  ];

  const CollapsibleGroup = ({ groupKey, icon: GroupIcon, label, links, onNavigate }: {
    groupKey: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    links: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
    onNavigate?: () => void;
  }) => {
    const isOpen = openGroups[groupKey];
    const isActive = links.some(l => location === l.href || location.startsWith(l.href + "/"));
    return (
      <div className="pt-1">
        <button
          onClick={() => toggleGroup(groupKey)}
          className={cn(groupHeaderClass, isActive && "text-sidebar-foreground")}
        >
          <span className="flex items-center gap-2">
            <GroupIcon className="h-3.5 w-3.5" />
            {label}
          </span>
          {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        {isOpen && (
          <div className="mt-1 pl-2 border-l-2 border-sidebar-border ml-4 space-y-0.5">
            {links.map(link => (
              <Link key={link.href} href={link.href} className={navLinkClass(link.href, true)} onClick={onNavigate}>
                <link.icon className="h-4 w-4 shrink-0" />
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="space-y-0.5">
      <CollapsibleGroup groupKey="pos" icon={ShoppingCart} label="POS" links={posLinks} onNavigate={onNavigate} />

      {canManage && (
        <Link href="/dashboard" className={navLinkClass("/dashboard", true)} onClick={onNavigate}>
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          Dashboard
        </Link>
      )}

      {/* Shift Management — all non-kitchen */}
      {!isKitchen && (
        <Link href="/shifts" className={navLinkClass("/shifts", true)} onClick={onNavigate}>
          <Clock className="h-4 w-4 shrink-0" />
          Shift Management
        </Link>
      )}

      {isOwner && (
        <>
          <Link href="/users" className={navLinkClass("/users", true)} onClick={onNavigate}>
            <Users className="h-4 w-4 shrink-0" />
            Users
          </Link>
          <Link href="/roles" className={navLinkClass("/roles", true)} onClick={onNavigate}>
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Roles
          </Link>
        </>
      )}

      <Link href="/settings/password" className={navLinkClass("/settings/password", true)} onClick={onNavigate}>
        <Key className="h-4 w-4 shrink-0" />
        Change Password
      </Link>

      {!isKitchen && (
        <CollapsibleGroup groupKey="products" icon={Package} label="Products" links={productLinks} onNavigate={onNavigate} />
      )}

      {canManage && (
        <CollapsibleGroup groupKey="inventory" icon={Warehouse} label="Inventory" links={inventoryLinks} onNavigate={onNavigate} />
      )}

      {canManage && (
        <CollapsibleGroup groupKey="reports" icon={BarChart3} label="Reports" links={reportLinks} onNavigate={onNavigate} />
      )}

      {isOwner && (
        <CollapsibleGroup groupKey="admin" icon={Settings} label="Administration" links={adminLinks} onNavigate={onNavigate} />
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

  const isPOSPage = location === "/pos";

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <aside className="hidden lg:flex flex-col w-64 bg-sidebar border-r border-sidebar-border h-full">
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

      <div className="flex flex-col flex-1 h-full overflow-hidden">
        <header className="h-14 flex items-center justify-between px-4 border-b bg-card shrink-0">
          <div className="flex items-center gap-3">
            <div className="lg:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="-ml-2">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0 bg-sidebar border-r-0">
                  <SidebarHeader />
                  <nav className="p-4 overflow-y-auto max-h-[calc(100vh-120px)]">
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
            <div className="hidden lg:block">
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

        <main className={cn(
          "flex-1 overflow-hidden bg-background",
          isPOSPage ? "" : "overflow-y-auto p-5 md:p-8"
        )}>
          {children}
        </main>
      </div>
    </div>
  );
}
