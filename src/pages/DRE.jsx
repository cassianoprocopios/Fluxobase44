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
import { ChevronRight, ChevronDown } from "lucide-react";
import { formatCurrency, MONTHS_PT, normalizeTransaction } from "@/lib/constants";
import DREGoalsAnalysis from "@/components/dre/DREGoalsAnalysis";
import DrillDownModal from "@/components/shared/DrillDownModal";

// Grupos que compõem os Custos Variáveis (para margem de contribuição)
const CUSTOS_VARIAVEIS_GROUPS = ["Impostos e Financeiros", "Despesas Variáveis", "Custos Variáveis"];

// Grupos de receitas que NÃO entram no resultado operacional (Outras Receitas)
const OUTRAS_RECEITAS_GROUPS = ["Outras Receitas"];

// Grupos de saídas que ficam "abaixo da linha" (não são despesas operacionais)
const ABAIXO_DA_LINHA_GROUPS = ["Investimentos", "Distribuição de Lucros", "Saídas não Operacionais", "Livre 2", "Livre 3", "Não DRE"];

// Ordem desejada para os grupos de gastos fixos
const GASTOS_FIXOS_ORDER = [
  "Despesas Administrativas",
  "Despesas com Pessoal",
  "Despesas Operacionais",
  "Despesas Comerciais",
  "Despesas com Diretoria",
  "Despesas Financeiras",
  "Despesas Tributárias",
];

export default function DRE() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedUnit, setSelectedUnit] = useState("all");
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [drillDown, setDrillDown] = useState(null); // { title, transactions }

  const toggleGroup = (label) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  const { data: rawTransactions = [], isLoading } = useQuery({
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

  const dreData = useMemo(() => {
    const year = parseInt(selectedYear);

    // Categorias marcadas como "Não DRE" — excluir do DRE
    const naoDreCats = new Set(
      categories.filter((c) => c.dre_group === "Não DRE").map((c) => c.name)
    );

    const yearTxns = transactions.filter((t) => {
      if (!t.date || t.status === "cancelado") return false;
      if (new Date(t.date).getFullYear() !== year) return false;
      if (selectedUnit !== "all" && t.cost_center !== selectedUnit) return false;
      if (naoDreCats.has(t.category)) return false;
      return true;
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

    // Sempre regime de caixa (usa t.date)
    const getMonthlyTotals = (filterFn) => {
      const totals = Array(12).fill(0);
      yearTxns.filter(filterFn).forEach((t) => {
        const d = new Date(t.date);
        if (d.getFullYear() !== year) return;
        totals[d.getMonth()] += t.amount || 0;
      });
      return totals;
    };

    // ── RECEITAS OPERACIONAIS (regime de caixa)
    const opRevenueGroups = ["Recebimentos de Vendas", "Receitas Financeiras"];

    const revenueMonthly = Array(12).fill(0);
    opRevenueGroups.forEach((g) => {
      if (!entryGroups[g]) return;
      getMonthlyTotals((t) => t.type === "entrada" && (entryGroups[g] || []).includes(t.category))
        .forEach((v, i) => (revenueMonthly[i] += v));
    });

    // Entradas não mapeadas
    const knownEntryGroups = [...opRevenueGroups, "Não DRE", ...OUTRAS_RECEITAS_GROUPS];
    const knownEntryCats = knownEntryGroups.flatMap((g) => entryGroups[g] || []);
    getMonthlyTotals((t) => t.type === "entrada" && !knownEntryCats.includes(t.category))
      .forEach((v, i) => (revenueMonthly[i] += v));

    const entrySubRows = opRevenueGroups
      .filter((g) => entryGroups[g])
      .map((g) => ({
        label: g,
        monthly: getMonthlyTotals((t) => t.type === "entrada" && (entryGroups[g] || []).includes(t.category)),
        isGroup: true,
        subRows: [...new Set(entryGroups[g] || [])].map((cat) => ({
          label: cat,
          monthly: getMonthlyTotals((t) => t.type === "entrada" && t.category === cat),
        })).filter((sr) => sr.monthly.some((v) => v > 0)),
      }));

    const entryRows = [
      {
        label: "Recebimentos de Vendas",
        monthly: revenueMonthly,
        isGroup: true,
        subRows: entrySubRows.flatMap((r) => r.subRows),
      },
    ];

    const totalEntradas = revenueMonthly.slice();

    // ── OUTRAS RECEITAS
    const outrasReceitasRows = OUTRAS_RECEITAS_GROUPS
      .filter((g) => entryGroups[g])
      .map((g) => ({
        label: g,
        monthly: getMonthlyTotals((t) => t.type === "entrada" && (entryGroups[g] || []).includes(t.category)),
        isGroup: true,
        subRows: [...new Set(entryGroups[g] || [])].map((cat) => ({
          label: cat,
          monthly: getMonthlyTotals((t) => t.type === "entrada" && t.category === cat),
        })).filter((sr) => sr.monthly.some((v) => v > 0)),
      }));

    const totalOutrasReceitas = Array(12).fill(0);
    outrasReceitasRows.forEach((r) => r.monthly.forEach((v, i) => (totalOutrasReceitas[i] += v)));

    // ── CUSTOS VARIÁVEIS
    const variableRows = CUSTOS_VARIAVEIS_GROUPS
      .filter((g) => exitGroups[g])
      .map((g) => ({
        label: g,
        monthly: getMonthlyTotals((t) => t.type === "saida" && (exitGroups[g] || []).includes(t.category)),
        isGroup: true,
        subRows: [...new Set(exitGroups[g] || [])].map((cat) => ({
          label: cat,
          monthly: getMonthlyTotals((t) => t.type === "saida" && t.category === cat),
        })).filter((sr) => sr.monthly.some((v) => v > 0)),
      }));

    const allKnownExitGroups = [...CUSTOS_VARIAVEIS_GROUPS, ...GASTOS_FIXOS_ORDER, ...ABAIXO_DA_LINHA_GROUPS, "Não DRE"];
    const allKnownExitCats = allKnownExitGroups.flatMap((g) => exitGroups[g] || []);
    const ungroupedExits = getMonthlyTotals(
      (t) => t.type === "saida" && !allKnownExitCats.includes(t.category)
    );
    if (ungroupedExits.some((v) => v > 0)) {
      variableRows.push({ label: "Outras Despesas Variáveis", monthly: ungroupedExits, isGroup: true, subRows: [] });
    }

    const totalVariaveis = Array(12).fill(0);
    variableRows.forEach((r) => r.monthly.forEach((v, i) => (totalVariaveis[i] += v)));

    const margemContribuicao = totalEntradas.map((v, i) => v - totalVariaveis[i]);
    const margemContribuicaoPct = totalEntradas.map((v, i) =>
      v > 0 ? (margemContribuicao[i] / v) * 100 : 0
    );

    // ── GASTOS FIXOS
    const fixedRows = GASTOS_FIXOS_ORDER
      .filter((g) => exitGroups[g])
      .map((g) => ({
        label: g,
        monthly: getMonthlyTotals((t) => t.type === "saida" && (exitGroups[g] || []).includes(t.category)),
        isGroup: true,
        subRows: [...new Set(exitGroups[g] || [])].map((cat) => ({
          label: cat,
          monthly: getMonthlyTotals((t) => t.type === "saida" && t.category === cat),
        })).filter((sr) => sr.monthly.some((v) => v > 0)),
      }));

    const totalFixos = Array(12).fill(0);
    fixedRows.forEach((r) => r.monthly.forEach((v, i) => (totalFixos[i] += v)));

    const ebitda = margemContribuicao.map((v, i) => v - totalFixos[i]);
    const ebitdaPct = totalEntradas.map((v, i) => v > 0 ? (ebitda[i] / v) * 100 : 0);

    // ── ABAIXO DA LINHA
    const abaixoLinhaRows = ABAIXO_DA_LINHA_GROUPS
      .filter((g) => exitGroups[g])
      .map((g) => ({
        label: g,
        monthly: getMonthlyTotals((t) => t.type === "saida" && (exitGroups[g] || []).includes(t.category)),
        isGroup: true,
        subRows: [...new Set(exitGroups[g] || [])].map((cat) => ({
          label: cat,
          monthly: getMonthlyTotals((t) => t.type === "saida" && t.category === cat),
        })).filter((sr) => sr.monthly.some((v) => v > 0)),
      }));

    const totalAbaixoLinha = Array(12).fill(0);
    abaixoLinhaRows.forEach((r) => r.monthly.forEach((v, i) => (totalAbaixoLinha[i] += v)));

    const resultado = ebitda;
    const margemLiquida = totalEntradas.map((v, i) =>
      v > 0 ? (resultado[i] / v) * 100 : 0
    );

    const saldoFinal = resultado.map((v, i) => v + totalOutrasReceitas[i] - totalAbaixoLinha[i]);

    const totalSaidas = Array(12).fill(0);
    [...variableRows, ...fixedRows, ...abaixoLinhaRows].forEach((r) => r.monthly.forEach((v, i) => (totalSaidas[i] += v)));

    // Helper para buscar transações de uma categoria num mês específico
    const getTxnsForCatMonth = (filterFn) => yearTxns.filter(filterFn);

    return {
      entryRows,
      outrasReceitasRows,
      variableRows,
      fixedRows,
      abaixoLinhaRows,
      totalEntradas,
      totalOutrasReceitas,
      totalVariaveis,
      margemContribuicao,
      margemContribuicaoPct,
      totalFixos,
      ebitda,
      ebitdaPct,
      totalAbaixoLinha,
      totalSaidas,
      resultado,
      margemLiquida,
      saldoFinal,
      yearTxns,
    };
  }, [transactions, categories, selectedYear, selectedUnit]);

  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - 2 + i));

  const visibleMonths = selectedMonth === "all"
    ? MONTHS_PT.map((m, i) => ({ label: m, idx: i }))
    : [{ label: MONTHS_PT[parseInt(selectedMonth)], idx: parseInt(selectedMonth) }];

  const colSpanTotal = visibleMonths.length + (selectedMonth === "all" ? 2 : 1);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  const openDrill = (label, filterFn) => {
    const txns = dreData.yearTxns.filter(filterFn);
    setDrillDown({ title: label, transactions: txns });
  };

  const DrillRow = ({ row, negative }) => {
    const isExpanded = expandedGroups.has(row.label);
    const hasSubRows = row.subRows && row.subRows.length > 0;
    const visibleValues = visibleMonths.map(({ idx }) => row.monthly[idx] || 0);
    const total = visibleValues.reduce((s, v) => s + v, 0);

    return (
      <React.Fragment>
        <tr
          className={`hover:bg-muted/20 transition-colors ${hasSubRows ? "cursor-pointer" : ""}`}
          onClick={() => hasSubRows && toggleGroup(row.label)}
        >
          <td className="px-4 py-2.5 text-sm whitespace-nowrap sticky left-0 bg-card z-10 border-r pl-8 text-muted-foreground">
            <span className="flex items-center gap-1.5">
              {hasSubRows ? (
                isExpanded
                  ? <ChevronDown className="w-3.5 h-3.5 text-primary shrink-0" />
                  : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              ) : <span className="w-3.5 shrink-0" />}
              ↳ {row.label}
            </span>
          </td>
          {visibleMonths.map(({ idx }) => {
            const v = row.monthly[idx] || 0;
            return (
              <td
                key={idx}
                className={`px-3 py-2.5 text-sm text-right whitespace-nowrap ${negative && v > 0 ? "text-destructive" : ""} ${v !== 0 ? "cursor-pointer hover:underline hover:opacity-80" : ""}`}
                onClick={(e) => {
                  if (v === 0) return;
                  e.stopPropagation();
                  openDrill(
                    `${row.label} — ${MONTHS_PT[idx]}`,
                    (t) => {
                      const d = new Date(t.date);
                      return d.getMonth() === idx && t.category === row.label;
                    }
                  );
                }}
              >
                {formatCurrency(negative ? -v : v)}
              </td>
            );
          })}
          {selectedMonth === "all" && (
            <td
              className={`px-3 py-2.5 text-sm text-right font-semibold whitespace-nowrap border-l ${negative && total > 0 ? "text-destructive" : ""} ${total !== 0 ? "cursor-pointer hover:underline hover:opacity-80" : ""}`}
              onClick={(e) => {
                if (total === 0) return;
                e.stopPropagation();
                openDrill(row.label, (t) => t.category === row.label);
              }}
            >
              {formatCurrency(negative ? -total : total)}
            </td>
          )}
        </tr>
        {isExpanded && hasSubRows && row.subRows.map((sub) => {
          const subVals = visibleMonths.map(({ idx }) => sub.monthly[idx] || 0);
          const subTotal = subVals.reduce((s, v) => s + v, 0);
          const subColor = negative ? "text-destructive/80" : "text-success";
          return (
            <tr key={sub.label} className="hover:bg-muted/10 transition-colors">
              <td className="px-4 py-2 text-xs whitespace-nowrap sticky left-0 bg-card z-10 border-r pl-16 text-muted-foreground">
                • {sub.label}
              </td>
              {subVals.map((v, i) => {
                const monthIdx = visibleMonths[i]?.idx;
                return (
                  <td
                    key={i}
                    className={`px-3 py-2 text-xs text-right whitespace-nowrap ${subColor} ${v !== 0 ? "cursor-pointer hover:underline hover:opacity-80" : ""}`}
                    onClick={() => {
                      if (v === 0) return;
                      openDrill(
                        `${sub.label} — ${MONTHS_PT[monthIdx]}`,
                        (t) => {
                          const d = new Date(t.date);
                          return d.getMonth() === monthIdx && t.category === sub.label;
                        }
                      );
                    }}
                  >
                    {formatCurrency(negative ? -v : v)}
                  </td>
                );
              })}
              {selectedMonth === "all" && (
                <td
                  className={`px-3 py-2 text-xs text-right font-semibold whitespace-nowrap border-l ${subColor} ${subTotal !== 0 ? "cursor-pointer hover:underline hover:opacity-80" : ""}`}
                  onClick={() => {
                    if (subTotal === 0) return;
                    openDrill(sub.label, (t) => t.category === sub.label);
                  }}
                >
                  {formatCurrency(negative ? -subTotal : subTotal)}
                </td>
              )}
            </tr>
          );
        })}
      </React.Fragment>
    );
  };

  const SectionHeader = ({ label, colorClass }) => (
    <tr>
      <td colSpan={colSpanTotal} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider ${colorClass}`}>
        {label}
      </td>
    </tr>
  );

  const DRERow = ({ label, monthly, bold, highlight, negative, indent }) => {
    const visibleValues = visibleMonths.map(({ idx }) => monthly[idx] || 0);
    const total = visibleValues.reduce((s, v) => s + v, 0);
    return (
      <tr className={`${highlight ? "bg-muted/50" : "hover:bg-muted/20"} ${bold ? "font-semibold" : ""} transition-colors`}>
        <td className={`px-4 py-2.5 text-sm whitespace-nowrap sticky left-0 bg-card z-10 border-r ${highlight ? "bg-muted/50" : ""} ${indent ? "pl-8 text-muted-foreground" : ""}`}>
          {indent ? `↳ ${label}` : label}
        </td>
        {visibleValues.map((v, i) => (
          <td
            key={i}
            className={`px-3 py-2.5 text-sm text-right whitespace-nowrap ${
              negative && v > 0 ? "text-destructive" : v < 0 ? "text-destructive" : ""
            }`}
          >
            {formatCurrency(negative ? -v : v)}
          </td>
        ))}
        {selectedMonth === "all" && (
          <td
            className={`px-3 py-2.5 text-sm text-right font-semibold whitespace-nowrap border-l ${
              negative && total > 0 ? "text-destructive" : total < 0 ? "text-destructive" : ""
            }`}
          >
            {formatCurrency(negative ? -total : total)}
          </td>
        )}
      </tr>
    );
  };

  const ResultRow = ({ label, monthly, pctMonthly, bold = true, colorFn, showPct = false }) => (
    <>
      <tr className="bg-primary/5 border-t-2 border-primary/20">
        <td className={`px-4 py-3 text-sm sticky left-0 bg-primary/5 z-10 border-r ${bold ? "font-bold" : "font-semibold"}`}>
          {label}
        </td>
        {visibleMonths.map(({ idx }) => {
          const v = monthly[idx] || 0;
          return (
            <td key={idx} className={`px-3 py-3 text-sm text-right font-bold ${colorFn(v)}`}>
              {formatCurrency(v)}
            </td>
          );
        })}
        {selectedMonth === "all" && (() => {
          const total = monthly.reduce((s, v) => s + v, 0);
          return (
            <td className={`px-3 py-3 text-sm text-right font-bold border-l ${colorFn(total)}`}>
              {formatCurrency(total)}
            </td>
          );
        })()}
      </tr>
      {showPct && (
        <tr className="bg-primary/5">
          <td className="px-4 py-2 text-xs font-semibold text-muted-foreground sticky left-0 bg-primary/5 z-10 border-r pl-8">
            ↳ Margem (%)
          </td>
          {visibleMonths.map(({ idx }) => {
            const m = pctMonthly[idx] || 0;
            return (
              <td key={idx} className={`px-3 py-2 text-xs text-right font-semibold ${m < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                {m.toFixed(1)}%
              </td>
            );
          })}
          {selectedMonth === "all" && (() => {
            const totalEntradas = dreData.totalEntradas.reduce((s, v) => s + v, 0);
            const totalRes = monthly.reduce((s, v) => s + v, 0);
            const m = totalEntradas > 0 ? (totalRes / totalEntradas) * 100 : 0;
            return (
              <td className={`px-3 py-2 text-xs text-right font-semibold border-l ${m < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                {m.toFixed(1)}%
              </td>
            );
          })()}
        </tr>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      <DrillDownModal
        open={!!drillDown}
        onClose={() => setDrillDown(null)}
        title={drillDown?.title || ""}
        transactions={drillDown?.transactions || []}
      />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">DRE Gerencial</h1>
          <p className="text-sm text-muted-foreground">
            Demonstração de Resultado do Exercício — Regime de Caixa
            {selectedUnit !== "all" ? ` · ${selectedUnit}` : " · Todas as Unidades"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Filtro Unidade */}
          <Select value={selectedUnit} onValueChange={setSelectedUnit}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Todas as unidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as unidades</SelectItem>
              {costCenters.map((c) => (
                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro Mês */}
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

          {/* Filtro Ano */}
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-28">
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

      {/* Análise IA com Metas */}
      <DREGoalsAnalysis
        dreData={dreData}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        selectedUnit={selectedUnit}
      />

      {/* Tabela DRE */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/80 border-b">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sticky left-0 bg-muted/80 z-10 border-r min-w-[200px]">
                    Descrição
                  </th>
                  {visibleMonths.map(({ label }) => (
                    <th key={label} className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground min-w-[100px]">
                      {label}
                    </th>
                  ))}
                  {selectedMonth === "all" && (
                    <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground border-l min-w-[110px]">
                      Total
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">

                {/* ── RECEITAS OPERACIONAIS ── */}
                <SectionHeader label="Receitas Operacionais" colorClass="bg-success/8 text-success" />
                {dreData.entryRows.map((row) => (
                  <DrillRow key={row.label} row={row} negative={false} />
                ))}
                <DRERow label="TOTAL RECEITAS OPERACIONAIS" monthly={dreData.totalEntradas} bold highlight />

                {/* ── CUSTOS VARIÁVEIS ── */}
                <SectionHeader label="Custos Variáveis" colorClass="bg-orange-50 text-orange-600" />
                {dreData.variableRows.map((row) => (
                  <DrillRow key={row.label} row={row} negative />
                ))}
                <DRERow label="TOTAL CUSTOS VARIÁVEIS" monthly={dreData.totalVariaveis} bold highlight negative />

                {/* ── MARGEM DE CONTRIBUIÇÃO ── */}
                <ResultRow
                  label="MARGEM DE CONTRIBUIÇÃO"
                  monthly={dreData.margemContribuicao}
                  pctMonthly={dreData.margemContribuicaoPct}
                  colorFn={(v) => (v < 0 ? "text-destructive" : "text-primary")}
                  showPct
                />

                {/* ── GASTOS FIXOS ── */}
                <SectionHeader label="Gastos Fixos" colorClass="bg-destructive/5 text-destructive" />
                {dreData.fixedRows.map((row) => (
                  <DrillRow key={row.label} row={row} negative />
                ))}
                <DRERow label="TOTAL GASTOS FIXOS" monthly={dreData.totalFixos} bold highlight negative />

                {/* ── RESULTADO OPERACIONAL (LAJIR) ── */}
                <ResultRow
                  label="RESULTADO OPERACIONAL (LAJIR)"
                  monthly={dreData.ebitda}
                  pctMonthly={dreData.ebitdaPct}
                  colorFn={(v) => (v < 0 ? "text-destructive" : "text-primary")}
                  showPct
                />

                {/* ── OUTRAS RECEITAS (abaixo da linha) ── */}
                {dreData.outrasReceitasRows.length > 0 && (
                  <>
                    <SectionHeader label="Outras Receitas (Não Operacionais)" colorClass="bg-muted text-muted-foreground" />
                    {dreData.outrasReceitasRows.map((row) => (
                      <DrillRow key={row.label} row={row} negative={false} />
                    ))}
                    <DRERow label="TOTAL OUTRAS RECEITAS" monthly={dreData.totalOutrasReceitas} bold highlight />
                  </>
                )}

                {/* ── ABAIXO DA LINHA ── */}
                {dreData.abaixoLinhaRows.length > 0 && (
                  <>
                    <SectionHeader label="Saídas Não Operacionais / Investimentos" colorClass="bg-muted text-muted-foreground" />
                    {dreData.abaixoLinhaRows.map((row) => (
                      <DrillRow key={row.label} row={row} negative />
                    ))}
                    <DRERow label="TOTAL SAÍDAS NÃO OPERACIONAIS" monthly={dreData.totalAbaixoLinha} bold highlight negative />
                  </>
                )}

                {/* ── SALDO FINAL DO PERÍODO ── */}
                <ResultRow
                  label="SALDO FINAL DO PERÍODO"
                  monthly={dreData.saldoFinal}
                  pctMonthly={dreData.totalEntradas.map((v, i) => v > 0 ? (dreData.saldoFinal[i] / v) * 100 : 0)}
                  colorFn={(v) => (v < 0 ? "text-destructive" : "text-success")}
                  showPct
                />

              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}