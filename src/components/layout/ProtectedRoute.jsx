import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { hasRouteAccess } from "@/lib/permissions";

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const role = user?.role || "colaborador";

  if (!hasRouteAccess(role, location.pathname)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <span className="text-2xl">🔒</span>
        </div>
        <div>
          <h2 className="text-xl font-bold">Acesso Negado</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Você não tem permissão para acessar esta página.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Seu nível de acesso: <span className="font-semibold capitalize">{role}</span>
          </p>
        </div>
        <Navigate to="/" replace />
      </div>
    );
  }

  return children;
}