import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { normalizeTransaction, formatCurrency } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpRight, ArrowDownRight, TrendingUp, Building2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const UNITS = ["Morumbi", "Mascote", "Seraphine", "Corporativo"];
const UNIT_COLORS = {
  Morumbi: "hsl(var(--chart-1))",
  Mascote: "hsl(var(--chart-2))",
  Seraphine: "hsl(var(--chart-3))",
  Corporativo: "hsl(var(--chart-5))",
};

const now = new Date();
const currentYear = now.getFullYear();

export default function DashboardUnidades() {
  const [year, setYear] = useState(String(currentYear));
  const [selectedUnit, setSelectedUnit] = useState("todas");

  const { data: rawTransactions = [], isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => base44.entities.Transaction.list("-date", 5000),
  });

  const transactions = rawTransactions.map(normalizeTransaction).filter((t) =>
    t.date?.startsWith(year)
  );

  // KPIs por unidade
  const unitStats = useMemo(() => {
    return UNITS.map((unit) => {
      const txns = transactions.filter((t) => t.cost_center === unit);
      const receita = txns.filter((t) => t.type === "entrada").reduce((s, t) => s + t.amount, 0);
      const despesa = txns.filter((t) => t.type === "saida").reduce((s, t) => s + t.amount, 0);
      return { unit, receita, despesa, resultado: receita - despesa, count: txns.length };
    });
  }, [transactions]);

  // Dados mensais por unidade (para o gráfico comparativo)
  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const month = String(i + 1).padStart(2, "0");
      const prefix = `${year}-${month}`;
      const entry = { mes: ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][i] };
      UNITS.forEach((unit) => {
        const txns = transactions.filter((t) => t.cost_center === unit && t.date?.startsWith(prefix));
        entry[`${unit}_receita`] = txns.filter((t) => t.type === "entrada").reduce((s, t) => s + t.amount, 0);
        entry[`${unit}_despesa`] = txns.filter((t) => t.type === "saida").reduce((s, t) => s + t.amount, 0);
      });
      return entry;
    });
    return months;
  }, [transactions, year]);

  // Detalhe da unidade selecionada por mês
  const unitMonthly = useMemo(() => {
    if (selectedUnit === "todas") return [];
    return Array.from({ length: 12 }, (_, i) => {
      const month = String(i + 1).padStart(2, "0");
      const prefix = `${year}-${month}`;
      const txns = transactions.filter((t) => t.cost_center === selectedUnit && t.date?.startsWith(prefix));
      const receita = txns.filter((t) => t.type === "entrada").reduce((s, t) => s + t.amount, 0);
      const despesa = txns.filter((t) => t.type === "saida").reduce((s, t) => s + t.amount, 0);
      return {
        mes: ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][i],
        Receita: receita,
        Despesa: despesa,
        Resultado: receita - despesa,
      };
    });
  }, [transactions, year, selectedUnit]);

  const years = [String(currentYear - 1), String(currentYear), String(currentYear + 1)];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Dashboard por Unidade
          </h1>
          <p className="text-sm text-muted-foreground">Comparativo financeiro entre as lojas</p>
        </div>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {unitStats.map(({ unit, receita, despesa, resultado }) => (
          <Card key={unit} className="relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full" style={{ background: UNIT_COLORS[unit] }} />
            <CardHeader className="pb-2 pl-5">
              <CardTitle className="text-sm font-semibold text-muted-foreground">{unit}</CardTitle>
            </CardHeader>
            <CardContent className="pl-5 space-y-2">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-success shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Receita</p>
                  <p className="text-sm font-bold text-success">{formatCurrency(receita)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4 text-destructive shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Despesa</p>
                  <p className="text-sm font-bold text-destructive">{formatCurrency(despesa)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Resultado</p>
                  <p className={`text-sm font-bold ${resultado >= 0 ? "text-success" : "text-destructive"}`}>
                    {formatCurrency(resultado)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gráfico comparativo receita por unidade */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receita Mensal por Unidade — {year}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend />
              {UNITS.map((unit) => (
                <Bar key={unit} dataKey={`${unit}_receita`} name={unit} fill={UNIT_COLORS[unit]} radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detalhe por unidade */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-base">Detalhe Mensal por Unidade</CardTitle>
          <Select value={selectedUnit} onValueChange={setSelectedUnit}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Selecione unidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Selecione uma unidade</SelectItem>
              {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardHeader>
        {selectedUnit !== "todas" && (
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={unitMonthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="Receita" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Despesa" fill="hsl(var(--chart-4))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Resultado" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        )}
      </Card>
    </div>
  );
}