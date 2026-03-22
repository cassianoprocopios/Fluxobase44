import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, MONTHS_PT, normalizeTransaction } from "@/lib/constants";

export default function DRE() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState("all");

  const { data: rawTransactions = [], isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => base44.entities.Transaction.list("-date", 5000),
  });
  const transactions = rawTransactions.map(normalizeTransaction);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => base44.entities.Category.list(),
  });

  const dreData = useMemo(() => {
    const year = parseInt(selectedYear);
    const yearTxns = transactions.filter((t) => {
      if (!t.date || t.status === "cancelado") return false;
      return new Date(t.date).getFullYear() === year;
    });

    // Build DRE groups from categories
    const entryGroups = {};
    const exitGroups = {};

    categories.forEach((c) => {
      if (c.type === "entrada" && c.dre_group) {
        if (!entryGroups[c.dre_group]) entryGroups[c.dre_group] = [];
        entryGroups[c.dre_group].push(c.name);
      }
      if (c.type === "saida" && c.dre_group) {
        if (!exitGroups[c.dre_group]) exitGroups[c.dre_group] = [];
        exitGroups[c.dre_group].push(c.name);
      }
    });

    const getMonthlyTotals = (filterFn) => {
      const totals = Array(12).fill(0);
      yearTxns.filter(filterFn).forEach((t) => {
        const m = new Date(t.date).getMonth();
        totals[m] += t.amount || 0;
      });
      return totals;
    };

    // Entry groups
    const entryRows = Object.entries(entryGroups).map(([group, cats]) => ({
      label: group,
      monthly: getMonthlyTotals((t) => t.type === "entrada" && cats.includes(t.category)),
      isGroup: true,
    }));

    // Also add ungrouped entry categories
    const groupedEntryCats = Object.values(entryGroups).flat();
    const ungroupedEntries = getMonthlyTotals(
      (t) => t.type === "entrada" && !groupedEntryCats.includes(t.category)
    );
    if (ungroupedEntries.some((v) => v > 0)) {
      entryRows.push({ label: "Outras Receitas", monthly: ungroupedEntries, isGroup: true });
    }

    const totalEntradas = Array(12).fill(0);
    entryRows.forEach((r) => r.monthly.forEach((v, i) => (totalEntradas[i] += v)));

    // Exit groups
    const exitRows = Object.entries(exitGroups)
      .filter(([g]) => g !== "Não DRE")
      .map(([group, cats]) => ({
        label: group,
        monthly: getMonthlyTotals((t) => t.type === "saida" && cats.includes(t.category)),
        isGroup: true,
      }));

    const groupedExitCats = Object.values(exitGroups).flat();
    const ungroupedExits = getMonthlyTotals(
      (t) => t.type === "saida" && !groupedExitCats.includes(t.category)
    );
    if (ungroupedExits.some((v) => v > 0)) {
      exitRows.push({ label: "Outras Despesas", monthly: ungroupedExits, isGroup: true });
    }

    const totalSaidas = Array(12).fill(0);
    exitRows.forEach((r) => r.monthly.forEach((v, i) => (totalSaidas[i] += v)));

    const resultado = totalEntradas.map((v, i) => v - totalSaidas[i]);

    return { entryRows, exitRows, totalEntradas, totalSaidas, resultado };
  }, [transactions, categories, selectedYear]);

  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - 2 + i));

  const visibleMonths = selectedMonth === "all"
    ? MONTHS_PT.map((m, i) => ({ label: m, idx: i }))
    : [{ label: MONTHS_PT[parseInt(selectedMonth)], idx: parseInt(selectedMonth) }];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  const DRERow = ({ label, monthly, bold, highlight, negative }) => {
    const total = monthly.reduce((s, v) => s + v, 0);
    return (
      <tr className={`${highlight ? "bg-muted/50" : ""} ${bold ? "font-semibold" : ""}`}>
        <td className="px-4 py-2.5 text-sm whitespace-nowrap sticky left-0 bg-card z-10 border-r">
          {label}
        </td>
        {monthly.map((v, i) => (
          <td
            key={i}
            className={`px-3 py-2.5 text-sm text-right whitespace-nowrap ${
              negative && v > 0 ? "text-destructive" : v < 0 ? "text-destructive" : ""
            }`}
          >
            {formatCurrency(negative ? -v : v)}
          </td>
        ))}
        <td
          className={`px-3 py-2.5 text-sm text-right font-semibold whitespace-nowrap border-l ${
            negative && total > 0 ? "text-destructive" : total < 0 ? "text-destructive" : ""
          }`}
        >
          {formatCurrency(negative ? -total : total)}
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">DRE Gerencial</h1>
          <p className="text-sm text-muted-foreground">
            Demonstração de Resultado do Exercício
          </p>
        </div>
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

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/80 border-b">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sticky left-0 bg-muted/80 z-10 border-r">
                    Descrição
                  </th>
                  {MONTHS_PT.map((m) => (
                    <th
                      key={m}
                      className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {m}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground border-l">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {/* Section: Entries */}
                <tr className="bg-success/5">
                  <td colSpan={14} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-success">
                    Entradas
                  </td>
                </tr>
                {dreData.entryRows.map((row) => (
                  <DRERow key={row.label} {...row} />
                ))}
                <DRERow
                  label="TOTAL ENTRADAS"
                  monthly={dreData.totalEntradas}
                  bold
                  highlight
                />

                {/* Section: Exits */}
                <tr className="bg-destructive/5">
                  <td colSpan={14} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-destructive">
                    Saídas
                  </td>
                </tr>
                {dreData.exitRows.map((row) => (
                  <DRERow key={row.label} {...row} negative />
                ))}
                <DRERow
                  label="TOTAL SAÍDAS"
                  monthly={dreData.totalSaidas}
                  bold
                  highlight
                  negative
                />

                {/* Result */}
                <tr className="bg-primary/5 border-t-2 border-primary/20">
                  <td className="px-4 py-3 text-sm font-bold sticky left-0 bg-primary/5 z-10 border-r">
                    RESULTADO LÍQUIDO
                  </td>
                  {dreData.resultado.map((v, i) => (
                    <td
                      key={i}
                      className={`px-3 py-3 text-sm text-right font-bold ${
                        v < 0 ? "text-destructive" : "text-success"
                      }`}
                    >
                      {formatCurrency(v)}
                    </td>
                  ))}
                  <td
                    className={`px-3 py-3 text-sm text-right font-bold border-l ${
                      dreData.resultado.reduce((s, v) => s + v, 0) < 0
                        ? "text-destructive"
                        : "text-success"
                    }`}
                  >
                    {formatCurrency(dreData.resultado.reduce((s, v) => s + v, 0))}
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