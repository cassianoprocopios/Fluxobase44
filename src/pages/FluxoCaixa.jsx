import React, { useState, useMemo } from "react";
import AIFinancialAnalysis from "@/components/analysis/AIFinancialAnalysis";
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
import { TrendingUp, TrendingDown, Droplets, ChevronRight, ChevronDown, ArrowUpRight, ArrowDownRight } from "lucide-react";
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
  const [selectedUnit, setSelectedUnit] = useState("all");
  const [expandedMonths, setExpandedMonths] = useState(new Set());

  const toggleMonth = (month) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      next.has(month) ? next.delete(month) : next.add(month);
      return next;
    });
  };

  const { data: rawTransactions = [], isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => base44.entities.Transaction.list("-date", 5000),
  });
  const allTransactions = rawTransactions.map(normalizeTransaction);

  const { data: costCenters = [] } = useQuery({
    queryKey: ["costCenters"],
    queryFn: () => base44.entities.CostCenter.list("name"),
  });

  const transactions = selectedUnit === "all"
    ? allTransactions
    : allTransactions.filter((t) => t.cost_center === selectedUnit);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => base44.entities.Category.list(),
  });

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
      const geracaoCaixa = saldo;
      saldoAcumulado += saldo;

      // Categorias de entradas
      const entradaCats = {};
      monthTxns.filter((t) => t.type === "entrada").forEach((t) => {
        const cat = t.category || "Sem categoria";
        entradaCats[cat] = (entradaCats[cat] || 0) + (t.amount || 0);
      });

      // Categorias de saídas (agrupadas por dre_group ou categoria)
      const saidaCats = {};
      monthTxns.filter((t) => t.type === "saida").forEach((t) => {
        const catObj = categories.find((c) => c.name === t.category && c.type === "saida");
        const groupKey = catObj?.dre_group || t.category || "Sem categoria";
        if (!saidaCats[groupKey]) saidaCats[groupKey] = { total: 0, cats: {} };
        saidaCats[groupKey].total += t.amount || 0;
        const catName = t.category || "Sem categoria";
        saidaCats[groupKey].cats[catName] = (saidaCats[groupKey].cats[catName] || 0) + (t.amount || 0);
      });

      return { month, idx, entradas, saidas, saldo, geracaoCaixa, acumulado: saldoAcumulado, entradaCats, saidaCats };
    });
  }, [transactions, selectedYear, categories]);

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
            Movimentação financeira mensal{selectedUnit !== "all" ? ` — ${selectedUnit}` : " — Todas as unidades"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Unit filter */}
          <Select value={selectedUnit} onValueChange={setSelectedUnit}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Todas as unidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as unidades</SelectItem>
              {costCenters.map((c) => (
                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

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
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sticky left-0 bg-muted/80 z-10 border-r min-w-[160px]">
                    Mês
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground min-w-[110px]">Entradas</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground min-w-[110px]">Saídas</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground min-w-[110px]">Saldo</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground min-w-[130px]">Geração de Caixa</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground border-l min-w-[110px]">Acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredData.map((row) => {
                  const isExpanded = expandedMonths.has(row.month);
                  const hasDetail = row.entradas > 0 || row.saidas > 0;
                  return (
                    <React.Fragment key={row.month}>
                      {/* Linha do mês */}
                      <tr
                        className={`hover:bg-muted/30 transition-colors ${hasDetail ? "cursor-pointer" : ""}`}
                        onClick={() => hasDetail && toggleMonth(row.month)}
                      >
                        <td className="px-4 py-2.5 font-medium sticky left-0 bg-card z-10 border-r">
                          <span className="flex items-center gap-2">
                            {hasDetail ? (
                              isExpanded
                                ? <ChevronDown className="w-3.5 h-3.5 text-primary shrink-0" />
                                : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            ) : <span className="w-3.5 shrink-0" />}
                            {row.month}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-success">{formatCurrency(row.entradas)}</td>
                        <td className="px-4 py-2.5 text-right text-destructive">{formatCurrency(row.saidas)}</td>
                        <td className={`px-4 py-2.5 text-right font-medium ${row.saldo >= 0 ? "text-success" : "text-destructive"}`}>
                          {formatCurrency(row.saldo)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                            row.geracaoCaixa > 0 ? "bg-success/10 text-success" : row.geracaoCaixa < 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                          }`}>
                            {row.geracaoCaixa > 0 ? "▲" : row.geracaoCaixa < 0 ? "▼" : "–"}
                            {formatCurrency(Math.abs(row.geracaoCaixa))}
                          </span>
                        </td>
                        <td className={`px-4 py-2.5 text-right font-semibold border-l ${row.acumulado >= 0 ? "text-success" : "text-destructive"}`}>
                          {formatCurrency(row.acumulado)}
                        </td>
                      </tr>

                      {/* Detalhe expandido */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="p-0 bg-muted/10 border-b border-border">
                            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/50">
                              {/* Entradas por categoria */}
                              <div className="p-3 space-y-1">
                                <p className="text-xs font-bold uppercase tracking-wider text-success/80 flex items-center gap-1.5 mb-2">
                                  <ArrowUpRight className="w-3.5 h-3.5" /> Entradas por Categoria
                                </p>
                                {Object.entries(row.entradaCats)
                                  .sort((a, b) => b[1] - a[1])
                                  .map(([cat, val]) => (
                                    <div key={cat} className="flex items-center justify-between gap-3 py-1 px-2 rounded hover:bg-muted/30 transition-colors">
                                      <span className="text-xs text-muted-foreground truncate">{cat}</span>
                                      <span className="text-xs font-semibold text-success shrink-0">{formatCurrency(val)}</span>
                                    </div>
                                  ))}
                                {Object.keys(row.entradaCats).length === 0 && (
                                  <p className="text-xs text-muted-foreground italic px-2">Nenhuma entrada</p>
                                )}
                              </div>

                              {/* Saídas por grupo DRE */}
                              <div className="p-3 space-y-1">
                                <p className="text-xs font-bold uppercase tracking-wider text-destructive/80 flex items-center gap-1.5 mb-2">
                                  <ArrowDownRight className="w-3.5 h-3.5" /> Saídas por Grupo
                                </p>
                                {Object.entries(row.saidaCats)
                                  .sort((a, b) => b[1].total - a[1].total)
                                  .map(([group, data]) => (
                                    <div key={group} className="space-y-0.5">
                                      <div className="flex items-center justify-between gap-3 py-1 px-2 rounded bg-destructive/5">
                                        <span className="text-xs font-semibold text-destructive/90 truncate">{group}</span>
                                        <span className="text-xs font-bold text-destructive shrink-0">{formatCurrency(data.total)}</span>
                                      </div>
                                      {Object.entries(data.cats)
                                        .sort((a, b) => b[1] - a[1])
                                        .map(([cat, val]) => (
                                          <div key={cat} className="flex items-center justify-between gap-3 py-0.5 pl-6 pr-2 rounded hover:bg-muted/30 transition-colors">
                                            <span className="text-xs text-muted-foreground truncate">• {cat}</span>
                                            <span className="text-xs font-medium text-destructive/80 shrink-0">{formatCurrency(val)}</span>
                                          </div>
                                        ))}
                                    </div>
                                  ))}
                                {Object.keys(row.saidaCats).length === 0 && (
                                  <p className="text-xs text-muted-foreground italic px-2">Nenhuma saída</p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                <tr className="bg-muted/50 font-bold">
                  <td className="px-4 py-3 sticky left-0 bg-muted/50 z-10 border-r">TOTAL</td>
                  <td className="px-4 py-3 text-right text-success">{formatCurrency(filteredData.reduce((s, r) => s + r.entradas, 0))}</td>
                  <td className="px-4 py-3 text-right text-destructive">{formatCurrency(filteredData.reduce((s, r) => s + r.saidas, 0))}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(filteredData.reduce((s, r) => s + r.saldo, 0))}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      totalGeracao > 0 ? "bg-success/10 text-success" : totalGeracao < 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                    }`}>
                      {totalGeracao > 0 ? "▲" : totalGeracao < 0 ? "▼" : "–"}
                      {formatCurrency(Math.abs(totalGeracao))}
                    </span>
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