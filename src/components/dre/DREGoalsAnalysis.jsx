import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sparkles, Loader2, ChevronDown, ChevronUp,
  Target, TrendingUp, TrendingDown, Pencil, Check, X
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { formatCurrency, MONTHS_PT } from "@/lib/constants";

// ── Helpers ──────────────────────────────────────────────────────────────────

const pct = (real, meta) => (meta > 0 ? ((real - meta) / meta) * 100 : null);

const DeviationBadge = ({ real, meta, invert = false }) => {
  const diff = pct(real, meta);
  if (diff === null) return <span className="text-muted-foreground text-xs">—</span>;
  const positive = invert ? diff <= 0 : diff >= 0;
  const color = positive ? "text-success" : "text-destructive";
  const sign = diff >= 0 ? "+" : "";
  return (
    <span className={`text-xs font-semibold ${color}`}>
      {sign}{diff.toFixed(1)}%
    </span>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function DREGoalsAnalysis({ dreData, selectedYear, selectedMonth, selectedUnit }) {
  const [goals, setGoals] = useState(() => {
    // Inicializa metas: 12 meses, faturamento e despesas
    const stored = localStorage.getItem(`dre-goals-${selectedYear}`);
    if (stored) return JSON.parse(stored);
    return Array(12).fill(null).map(() => ({ revenue: "", expenses: "" }));
  });

  const [showGoals, setShowGoals] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftGoals, setDraftGoals] = useState(goals);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(true);

  // Persistir metas no localStorage quando o ano muda
  const saveGoals = (newGoals) => {
    setGoals(newGoals);
    localStorage.setItem(`dre-goals-${selectedYear}`, JSON.stringify(newGoals));
    setEditing(false);
    setDraftGoals(newGoals);
  };

  const visibleMonthIndices = useMemo(() => {
    if (selectedMonth === "all") return MONTHS_PT.map((_, i) => i);
    return [parseInt(selectedMonth)];
  }, [selectedMonth]);

  // Desvios por mês
  const deviations = useMemo(() => {
    return visibleMonthIndices.map((i) => {
      const metaRev = parseFloat(goals[i]?.revenue) || 0;
      const metaExp = parseFloat(goals[i]?.expenses) || 0;
      const realRev = dreData.totalEntradas[i] || 0;
      const realExp = (dreData.totalVariaveis[i] || 0) + (dreData.totalFixos[i] || 0);
      return {
        month: MONTHS_PT[i],
        idx: i,
        metaRev,
        metaExp,
        realRev,
        realExp,
        revDiff: metaRev > 0 ? realRev - metaRev : null,
        expDiff: metaExp > 0 ? realExp - metaExp : null,
      };
    });
  }, [visibleMonthIndices, goals, dreData]);

  const hasGoals = goals.some((g) => parseFloat(g?.revenue) > 0 || parseFloat(g?.expenses) > 0);

  const runAnalysis = async () => {
    setLoading(true);
    setAnalysis(null);

    const monthData = visibleMonthIndices.map((i) => ({
      mes: MONTHS_PT[i],
      metaFaturamento: parseFloat(goals[i]?.revenue) || null,
      realFaturamento: dreData.totalEntradas[i] || 0,
      desvioPctFaturamento: pct(dreData.totalEntradas[i] || 0, parseFloat(goals[i]?.revenue) || 0),
      metaDespesas: parseFloat(goals[i]?.expenses) || null,
      realDespesas: (dreData.totalVariaveis[i] || 0) + (dreData.totalFixos[i] || 0),
      desvioPctDespesas: pct(
        (dreData.totalVariaveis[i] || 0) + (dreData.totalFixos[i] || 0),
        parseFloat(goals[i]?.expenses) || 0
      ),
      margemReal: dreData.margemContribuicao[i] || 0,
      resultadoOperacional: dreData.ebitda[i] || 0,
    }));

    const prompt = `Você é um CFO experiente especialista em gestão financeira de PMEs brasileiras.
Analise o DRE Gerencial (Regime de Caixa) com foco em metas vs. realizado.

CONTEXTO:
- Ano: ${selectedYear}
- Unidade: ${selectedUnit === "all" ? "Todas as Unidades" : selectedUnit}
- Período filtrado: ${selectedMonth === "all" ? "Ano completo" : MONTHS_PT[parseInt(selectedMonth)]}

DADOS REAIS vs. METAS (mês a mês):
${JSON.stringify(monthData, null, 2)}

DADOS GERAIS DO DRE:
- Total Receitas: ${JSON.stringify(dreData.totalEntradas)}
- Total Custos Variáveis: ${JSON.stringify(dreData.totalVariaveis)}
- Total Gastos Fixos: ${JSON.stringify(dreData.totalFixos)}
- Margem de Contribuição: ${JSON.stringify(dreData.margemContribuicao)}
- EBITDA/Resultado Operacional: ${JSON.stringify(dreData.ebitda)}
- Grupos de despesas fixas: ${JSON.stringify(dreData.fixedRows?.map(r => ({ nome: r.label, total: r.monthly.reduce((s, v) => s + v, 0) })))}
- Grupos de custos variáveis: ${JSON.stringify(dreData.variableRows?.map(r => ({ nome: r.label, total: r.monthly.reduce((s, v) => s + v, 0) })))}

${hasGoals ? `INSTRUÇÃO ESPECIAL: Compare rigorosamente o realizado versus as metas definidas. Para cada mês com meta definida, calcule o desvio absoluto e percentual. Destaque os meses com maiores desvios negativos como prioridade de ação.` : `INSTRUÇÃO ESPECIAL: O usuário não definiu metas ainda. Analise somente os resultados reais, sugira metas razoáveis para os próximos meses com base nos dados históricos e tendências identificadas.`}

Sua análise deve incluir:

## 🎯 Análise de Metas vs. Realizado
${hasGoals ? "Para cada mês com meta definida: mostre o desvio absoluto e percentual. Destaque os mais críticos em negrito." : "Sugira metas numéricas específicas para faturamento e despesas com base nos dados reais observados."}

## 🔴 Desvios Críticos e Causas Prováveis
Identifique os maiores desvios negativos. Especule causas prováveis com base nos padrões dos dados (ex: queda brusca de receita, estouro de despesas fixas, sazonalidade). Cite valores exatos.

## 🟡 Alertas de Tendência
Identifique padrões preocupantes que podem comprometer os meses futuros se não corrigidos agora.

## 💡 Ações Corretivas Específicas
Liste 4-6 ações concretas e prioritárias, com foco nos desvios identificados. Exemplos: renegociar categoria X, implementar controle Y no mês Z, revisar pricing se margem abaixo de N%. Cite números específicos dos dados.

## 📊 Diagnóstico Geral
Em 3-4 frases, o diagnóstico da saúde financeira com base no DRE e nas metas.

Use linguagem direta. Cite sempre valores em reais e percentuais dos dados fornecidos.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      model: "claude_sonnet_4_6",
    });

    setAnalysis(result);
    setLoading(false);
    setShowAnalysis(true);
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-background">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">CFO Virtual — Metas & Análise</p>
              <p className="text-xs text-muted-foreground">
                Defina metas mensais e obtenha análise comparativa com IA
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8"
              onClick={() => { setShowGoals((v) => !v); setEditing(false); setDraftGoals(goals); }}
            >
              <Target className="w-3.5 h-3.5" />
              {showGoals ? "Ocultar Metas" : "Definir Metas"}
            </Button>
            {analysis && (
              <Button variant="ghost" size="sm" onClick={() => setShowAnalysis((v) => !v)} className="h-8 px-2">
                {showAnalysis ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            )}
            <Button
              size="sm"
              onClick={runAnalysis}
              disabled={loading}
              className="gap-1.5 h-8"
            >
              {loading ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analisando…</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5" /> {analysis ? "Reanalisar" : "Analisar com IA"}</>
              )}
            </Button>
          </div>
        </div>

        {/* Painel de Metas */}
        {showGoals && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="bg-muted/60 px-4 py-2.5 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Metas Mensais {selectedYear}
              </span>
              {!editing ? (
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => { setEditing(true); setDraftGoals(goals); }}>
                  <Pencil className="w-3 h-3" /> Editar
                </Button>
              ) : (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-success" onClick={() => saveGoals(draftGoals)}>
                    <Check className="w-3 h-3" /> Salvar
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground" onClick={() => { setEditing(false); setDraftGoals(goals); }}>
                    <X className="w-3 h-3" /> Cancelar
                  </Button>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground sticky left-0 bg-muted/30 min-w-[130px]">Métrica</th>
                    {visibleMonthIndices.map((i) => (
                      <th key={i} className="px-3 py-2 text-right font-semibold text-muted-foreground min-w-[110px]">
                        {MONTHS_PT[i]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {/* Meta Faturamento */}
                  <tr className="bg-success/5">
                    <td className="px-3 py-2 font-semibold text-success sticky left-0 bg-success/5 flex items-center gap-1.5">
                      <TrendingUp className="w-3 h-3" /> Meta Faturamento
                    </td>
                    {visibleMonthIndices.map((i) => (
                      <td key={i} className="px-3 py-1.5 text-right">
                        {editing ? (
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={draftGoals[i]?.revenue || ""}
                            onChange={(e) => {
                              const next = [...draftGoals];
                              next[i] = { ...next[i], revenue: e.target.value };
                              setDraftGoals(next);
                            }}
                            className="h-7 text-xs text-right w-28 ml-auto"
                          />
                        ) : (
                          <span className={goals[i]?.revenue ? "font-semibold text-foreground" : "text-muted-foreground"}>
                            {goals[i]?.revenue ? formatCurrency(parseFloat(goals[i].revenue)) : "—"}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Real Faturamento */}
                  <tr>
                    <td className="px-3 py-2 text-muted-foreground sticky left-0 bg-card pl-6">↳ Realizado</td>
                    {visibleMonthIndices.map((i) => (
                      <td key={i} className="px-3 py-2 text-right font-semibold text-success">
                        {formatCurrency(dreData.totalEntradas[i] || 0)}
                      </td>
                    ))}
                  </tr>

                  {/* Desvio Faturamento */}
                  <tr className="bg-muted/20">
                    <td className="px-3 py-2 text-muted-foreground sticky left-0 bg-muted/20 pl-6">↳ Desvio</td>
                    {deviations.map((d, idx) => (
                      <td key={idx} className="px-3 py-2 text-right">
                        {d.metaRev > 0 ? (
                          <div className="flex flex-col items-end">
                            <DeviationBadge real={d.realRev} meta={d.metaRev} />
                            <span className={`text-[10px] ${d.revDiff >= 0 ? "text-success" : "text-destructive"}`}>
                              {d.revDiff >= 0 ? "+" : ""}{formatCurrency(d.revDiff)}
                            </span>
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                    ))}
                  </tr>

                  {/* Meta Despesas */}
                  <tr className="bg-destructive/5 border-t-2 border-border">
                    <td className="px-3 py-2 font-semibold text-destructive sticky left-0 bg-destructive/5 flex items-center gap-1.5">
                      <TrendingDown className="w-3 h-3" /> Meta Despesas
                    </td>
                    {visibleMonthIndices.map((i) => (
                      <td key={i} className="px-3 py-1.5 text-right">
                        {editing ? (
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={draftGoals[i]?.expenses || ""}
                            onChange={(e) => {
                              const next = [...draftGoals];
                              next[i] = { ...next[i], expenses: e.target.value };
                              setDraftGoals(next);
                            }}
                            className="h-7 text-xs text-right w-28 ml-auto"
                          />
                        ) : (
                          <span className={goals[i]?.expenses ? "font-semibold text-foreground" : "text-muted-foreground"}>
                            {goals[i]?.expenses ? formatCurrency(parseFloat(goals[i].expenses)) : "—"}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Real Despesas */}
                  <tr>
                    <td className="px-3 py-2 text-muted-foreground sticky left-0 bg-card pl-6">↳ Realizado</td>
                    {visibleMonthIndices.map((i) => (
                      <td key={i} className="px-3 py-2 text-right font-semibold text-destructive">
                        {formatCurrency((dreData.totalVariaveis[i] || 0) + (dreData.totalFixos[i] || 0))}
                      </td>
                    ))}
                  </tr>

                  {/* Desvio Despesas */}
                  <tr className="bg-muted/20">
                    <td className="px-3 py-2 text-muted-foreground sticky left-0 bg-muted/20 pl-6">↳ Desvio</td>
                    {deviations.map((d, idx) => (
                      <td key={idx} className="px-3 py-2 text-right">
                        {d.metaExp > 0 ? (
                          <div className="flex flex-col items-end">
                            <DeviationBadge real={d.realExp} meta={d.metaExp} invert />
                            <span className={`text-[10px] ${d.expDiff <= 0 ? "text-success" : "text-destructive"}`}>
                              {d.expDiff >= 0 ? "+" : ""}{formatCurrency(d.expDiff)}
                            </span>
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {editing && (
              <div className="px-4 py-2 bg-muted/30 border-t text-xs text-muted-foreground">
                💡 Digite os valores sem formatação. Ex: 50000 para R$ 50.000
              </div>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground animate-pulse pt-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            O CFO Virtual está analisando seus dados e metas…
          </div>
        )}

        {/* Análise */}
        {analysis && showAnalysis && (
          <div className="pt-2 border-t border-border/60">
            <div className="prose prose-sm max-w-none dark:prose-invert
              prose-headings:text-sm prose-headings:font-bold prose-headings:mt-4 prose-headings:mb-2
              prose-p:text-sm prose-p:text-foreground prose-p:leading-relaxed
              prose-li:text-sm prose-li:text-foreground
              prose-strong:text-foreground
              [&_h2]:flex [&_h2]:items-center [&_h2]:gap-2
            ">
              <ReactMarkdown>{analysis}</ReactMarkdown>
            </div>
            <p className="text-[10px] text-muted-foreground mt-4 pt-3 border-t border-border/40">
              ⚠️ Análise gerada por IA com caráter orientativo. Consulte um contador ou CFO para decisões estratégicas. Usa créditos de integração (modelo avançado).
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}