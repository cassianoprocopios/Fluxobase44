import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeftRight, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Detecta categorias marcadas como "Não DRE" (transferências entre contas)
 * e verifica se entradas e saídas estão balanceadas por mês.
 */
export default function TransferBalanceAlert({ transactions, categories }) {
  const [expanded, setExpanded] = useState(false);

  // Categorias classificadas como "Não DRE"
  const naoDreCats = useMemo(
    () => new Set(categories.filter((c) => c.dre_group === "Não DRE").map((c) => c.name)),
    [categories]
  );

  const analysis = useMemo(() => {
    const transferTxns = transactions.filter((t) => naoDreCats.has(t.category));
    if (transferTxns.length === 0) return null;

    // Agrupar por mês
    const byMonth = {};
    for (const t of transferTxns) {
      if (!t.date) continue;
      const month = t.date.substring(0, 7); // "YYYY-MM"
      if (!byMonth[month]) byMonth[month] = { entradas: 0, saidas: 0, items: [] };
      if (t.type === "entrada") byMonth[month].entradas += t.amount || 0;
      else byMonth[month].saidas += t.amount || 0;
      byMonth[month].items.push(t);
    }

    const months = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        label: (() => {
          const [year, m] = month.split("-");
          return format(new Date(parseInt(year), parseInt(m) - 1, 1), "MMMM yyyy", { locale: ptBR });
        })(),
        ...data,
        diff: Math.abs(data.entradas - data.saidas),
        balanced: Math.abs(data.entradas - data.saidas) < 0.01,
      }));

    const unbalanced = months.filter((m) => !m.balanced);

    return { months, unbalanced, totalTransfers: transferTxns.length };
  }, [transactions, naoDreCats]);

  if (!analysis) return null;
  if (analysis.unbalanced.length === 0) {
    // Tudo balanceado — mostrar confirmação discreta
    return (
      <div className="flex items-center gap-3 bg-success/5 border border-success/20 rounded-xl px-4 py-3 text-sm">
        <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
        <span className="text-success font-medium">Transferências entre contas balanceadas</span>
        <span className="text-muted-foreground ml-auto">{analysis.totalTransfers} lançamentos</span>
      </div>
    );
  }

  return (
    <div className="border border-destructive/30 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 bg-destructive/5 px-4 py-3">
        <div className="w-8 h-8 rounded-lg bg-destructive/15 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-4 h-4 text-destructive" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-destructive">
            Transferências entre contas desbalanceadas
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {analysis.unbalanced.length} mês(es) com entrada ≠ saída — esses valores não entram no DRE
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 gap-1.5 text-xs"
          onClick={() => setExpanded((v) => !v)}
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          Ver detalhes
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </Button>
      </div>

      {/* Detail */}
      {expanded && (
        <div className="divide-y divide-border">
          {analysis.unbalanced.map((m) => (
            <div key={m.month} className="px-4 py-3 bg-background">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold capitalize">{m.label}</span>
                <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">
                  Diferença: {formatCurrency(m.diff)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-success/5 border border-success/20 rounded-lg px-3 py-2">
                  <p className="text-muted-foreground mb-0.5">Entradas (transferências)</p>
                  <p className="font-semibold text-success text-sm">{formatCurrency(m.entradas)}</p>
                </div>
                <div className="bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
                  <p className="text-muted-foreground mb-0.5">Saídas (transferências)</p>
                  <p className="font-semibold text-destructive text-sm">{formatCurrency(m.saidas)}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                💡 Verifique se todos os lados da transferência foram lançados corretamente no mesmo valor.
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}