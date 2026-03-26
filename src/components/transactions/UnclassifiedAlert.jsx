import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Tags, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatCurrency } from "@/lib/constants";

export default function UnclassifiedAlert({ transactions, onClassify }) {
  const unclassified = useMemo(
    () => transactions.filter((t) => !t.category || t.category.trim() === ""),
    [transactions]
  );

  const entradas = unclassified.filter((t) => t.type === "entrada");
  const saidas = unclassified.filter((t) => t.type === "saida");

  if (unclassified.length === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/50 rounded-xl px-4 py-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            {unclassified.length} lançamento(s) sem categoria
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
            {entradas.length > 0 && (
              <span className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3 text-success" />
                {entradas.length} entrada(s) · {formatCurrency(entradas.reduce((s, t) => s + (t.amount || 0), 0))}
              </span>
            )}
            {saidas.length > 0 && (
              <span className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <ArrowDownRight className="w-3 h-3 text-destructive" />
                {saidas.length} saída(s) · {formatCurrency(saidas.reduce((s, t) => s + (t.amount || 0), 0))}
              </span>
            )}
          </div>
        </div>
      </div>
      <Button
        size="sm"
        className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 gap-2"
        onClick={onClassify}
      >
        <Tags className="w-4 h-4" />
        Classificar agora
      </Button>
    </div>
  );
}