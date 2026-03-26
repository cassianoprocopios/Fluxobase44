import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { normalizeTransaction, formatCurrency, MONTHS_PT } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Copy,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function Auditoria() {
  const queryClient = useQueryClient();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [deleteTarget, setDeleteTarget] = useState(null); // { id }

  const monthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;

  const { data: rawTransactions = [], isLoading } = useQuery({
    queryKey: ["transactions-audit", monthStr],
    queryFn: () =>
      base44.entities.Transaction.filter(
        { date: { $gte: `${monthStr}-01`, $lte: `${monthStr}-31` } },
        "-date",
        2000
      ),
  });

  const transactions = useMemo(
    () => rawTransactions.map(normalizeTransaction),
    [rawTransactions]
  );

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Transaction.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions-audit", monthStr] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setDeleteTarget(null);
      toast.success("Lançamento excluído!");
    },
  });

  // Detecta duplicatas: mesmo description (normalizado), mesmo amount, mesmo type, mesmo mês
  const duplicateGroups = useMemo(() => {
    const key = (t) => {
      const desc = (t.description || t.category || "").trim().toLowerCase();
      const amount = (t.amount || 0).toFixed(2);
      return `${t.type}||${desc}||${amount}`;
    };

    const map = new Map();
    for (const t of transactions) {
      const k = key(t);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(t);
    }

    return Array.from(map.entries())
      .filter(([, items]) => items.length > 1)
      .map(([k, items]) => {
        const [type, desc, amount] = k.split("||");
        return {
          key: k,
          type,
          desc: desc || "(sem descrição)",
          amount: parseFloat(amount),
          items: items.sort((a, b) => a.date?.localeCompare(b.date)),
        };
      })
      .sort((a, b) => b.items.length - a.items.length);
  }, [transactions]);

  const totalDuplicates = duplicateGroups.reduce(
    (acc, g) => acc + (g.items.length - 1),
    0
  );

  const toggleExpand = (key) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Auditoria de Duplicidades</h1>
          <p className="text-sm text-muted-foreground">
            Verifica lançamentos com mesma descrição e valor no período selecionado
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={String(selectedMonth)}
            onValueChange={(v) => setSelectedMonth(Number(v))}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS_PT.map((m, i) => (
                <SelectItem key={i} value={String(i)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(selectedYear)}
            onValueChange={(v) => setSelectedYear(Number(v))}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Copy className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{isLoading ? "…" : transactions.length}</p>
              <p className="text-xs text-muted-foreground">Total de lançamentos</p>
            </div>
          </CardContent>
        </Card>

        <Card className={duplicateGroups.length > 0 ? "border-amber-400/60" : ""}>
          <CardContent className="pt-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${duplicateGroups.length > 0 ? "bg-amber-500/10" : "bg-success/10"}`}>
              {duplicateGroups.length > 0 ? (
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-success" />
              )}
            </div>
            <div>
              <p className="text-2xl font-bold">{isLoading ? "…" : duplicateGroups.length}</p>
              <p className="text-xs text-muted-foreground">Grupos com duplicidade</p>
            </div>
          </CardContent>
        </Card>

        <Card className={totalDuplicates > 0 ? "border-destructive/40" : ""}>
          <CardContent className="pt-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${totalDuplicates > 0 ? "bg-destructive/10" : "bg-success/10"}`}>
              {totalDuplicates > 0 ? (
                <AlertTriangle className="w-5 h-5 text-destructive" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-success" />
              )}
            </div>
            <div>
              <p className="text-2xl font-bold">{isLoading ? "…" : totalDuplicates}</p>
              <p className="text-xs text-muted-foreground">Lançamentos possivelmente duplicados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status message */}
      {!isLoading && duplicateGroups.length === 0 && (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="pt-5 flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-success shrink-0" />
            <div>
              <p className="font-semibold text-success">Nenhuma duplicidade encontrada!</p>
              <p className="text-sm text-muted-foreground">
                Todos os {transactions.length} lançamentos de {MONTHS_PT[selectedMonth]} {selectedYear} são únicos.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Duplicate groups */}
      {!isLoading && duplicateGroups.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground font-medium">
            Foram encontrados <span className="text-destructive font-semibold">{duplicateGroups.length} grupos</span> com lançamentos repetidos. Revise cada um e exclua as duplicatas se necessário.
          </p>

          {duplicateGroups.map((group) => {
            const expanded = expandedGroups.has(group.key);
            // O primeiro é o "original", os demais são "duplicatas prováveis"
            return (
              <Card key={group.key} className="border-amber-400/50 overflow-hidden">
                {/* Group header */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                  onClick={() => toggleExpand(group.key)}
                >
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${group.type === "entrada" ? "bg-success/10" : "bg-destructive/10"}`}>
                    <AlertTriangle className={`w-4 h-4 ${group.type === "entrada" ? "text-success" : "text-destructive"}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate capitalize">{group.desc}</p>
                    <p className="text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[10px] mr-1 py-0">
                        {group.type === "entrada" ? "Entrada" : "Saída"}
                      </Badge>
                      {group.items.length} ocorrências · valor:{" "}
                      <span className={`font-semibold ${group.type === "entrada" ? "text-success" : "text-destructive"}`}>
                        {group.type === "saida" ? "-" : "+"}{formatCurrency(group.amount)}
                      </span>{" "}
                      · <span className="text-amber-600 font-medium">{group.items.length - 1} possível(is) duplicata(s)</span>
                    </p>
                  </div>

                  <div className="shrink-0 text-muted-foreground">
                    {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </button>

                {/* Expanded rows */}
                {expanded && (
                  <div className="border-t border-border divide-y divide-border/50">
                    {group.items.map((t, idx) => (
                      <div
                        key={t.id}
                        className={`flex items-center gap-3 px-4 py-3 ${idx === 0 ? "bg-success/5" : "bg-amber-50/50 dark:bg-amber-900/10"}`}
                      >
                        {/* Status badge */}
                        <div className="shrink-0 w-20">
                          {idx === 0 ? (
                            <Badge className="bg-success/15 text-success text-[10px] border-0">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Original
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500/15 text-amber-600 text-[10px] border-0">
                              <AlertTriangle className="w-3 h-3 mr-1" /> Duplicata
                            </Badge>
                          )}
                        </div>

                        {/* Date */}
                        <span className="text-xs text-muted-foreground w-16 shrink-0">
                          {t.date
                            ? format(new Date(t.date.substring(0, 10)), "dd/MM/yyyy", { locale: ptBR })
                            : "—"}
                        </span>

                        {/* Description */}
                        <span className="text-sm flex-1 truncate">
                          {t.description || t.category || "—"}
                        </span>

                        {/* Category */}
                        <span className="text-xs text-muted-foreground hidden sm:block w-28 truncate">
                          {t.category || "Sem categoria"}
                        </span>

                        {/* Bank */}
                        <span className="text-xs text-muted-foreground hidden md:block w-24 truncate">
                          {t.bank_account || "—"}
                        </span>

                        {/* Amount */}
                        <span className={`text-sm font-semibold w-24 text-right shrink-0 ${t.type === "entrada" ? "text-success" : "text-destructive"}`}>
                          {t.type === "entrada" ? "+" : "-"}{formatCurrency(t.amount)}
                        </span>

                        {/* Action */}
                        <div className="shrink-0 w-20 text-right">
                          {idx === 0 ? (
                            <span className="text-xs text-success font-medium">✓ Manter</span>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-destructive hover:bg-destructive/10 hover:text-destructive text-xs gap-1"
                              onClick={() => setDeleteTarget({ id: t.id, desc: t.description || t.category })}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Excluir
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento duplicado?</AlertDialogTitle>
            <AlertDialogDescription>
              O lançamento <strong>"{deleteTarget?.desc}"</strong> será removido permanentemente. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir duplicata
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}