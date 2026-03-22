import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Target,
} from "lucide-react";
import { formatCurrency, MONTHS_PT } from "@/lib/constants";
import KPICard from "@/components/dashboard/KPICard";
import MonthlyChart from "@/components/dashboard/MonthlyChart";
import CashFlowMini from "@/components/dashboard/CashFlowMini";
import RecentTransactions from "@/components/dashboard/RecentTransactions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Dashboard() {
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => base44.entities.Transaction.list("-date", 5000),
  });

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const [viewMode, setViewMode] = useState("month"); // "month" | "accumulated"
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const stats = useMemo(() => {
    const sum = (arr, type) =>
      arr.filter((t) => t.type === type && t.status !== "cancelado")
         .reduce((s, t) => s + (t.amount || 0), 0);

    if (viewMode === "accumulated") {
      // Acumulado: tudo até o mês selecionado (inclusive) no ano selecionado
      const accTxns = transactions.filter((t) => {
        if (!t.date) return false;
        const d = new Date(t.date);
        return d.getFullYear() === selectedYear && d.getMonth() <= selectedMonth;
      });
      const entradas = sum(accTxns, "entrada");
      const saidas = sum(accTxns, "saida");
      const resultado = entradas - saidas;
      return { entradas, saidas, resultado, trendEntradas: 0, trendSaidas: 0, txCount: accTxns.length };
    }

    // Modo mês: apenas o mês selecionado
    const thisMonthTxns = transactions.filter((t) => {
      if (!t.date) return false;
      const d = new Date(t.date);
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    });

    const lastMonthTxns = transactions.filter((t) => {
      if (!t.date) return false;
      const d = new Date(t.date);
      const lm = selectedMonth === 0 ? 11 : selectedMonth - 1;
      const ly = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
      return d.getFullYear() === ly && d.getMonth() === lm;
    });

    const entradas = sum(thisMonthTxns, "entrada");
    const saidas = sum(thisMonthTxns, "saida");
    const resultado = entradas - saidas;

    const entradasLast = sum(lastMonthTxns, "entrada");
    const saidasLast = sum(lastMonthTxns, "saida");

    const trendEntradas = entradasLast > 0 ? (((entradas - entradasLast) / entradasLast) * 100).toFixed(1) : 0;
    const trendSaidas = saidasLast > 0 ? (((saidas - saidasLast) / saidasLast) * 100).toFixed(1) : 0;

    return { entradas, saidas, resultado, trendEntradas, trendSaidas, txCount: thisMonthTxns.length };
  }, [transactions, selectedYear, selectedMonth, viewMode]);

  const monthlyData = useMemo(() => {
    const data = [];
    let saldoAcumulado = 0;

    for (let m = 0; m < 12; m++) {
      const monthTxns = transactions.filter((t) => {
        if (!t.date) return false;
        const d = new Date(t.date);
        return d.getFullYear() === currentYear && d.getMonth() === m;
      });

      const entradas = monthTxns
        .filter((t) => t.type === "entrada" && t.status !== "cancelado")
        .reduce((s, t) => s + (t.amount || 0), 0);
      const saidas = monthTxns
        .filter((t) => t.type === "saida" && t.status !== "cancelado")
        .reduce((s, t) => s + (t.amount || 0), 0);

      saldoAcumulado += entradas - saidas;

      data.push({
        month: MONTHS_PT[m],
        entradas,
        saidas,
        saldo: saldoAcumulado,
      });
    }
    return data;
  }, [transactions, currentYear]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  const periodLabel = viewMode === "accumulated"
    ? `Acumulado Jan–${MONTHS_PT[selectedMonth]} ${selectedYear}`
    : `${MONTHS_PT[selectedMonth]} ${selectedYear}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral financeira — {periodLabel}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Month selector */}
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS_PT.map((m, i) => (
                <SelectItem key={i} value={String(i)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Year selector */}
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* View mode toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden text-sm">
            <button
              onClick={() => setViewMode("month")}
              className={`px-3 py-1.5 font-medium transition-colors ${viewMode === "month" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
            >
              Mês
            </button>
            <button
              onClick={() => setViewMode("accumulated")}
              className={`px-3 py-1.5 font-medium transition-colors ${viewMode === "accumulated" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
            >
              Acumulado
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Entradas"
          value={formatCurrency(stats.entradas)}
          icon={TrendingUp}
          variant="success"
          trend={viewMode === "month" ? parseFloat(stats.trendEntradas) : null}
          trendLabel={viewMode === "month" ? `${stats.trendEntradas}% vs mês anterior` : undefined}
        />
        <KPICard
          title="Saídas"
          value={formatCurrency(stats.saidas)}
          icon={TrendingDown}
          variant="danger"
          trend={viewMode === "month" ? -parseFloat(stats.trendSaidas) : null}
          trendLabel={viewMode === "month" ? `${stats.trendSaidas}% vs mês anterior` : undefined}
        />
        <KPICard
          title="Resultado"
          value={formatCurrency(stats.resultado)}
          icon={DollarSign}
          variant={stats.resultado >= 0 ? "success" : "danger"}
          trend={stats.resultado}
          trendLabel={stats.resultado >= 0 ? "Positivo" : "Negativo"}
        />
        <KPICard
          title="Transações"
          value={stats.txCount}
          icon={Target}
          variant="primary"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MonthlyChart data={monthlyData} />
        <CashFlowMini data={monthlyData} />
      </div>

      <RecentTransactions transactions={transactions} />
    </div>
  );
}