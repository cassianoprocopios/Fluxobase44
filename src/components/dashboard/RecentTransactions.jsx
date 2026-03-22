import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/constants";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export default function RecentTransactions({ transactions = [] }) {
  const recent = transactions.slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Últimos Lançamentos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhum lançamento registrado
          </p>
        ) : (
          <div className="space-y-3">
            {recent.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      t.type === "entrada"
                        ? "bg-success/10"
                        : "bg-destructive/10"
                    }`}
                  >
                    {t.type === "entrada" ? (
                      <ArrowUpRight className="w-4 h-4 text-success" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 text-destructive" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium truncate max-w-[180px]">
                      {t.description || t.category}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.date
                        ? format(new Date(t.date), "dd MMM", { locale: ptBR })
                        : "—"}{" "}
                      · {t.category}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    t.type === "entrada" ? "text-success" : "text-destructive"
                  }`}
                >
                  {t.type === "entrada" ? "+" : "-"}
                  {formatCurrency(t.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}