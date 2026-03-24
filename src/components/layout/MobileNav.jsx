import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowUpDown,
  FileBarChart,
  TrendingUp,
  FileText,
  Settings,
  Menu,
  X,
  DollarSign,
  LogOut,
  Building2,
  Users,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { hasRouteAccess } from "@/lib/permissions";

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

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();
  const role = user?.role || "colaborador";
  const visibleItems = NAV_ITEMS.filter((item) => hasRouteAccess(role, item.path));

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <span className="font-bold text-lg text-sidebar-foreground tracking-tight">
            Planeja<span className="text-sidebar-primary">+</span>
          </span>
        </div>
        <button onClick={() => setOpen(!open)} className="text-sidebar-foreground">
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 pt-16 bg-sidebar">
          <nav className="p-4 space-y-1">
            {visibleItems.map((item) => {
              const isActive =
                item.path === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all ${
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <button
              onClick={() => base44.auth.logout()}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-base text-sidebar-foreground/70 hover:bg-sidebar-accent w-full mt-4"
            >
              <LogOut className="w-5 h-5" />
              <span>Sair</span>
            </button>
          </nav>
        </div>
      )}
    </>
  );
}