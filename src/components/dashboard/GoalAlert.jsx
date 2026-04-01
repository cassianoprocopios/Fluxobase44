import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Target, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/constants";

export default function GoalAlert({ selectedMonth, selectedYear, totalEntradas, totalResultado }) {
  const { data: goals = [] } = useQuery({
    queryKey: ["monthlyGoals"],
    queryFn: () => base44.entities.MonthlyGoal.list(),
  });

  const goal = goals.find((g) => g.year === selectedYear && g.month === selectedMonth + 1);

  if (!goal) return null;

  const hasRevenueGoal = goal.target_revenue != null && goal.target_revenue > 0;
  const hasResultGoal = goal.target_result != null;

  if (!hasRevenueGoal && !hasResultGoal) return null;

  const revenueOk = !hasRevenueGoal || totalEntradas >= goal.target_revenue;
  const resultOk = !hasResultGoal || totalResultado >= goal.target_result;
  const allOk = revenueOk && resultOk;

  const revPct = hasRevenueGoal && goal.target_revenue > 0
    ? ((totalEntradas / goal.target_revenue) * 100).toFixed(1)
    : null;
  const resPct = hasResultGoal && goal.target_result > 0
    ? ((totalResultado / goal.target_result) * 100).toFixed(1)
    : null;

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border px-4 py-3 ${
      allOk
        ? "bg-success/5 border-success/20"
        : "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700/50"
    }`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          allOk ? "bg-success/15" : "bg-amber-500/15"
        }`}>
          <Target className={`w-4 h-4 ${allOk ? "text-success" : "text-amber-600"}`} />
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${allOk ? "text-success" : "text-amber-800 dark:text-amber-300"}`}>
            {allOk ? "Metas do mês atingidas!" : "Acompanhamento de Metas"}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
            {hasRevenueGoal && (
              <span className="text-xs flex items-center gap-1">
                {revenueOk
                  ? <CheckCircle2 className="w-3 h-3 text-success" />
                  : <AlertTriangle className="w-3 h-3 text-amber-500" />}
                <span className="text-muted-foreground">Faturamento:</span>
                <span className={`font-semibold ${revenueOk ? "text-success" : "text-amber-700 dark:text-amber-400"}`}>
                  {formatCurrency(totalEntradas)}
                </span>
                <span className="text-muted-foreground">/ meta {formatCurrency(goal.target_revenue)}</span>
                {revPct && (
                  <span className={`font-bold ${revenueOk ? "text-success" : "text-amber-600"}`}>({revPct}%)</span>
                )}
              </span>
            )}
            {hasResultGoal && (
              <span className="text-xs flex items-center gap-1">
                {resultOk
                  ? <CheckCircle2 className="w-3 h-3 text-success" />
                  : <AlertTriangle className="w-3 h-3 text-amber-500" />}
                <span className="text-muted-foreground">Resultado:</span>
                <span className={`font-semibold ${resultOk ? "text-success" : "text-amber-700 dark:text-amber-400"}`}>
                  {formatCurrency(totalResultado)}
                </span>
                <span className="text-muted-foreground">/ meta {formatCurrency(goal.target_result)}</span>
                {resPct && (
                  <span className={`font-bold ${resultOk ? "text-success" : "text-amber-600"}`}>({resPct}%)</span>
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}