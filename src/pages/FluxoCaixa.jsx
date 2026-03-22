import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, MONTHS_PT, normalizeTransaction } from "@/lib/constants";
import { TrendingUp, TrendingDown, Droplets } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

export default function FluxoCaixa() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState("all");

  const { data: rawTransactions = [], isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => base44.entities.Transaction.list("-date", 5000),
  });
  const transactions = rawTransactions.map(normalizeTransaction);

  const chartData = useMemo(() => {
    const year = parseInt(selectedYear);
    let saldoAcumulado = 0;

    return MONTHS_PT.map((month, idx) => {
      const monthTxns = transactions.filter((t) => {
        if (!t.date || t.status === "cancelado") return false;
        const d = new Date(t.date);
        return d.getFullYear() === year && d.getMonth() === idx;
      });

      const entradas = monthTxns
        .filter((t) => t.type === "entrada")
        .reduce((s, t) => s + (t.amount || 0), 0);
      const saidas = monthTxns
        .filter((t) => t.type === "saida")
        .reduce((s, t) => s + (t.amount || 0), 0);
      const saldo = entradas - saidas;
      const geracaoCaixa = saldo; // saldo líquido do período = geração de caixa
      saldoAcumulado += saldo;

      return { month, entradas, saidas, saldo, geracaoCaixa, acumulado: saldoAcumulado };
    });
  }, [transactions, selectedYear]);

  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - 2 + i));

  const filteredData = selectedMonth === "all"
    ? chartData
    : chartData.filter((_, idx) => idx === parseInt(selectedMonth));

  const totalEntradas = filteredData.reduce((s, r) => s + r.entradas, 0);
  const totalSaidas = filteredData.reduce((s, r) => s + r.saidas, 0);
  const totalGeracao = filteredData.reduce((s, r) => s + r.geracaoCaixa, 0);
  const mesesPositivos = filteredData.filter((r) => r.geracaoCaixa > 0).length;
  const mesesNegativos = filteredData.filter((r) => r.geracaoCaixa < 0).length;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fluxo de Caixa</h1>
          <p className="text-sm text-muted-foreground">
            Movimentação financeira mensal
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Todos os meses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {MONTHS_PT.map((m, i) => (
                <SelectItem key={i} value={String(i)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-success" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Entradas</p>
            <p className="text-lg font-bold text-success">{formatCurrency(totalEntradas)}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
            <TrendingDown className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Saídas</p>
            <p className="text-lg font-bold text-destructive">{formatCurrency(totalSaidas)}</p>
          </div>
        </div>
        <div className={`bg-card border rounded-xl p-4 flex items-center gap-4 ${totalGeracao >= 0 ? "border-success/30" : "border-destructive/30"}`}>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${totalGeracao >= 0 ? "bg-success/10" : "bg-destructive/10"}`}>
            <Droplets className={`w-5 h-5 ${totalGeracao >= 0 ? "text-success" : "text-destructive"}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Geração de Caixa</p>
            <p className={`text-lg font-bold ${totalGeracao >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(totalGeracao)}</p>
            {selectedMonth === "all" && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {mesesPositivos > 0 && <span className="text-success">{mesesPositivos} positivo{mesesPositivos > 1 ? "s" : ""}</span>}
                {mesesPositivos > 0 && mesesNegativos > 0 && " · "}
                {mesesNegativos > 0 && <span className="text-destructive">{mesesNegativos} negativo{mesesNegativos > 1 ? "s" : ""}</span>}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold mb-4">Entradas vs Saídas</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold mb-4">
              {selectedMonth === "all" ? "Saldo Acumulado" : "Saldo do Mês"}
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredData}>
                  <defs>
                    <linearGradient id="acumGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey={selectedMonth === "all" ? "acumulado" : "saldo"}
                    name={selectedMonth === "all" ? "Acumulado" : "Saldo"}
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#acumGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/80 border-b">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sticky left-0 bg-muted/80 z-10 border-r">
                    Mês
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Entradas
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Saídas
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Saldo
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground border-l">
                    Acumulado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredData.map((row) => (
                  <tr key={row.month} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium sticky left-0 bg-card z-10 border-r">
                      {row.month}
                    </td>
                    <td className="px-4 py-2.5 text-right text-success">
                      {formatCurrency(row.entradas)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-destructive">
                      {formatCurrency(row.saidas)}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-medium ${row.saldo >= 0 ? "text-success" : "text-destructive"}`}>
                      {formatCurrency(row.saldo)}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-semibold border-l ${row.acumulado >= 0 ? "text-success" : "text-destructive"}`}>
                      {formatCurrency(row.acumulado)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-muted/50 font-bold">
                  <td className="px-4 py-3 sticky left-0 bg-muted/50 z-10 border-r">
                    TOTAL
                  </td>
                  <td className="px-4 py-3 text-right text-success">
                    {formatCurrency(filteredData.reduce((s, r) => s + r.entradas, 0))}
                  </td>
                  <td className="px-4 py-3 text-right text-destructive">
                    {formatCurrency(filteredData.reduce((s, r) => s + r.saidas, 0))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatCurrency(filteredData.reduce((s, r) => s + r.saldo, 0))}
                  </td>
                  <td className="px-4 py-3 text-right border-l">
                    {formatCurrency(filteredData[filteredData.length - 1]?.acumulado || 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}