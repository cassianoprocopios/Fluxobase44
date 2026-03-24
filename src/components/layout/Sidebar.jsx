import React from "react";
import { Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { hasRouteAccess } from "@/lib/permissions";
import {
  LayoutDashboard,
  ArrowUpDown,
  FileBarChart,
  TrendingUp,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  DollarSign,
  Building2,
  Users,
} from "lucide-react";

const NAV_ITEMS = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/lancamentos", icon: ArrowUpDown, label: "Lançamentos" },
  { path: "/dashboard-unidades", icon: Building2, label: "Unidades" },
  { path: "/dre", icon: FileBarChart, label: "DRE" },
  { path: "/fluxo-caixa", icon: TrendingUp, label: "Fluxo de Caixa" },
  { path: "/relatorios", icon: FileText, label: "Relatórios" },
  { path: "/usuarios", icon: Users, label: "Usuários" },
  { path: "/configuracoes", icon: Settings, label: "Configurações" },
];

export default function Sidebar({ collapsed, setCollapsed }) {
  const location = useLocation();
  const { user } = useAuth();
  const role = user?.role || "colaborador";
  const visibleItems = NAV_ITEMS.filter((item) => hasRouteAccess(role, item.path));

  return (
    <aside
      className={`fixed left-0 top-0 h-full z-40 bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 flex flex-col ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
          <DollarSign className="w-5 h-5 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="font-bold text-lg tracking-tight whitespace-nowrap">
            Planeja<span className="text-sidebar-primary">+</span>
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {visibleItems.map((item) => {
          const isActive =
            item.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-sidebar-border space-y-1">
        {!collapsed && user && (
          <div className="px-3 py-2 text-xs text-sidebar-foreground/50 flex items-center gap-2">
            <span className="truncate">{user.email}</span>
            <span className="shrink-0 bg-sidebar-accent text-sidebar-foreground/80 px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize">{role}</span>
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground w-full transition-all"
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5 shrink-0" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5 shrink-0" />
              <span>Recolher</span>
            </>
          )}
        </button>
        <button
          onClick={() => base44.auth.logout()}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground w-full transition-all"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}