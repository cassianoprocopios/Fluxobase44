import React, { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  CalendarCheck,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, MONTHS_PT } from "@/lib/constants";

export default function GenerateModal({ open, onClose, recurrings }) {
  const queryClient = useQueryClient();
  const now = new Date();

  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1));
  const [selected, setSelected] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);

  const activeRecurrings = useMemo(
    () => recurrings.filter((r) => r.is_active !== false),
    [recurrings]
  );

  // Check which ones were already generated for the chosen month
  const targetYearMonth = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;

  const alreadyGenerated = useMemo(
    () => activeRecurrings.filter((r) => r.last_generated_month === targetYearMonth).map((r) => r.id),
    [activeRecurrings, targetYearMonth]
  );

  const pendingRecurrings = useMemo(
    () => activeRecurrings.filter((r) => r.last_generated_month !== targetYearMonth),
    [activeRecurrings, targetYearMonth]
  );

  // Auto-select all pending when month changes
  React.useEffect(() => {
    setSelected(pendingRecurrings.map((r) => r.id));
    setResult(null);
  }, [targetYearMonth, recurrings]);

  const toggleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selected.length === pendingRecurrings.length) {
      setSelected([]);
    } else {
      setSelected(pendingRecurrings.map((r) => r.id));
    }
  };

  const handleGenerate = async () => {
    if (selected.length === 0) return;

    setGenerating(true);
    const year = parseInt(selectedYear);
    const month = parseInt(selectedMonth);

    const toCreate = activeRecurrings
      .filter((r) => selected.includes(r.id))
      .map((r) => {
        // Clamp due_day to last day of month
        const lastDay = new Date(year, month, 0).getDate();
        const day = Math.min(r.due_day || 5, lastDay);
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

        return {
          date: dateStr,
          type: r.type,
          category: r.category,
          description: r.name + (r.description ? ` — ${r.description}` : ""),
          amount: r.amount,
          payment_method: r.payment_method || "outro",
          status: "em_aberto",
          cost_center: r.cost_center || "",
          bank_account: r.bank_account || "",
          client_supplier: r.client_supplier || "",
          is_recurring: true,
        };
      });

    // Bulk create transactions
    await base44.entities.Transaction.bulkCreate(toCreate);

    // Update last_generated_month on each recurring
    const updatePromises = activeRecurrings
      .filter((r) => selected.includes(r.id))
      .map((r) =>
        base44.entities.RecurringTransaction.update(r.id, {
          last_generated_month: targetYearMonth,
        })
      );
    await Promise.all(updatePromises);

    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["recurrings"] });

    setGenerating(false);
    setResult({ count: toCreate.length, month: MONTHS_PT[month - 1], year });
    toast.success(`${toCreate.length} lançamentos gerados para ${MONTHS_PT[month - 1]}/${year}!`);
  };

  const years = Array.from({ length: 3 }, (_, i) => String(now.getFullYear() - 1 + i));

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-primary" />
            Gerar Lançamentos do Mês
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle2 className="w-14 h-14 text-success mb-4" />
            <h3 className="text-lg font-semibold mb-1">Geração concluída!</h3>
            <p className="text-sm text-muted-foreground mb-1">
              <strong>{result.count}</strong> lançamentos criados com status{" "}
              <span className="font-medium text-primary">Em Aberto</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {result.month}/{result.year}
            </p>
            <Button className="mt-6" onClick={handleClose}>
              Fechar
            </Button>
          </div>
        ) : (
          <>
            {/* Month selector */}
            <div className="flex gap-3 items-center">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Mês</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS_PT.map((m, i) => (
                      <SelectItem key={i} value={String(i + 1)}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-28 space-y-1">
                <Label className="text-xs">Ano</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger>
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

            {/* Already generated notice */}
            {alreadyGenerated.length > 0 && (
              <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm">
                <AlertCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span>
                  <strong>{alreadyGenerated.length}</strong> recorrência(s) já foram geradas para este mês e estão ocultas da lista.
                </span>
              </div>
            )}

            {/* List */}
            {pendingRecurrings.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <CheckCircle2 className="w-10 h-10 text-success mb-3" />
                <p className="text-sm font-medium">
                  Todas as recorrências já foram geradas para {MONTHS_PT[parseInt(selectedMonth) - 1]}/{selectedYear}.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {pendingRecurrings.length} recorrência(s) pendentes
                  </span>
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs text-primary hover:underline"
                  >
                    {selected.length === pendingRecurrings.length ? "Desmarcar todos" : "Selecionar todos"}
                  </button>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {pendingRecurrings.map((r) => {
                    const isEntrada = r.type === "entrada";
                    const lastDay = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).getDate();
                    const day = Math.min(r.due_day || 5, lastDay);
                    const dateStr = `${String(day).padStart(2, "0")}/${String(selectedMonth).padStart(2, "0")}/${selectedYear}`;

                    return (
                      <label
                        key={r.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          selected.includes(r.id)
                            ? "border-primary/40 bg-primary/5"
                            : "border-border hover:border-muted-foreground/30"
                        }`}
                      >
                        <Checkbox
                          checked={selected.includes(r.id)}
                          onCheckedChange={() => toggleSelect(r.id)}
                        />
                        <div
                          className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                            isEntrada ? "bg-success/10" : "bg-destructive/10"
                          }`}
                        >
                          {isEntrada
                            ? <ArrowUpRight className="w-3.5 h-3.5 text-success" />
                            : <ArrowDownRight className="w-3.5 h-3.5 text-destructive" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{r.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.category} · Vence {dateStr}
                          </p>
                        </div>
                        <span
                          className={`text-sm font-semibold shrink-0 ${
                            isEntrada ? "text-success" : "text-destructive"
                          }`}
                        >
                          {formatCurrency(r.amount)}
                        </span>
                      </label>
                    );
                  })}
                </div>

                {/* Summary */}
                {selected.length > 0 && (
                  <div className="p-3 bg-muted/50 rounded-lg text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total a gerar:</span>
                      <span className="font-semibold">
                        {formatCurrency(
                          pendingRecurrings
                            .filter((r) => selected.includes(r.id))
                            .reduce((s, r) => s + (r.amount || 0), 0)
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-muted-foreground">Lançamentos:</span>
                      <span className="font-semibold">{selected.length}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={generating || selected.length === 0}
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CalendarCheck className="w-4 h-4 mr-2" />
                )}
                {generating
                  ? "Gerando..."
                  : `Gerar ${selected.length} lançamento(s)`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}