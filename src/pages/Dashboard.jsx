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

  const stats = useMemo(() => {
    const thisMonthTxns = transactions.filter((t) => {
      if (!t.date) return false;
      const d = new Date(t.date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });

    const lastMonthTxns = transactions.filter((t) => {
      if (!t.date) return false;
      const d = new Date(t.date);
      const lm = currentMonth === 0 ? 11 : currentMonth - 1;
      const ly = currentMonth === 0 ? currentYear - 1 : currentYear;
      return d.getFullYear() === ly && d.getMonth() === lm;
    });

    const sum = (arr, type) =>
      arr
        .filter((t) => t.type === type && t.status !== "cancelado")
        .reduce((s, t) => s + (t.amount || 0), 0);

    const entradas = sum(thisMonthTxns, "entrada");
    const saidas = sum(thisMonthTxns, "saida");
    const resultado = entradas - saidas;

    const entradasLast = sum(lastMonthTxns, "entrada");
    const saidasLast = sum(lastMonthTxns, "saida");

    const trendEntradas =
      entradasLast > 0
        ? (((entradas - entradasLast) / entradasLast) * 100).toFixed(1)
        : 0;
    const trendSaidas =
      saidasLast > 0
        ? (((saidas - saidasLast) / saidasLast) * 100).toFixed(1)
        : 0;

    return { entradas, saidas, resultado, trendEntradas, trendSaidas };
  }, [transactions, currentYear, currentMonth]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Visão geral financeira — {MONTHS_PT[currentMonth]} {currentYear}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Entradas"
          value={formatCurrency(stats.entradas)}
          icon={TrendingUp}
          variant="success"
          trend={parseFloat(stats.trendEntradas)}
          trendLabel={`${stats.trendEntradas}% vs mês anterior`}
        />
        <KPICard
          title="Saídas"
          value={formatCurrency(stats.saidas)}
          icon={TrendingDown}
          variant="danger"
          trend={-parseFloat(stats.trendSaidas)}
          trendLabel={`${stats.trendSaidas}% vs mês anterior`}
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
          value={transactions.filter((t) => {
            if (!t.date) return false;
            const d = new Date(t.date);
            return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
          }).length}
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