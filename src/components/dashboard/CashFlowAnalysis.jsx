import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { formatCurrency } from "@/lib/constants";

const COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8",
  "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B88B", "#A8E6CF",
  "#FFD3B6", "#FFAAA5", "#AA96DA", "#FCBAD3", "#A8D8EA"
];

export default function CashFlowAnalysis({ transactions, selectedMonth, selectedYear, selectedUnit }) {
  // Filtra transações do mês/ano selecionado
  const monthTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (!t.date || t.status === "cancelado") return false;
      const d = new Date(t.date);
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    });
  }, [transactions, selectedMonth, selectedYear]);

  // Agregação por categoria
  const categoryData = useMemo(() => {
    const map = new Map();

    monthTransactions.forEach((t) => {
      const cat = t.category || "Sem categoria";
      const key = `${cat}-${t.type}`;
      
      if (!map.has(key)) {
        map.set(key, {
          category: cat,
          type: t.type,
          amount: 0,
        });
      }
      map.get(key).amount += t.amount || 0;
    });

    return Array.from(map.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [monthTransactions]);

  // Dados para gráfico de pizza (saídas)
  const expensesByCategory = useMemo(() => {
    const expenses = categoryData.filter((d) => d.type === "saida");
    return expenses.length > 0 ? expenses : [];
  }, [categoryData]);

  // Dados para gráfico de pizza (entradas)
  const incomeByCategory = useMemo(() => {
    const income = categoryData.filter((d) => d.type === "entrada");
    return income.length > 0 ? income : [];
  }, [categoryData]);

  // Resumo de gasto por categoria
  const summaryByCategory = useMemo(() => {
    const map = new Map();
    
    monthTransactions.forEach((t) => {
      const cat = t.category || "Sem categoria";
      if (!map.has(cat)) {
        map.set(cat, { category: cat, entrada: 0, saida: 0 });
      }
      const entry = map.get(cat);
      if (t.type === "entrada") entry.entrada += t.amount || 0;
      else entry.saida += t.amount || 0;
    });

    return Array.from(map.values())
      .map((d) => ({
        ...d,
        saldo: d.entrada - d.saida,
      }))
      .sort((a, b) => b.saida - a.saida);
  }, [monthTransactions]);

  const customTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    return (
      <div className="bg-card border border-border rounded-lg p-2 text-xs">
        <p className="font-semibold">{data.category || data.name}</p>
        <p className="text-success">
          {formatCurrency(payload[0].value)}
        </p>
      </div>
    );
  };

  const barTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="bg-card border border-border rounded-lg p-2 text-xs space-y-1">
        <p className="font-semibold">{payload[0].payload.category}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>
            {p.name}: {formatCurrency(p.value)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Gráficos de pizza lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Saídas por Categoria */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Despesas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {expensesByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={expensesByCategory}
                    dataKey="amount"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                  >
                    {expensesByCategory.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                Sem dados de despesas
              </div>
            )}
          </CardContent>
        </Card>

        {/* Receitas por Categoria */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Receitas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {incomeByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={incomeByCategory}
                    dataKey="amount"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                  >
                    {incomeByCategory.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                Sem dados de receitas
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de barras comparativo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Receitas vs Despesas por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          {summaryByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart
                data={summaryByCategory}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 200, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="category" type="category" width={190} />
                <Tooltip content={barTooltip} />
                <Legend />
                <Bar dataKey="entrada" fill="#10B981" name="Receitas" />
                <Bar dataKey="saida" fill="#EF4444" name="Despesas" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              Sem dados para exibir
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}