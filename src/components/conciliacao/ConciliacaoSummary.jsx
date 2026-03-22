import React from "react";
import { CheckCircle2, Link2, Plus, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/constants";

export default function ConciliacaoSummary({ matches }) {
  const total = matches.length;
  const confirmed = matches.filter((m) => m.confirmed).length;
  const ignored = matches.filter((m) => m.ignored).length;
  const pending = total - confirmed - ignored;
  const autoMatched = matches.filter((m) => m.status === "matched" && !m.confirmed && !m.ignored).length;

  const totalEntradas = matches
    .filter((m) => m.bankTx.type === "entrada")
    .reduce((s, m) => s + m.bankTx.amount, 0);
  const totalSaidas = matches
    .filter((m) => m.bankTx.type === "saida")
    .reduce((s, m) => s + m.bankTx.amount, 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <div className="rounded-xl border bg-card p-4 space-y-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total importado</p>
        <p className="text-2xl font-bold">{total}</p>
        <p className="text-xs text-muted-foreground">
          +{formatCurrency(totalEntradas)} / -{formatCurrency(totalSaidas)}
        </p>
      </div>
      <div className="rounded-xl border bg-success/5 border-success/20 p-4 space-y-1">
        <p className="text-xs text-success uppercase tracking-wider font-medium flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> Conciliados
        </p>
        <p className="text-2xl font-bold text-success">{confirmed}</p>
        <p className="text-xs text-muted-foreground">{total > 0 ? Math.round((confirmed / total) * 100) : 0}% do total</p>
      </div>
      <div className="rounded-xl border bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800 p-4 space-y-1">
        <p className="text-xs text-amber-600 uppercase tracking-wider font-medium flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" /> Pendentes
        </p>
        <p className="text-2xl font-bold text-amber-600">{pending}</p>
        <p className="text-xs text-muted-foreground">{autoMatched} com sugestão automática</p>
      </div>
      <div className="rounded-xl border bg-card p-4 space-y-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Ignorados</p>
        <p className="text-2xl font-bold">{ignored}</p>
        <p className="text-xs text-muted-foreground">não conciliados</p>
      </div>
    </div>
  );
}