import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileText, PieChart as PieChartIcon, Building2 } from "lucide-react";
import { formatCurrency, MONTHS_PT, normalizeTransaction } from "@/lib/constants";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

const COLORS = [
  "hsl(40, 60%, 50%)",
  "hsl(160, 50%, 45%)",
  "hsl(220, 60%, 55%)",
  "hsl(0, 72%, 51%)",
  "hsl(280, 50%, 55%)",
  "hsl(30, 70%, 55%)",
  "hsl(180, 45%, 50%)",
  "hsl(330, 55%, 50%)",
];

export default function Relatorios() {
  const [dateFrom, setDateFrom] = useState(
    `${new Date().getFullYear()}-01-01`
  );
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [type, setType] = useState("todos");
  const [selectedUnit, setSelectedUnit] = useState("all");

  const { data: rawTransactions = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => base44.entities.Transaction.list("-date", 5000),
  });
  const transactions = rawTransactions.map(normalizeTransaction);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => base44.entities.Category.list(),
  });

  const { data: costCenters = [] } = useQuery({
    queryKey: ["costCenters"],
    queryFn: () => base44.entities.CostCenter.list("name"),
  });

  // Categorias Não DRE (transferências) — excluir dos relatórios
  const naoDreCats = useMemo(
    () => new Set(categories.filter((c) => c.dre_group === "Não DRE").map((c) => c.name)),
    [categories]
  );

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (!t.date || t.status === "cancelado") return false;
      const dateStr = t.date.substring(0, 10);
      if (dateStr < dateFrom || dateStr > dateTo) return false;
      if (type !== "todos" && t.type !== type) return false;
      if (selectedUnit !== "all" && t.cost_center !== selectedUnit) return false;
      // Excluir transferências entre contas
      if (naoDreCats.has(t.category)) return false;
      return true;
    });
  }, [transactions, dateFrom, dateTo, type, selectedUnit, naoDreCats]);

  // Breakdown separado por tipo (entradas e saídas não misturados)
  const categoryBreakdown = useMemo(() => {
    const entradas = {};
    const saidas = {};
    filtered.forEach((t) => {
      const cat = t.category || "Sem categoria";
      if (t.type === "entrada") entradas[cat] = (entradas[cat] || 0) + (t.amount || 0);
      else saidas[cat] = (saidas[cat] || 0) + (t.amount || 0);
    });
    // Retorna baseado no filtro de tipo
    const map = type === "saida" ? saidas : type === "entrada" ? entradas : 
      // "todos": usa saídas por padrão (mais relevante para análise de custos), mas se só há entradas usa entradas
      Object.keys(saidas).length > 0 ? saidas : entradas;
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filtered, type]);

  const paymentBreakdown = useMemo(() => {
    const map = {};
    filtered.forEach((t) => {
      const pm = t.payment_method || "outro";
      map[pm] = (map[pm] || 0) + (t.amount || 0);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const totalEntradas = filtered
    .filter((t) => t.type === "entrada")
    .reduce((s, t) => s + (t.amount || 0), 0);
  const totalSaidas = filtered
    .filter((t) => t.type === "saida")
    .reduce((s, t) => s + (t.amount || 0), 0);

  const handleExportCSV = () => {
    const headers = ["Data", "Tipo", "Categoria", "Descrição", "Valor", "Pagamento", "Unidade", "Banco"];
    const rows = filtered.map((t) => [
      t.date,
      t.type === "entrada" ? "Entrada" : "Saída",
      t.category || "",
      t.description || "",
      // Formato brasileiro: vírgula como decimal, sem separador de milhar — compatível com Excel BR
      String(t.amount || 0).replace(".", ","),
      t.payment_method || "",
      t.cost_center || "",
      t.bank_account || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            Análise financeira por período
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <Download className="w-4 h-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label className="text-xs">De</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Até</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="entrada">Entradas</SelectItem>
                  <SelectItem value="saida">Saídas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Unidade</Label>
              <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as unidades</SelectItem>
                  {costCenters.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-success/5 border-success/20">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Total Entradas
            </p>
            <p className="text-2xl font-bold text-success mt-1">
              {formatCurrency(totalEntradas)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Total Saídas
            </p>
            <p className="text-2xl font-bold text-destructive mt-1">
              {formatCurrency(totalSaidas)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Resultado
            </p>
            <p
              className={`text-2xl font-bold mt-1 ${
                totalEntradas - totalSaidas >= 0 ? "text-success" : "text-destructive"
              }`}
            >
              {formatCurrency(totalEntradas - totalSaidas)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChartIcon className="w-4 h-4" />
              Por Categoria {type === "entrada" ? "(Entradas)" : type === "saida" ? "(Saídas)" : "(Saídas — mais relevante)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {categoryBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                Sem dados no período
              </p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={50}
                    >
                      {categoryBreakdown.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Por Forma de Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paymentBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                Sem dados no período
              </p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentBreakdown}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={50}
                    >
                      {paymentBreakdown.map((_, i) => (
                        <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top categories table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Ranking por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {categoryBreakdown.slice(0, 10).map((cat, i) => {
              const total = categoryBreakdown.reduce((s, c) => s + c.value, 0);
              const pct = total > 0 ? ((cat.value / total) * 100).toFixed(1) : 0;
              return (
                <div key={cat.name} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-5">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{cat.name}</span>
                      <span className="font-semibold">{formatCurrency(cat.value)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: COLORS[i % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground w-12 text-right">
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}