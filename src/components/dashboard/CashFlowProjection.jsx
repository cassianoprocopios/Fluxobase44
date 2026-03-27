import React, { useMemo, useState } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatCurrency, MONTHS_PT } from "@/lib/constants";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-xs space-y-1.5 min-w-[180px]">
      <p className="font-semibold text-sm mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex justify-between gap-4">
          <span style={{ color: p.color }} className="font-medium">{p.name}</span>
          <span className="font-semibold tabular-nums">{formatCurrency(Math.abs(p.value))}</span>
        </div>
      ))}
    </div>
  );
};

export default function CashFlowProjection({ transactions, selectedYear }) {
  const [view, setView] = useState("both"); // "both" | "revenue" | "expense"

  const data = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, m) => ({
      month: MONTHS_PT[m].substring(0, 3),
      receita: 0,
      despesa: 0,
      saldo: 0,
    }));

    for (const t of transactions) {
      if (!t.date) continue;
      const d = new Date(t.date);
      if (d.getFullYear() !== selectedYear) continue;
      const m = d.getMonth();
      if (t.type === "entrada") months[m].receita += t.amount || 0;
      else months[m].despesa += t.amount || 0;
    }

    // Calcula saldo acumulado
    let acumulado = 0;
    for (const m of months) {
      acumulado += m.receita - m.despesa;
      m.saldo = acumulado;
      m.resultado = m.receita - m.despesa;
    }

    return months;
  }, [transactions, selectedYear]);

  const totals = useMemo(() => {
    const receita = data.reduce((s, m) => s + m.receita, 0);
    const despesa = data.reduce((s, m) => s + m.despesa, 0);
    const saldoFinal = data[data.length - 1]?.saldo ?? 0;
    const mesesPositivos = data.filter((m) => m.resultado > 0).length;
    const mesesNegativos = data.filter((m) => m.resultado < 0).length;
    return { receita, despesa, saldoFinal, mesesPositivos, mesesNegativos };
  }, [data]);

  return (
    <Card className="col-span-2">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="text-base font-semibold">Projeção Anual do Fluxo de Caixa — {selectedYear}</CardTitle>
          <div className="flex rounded-lg border border-border overflow-hidden text-xs">
            {[
              { key: "both", label: "Ambos" },
              { key: "revenue", label: "Receitas" },
              { key: "expense", label: "Despesas" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`px-3 py-1.5 font-medium transition-colors ${view === key ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          <div className="bg-success/8 border border-success/20 rounded-lg px-3 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Receita Total</p>
            <p className="text-sm font-bold text-success">{formatCurrency(totals.receita)}</p>
          </div>
          <div className="bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Despesa Total</p>
            <p className="text-sm font-bold text-destructive">{formatCurrency(totals.despesa)}</p>
          </div>
          <div className={`border rounded-lg px-3 py-2 ${totals.saldoFinal >= 0 ? "bg-success/8 border-success/20" : "bg-destructive/8 border-destructive/20"}`}>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Saldo Acumulado</p>
            <p className={`text-sm font-bold ${totals.saldoFinal >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(totals.saldoFinal)}
            </p>
          </div>
          <div className="bg-muted/50 border border-border rounded-lg px-3 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Meses</p>
            <div className="flex items-center gap-2 mt-0.5">
              {totals.mesesPositivos > 0 && (
                <span className="flex items-center gap-0.5 text-xs font-bold text-success">
                  <TrendingUp className="w-3 h-3" />{totals.mesesPositivos}
                </span>
              )}
              {totals.mesesNegativos > 0 && (
                <span className="flex items-center gap-0.5 text-xs font-bold text-destructive">
                  <TrendingDown className="w-3 h-3" />{totals.mesesNegativos}
                </span>
              )}
              {totals.mesesPositivos === 0 && totals.mesesNegativos === 0 && (
                <span className="flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="w-3 h-3" />—</span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-4">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => v === 0 ? "0" : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
              width={48}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
              formatter={(value) => <span style={{ color: "hsl(var(--muted-foreground))" }}>{value}</span>}
            />
            <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />

            {(view === "both" || view === "revenue") && (
              <Bar dataKey="receita" name="Receita" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} maxBarSize={32} opacity={0.85} />
            )}
            {(view === "both" || view === "expense") && (
              <Bar dataKey="despesa" name="Despesa" fill="hsl(var(--chart-4))" radius={[3, 3, 0, 0]} maxBarSize={32} opacity={0.85} />
            )}
            <Line
              dataKey="saldo"
              name="Saldo acumulado"
              type="monotone"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "hsl(var(--primary))", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}