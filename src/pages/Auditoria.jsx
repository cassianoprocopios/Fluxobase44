import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { normalizeTransaction, formatCurrency, MONTHS_PT } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
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
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownRight,
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
  const [deleteTarget, setDeleteTarget] = useState(null);

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

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => base44.entities.Category.list(),
  });

  const transactions = useMemo(
    () => rawTransactions.map(normalizeTransaction),
    [rawTransactions]
  );

  // Categorias marcadas como "Não DRE" (transferências entre contas)
  const naoDreCatNames = useMemo(
    () => new Set(categories.filter((c) => c.dre_group === "Não DRE").map((c) => c.name)),
    [categories]
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

  // ── 1. DUPLICATAS ──
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

  const totalDuplicates = duplicateGroups.reduce((acc, g) => acc + (g.items.length - 1), 0);

  // ── 2. TRANSFERÊNCIAS DESBALANCEADAS ──
  const transferIssues = useMemo(() => {
    // Pegar apenas transferências (categorias Não DRE)
    const transfers = transactions.filter((t) => naoDreCatNames.has(t.category));

    // Agrupar por data + valor — o par deve ser no mesmo dia e mesmo valor
    const byDayAmount = new Map();
    for (const t of transfers) {
      const day = (t.date || "").substring(0, 10);
      const key = `${day}||${(t.amount || 0).toFixed(2)}`;
      if (!byDayAmount.has(key)) byDayAmount.set(key, { entradas: [], saidas: [] });
      if (t.type === "entrada") byDayAmount.get(key).entradas.push(t);
      else byDayAmount.get(key).saidas.push(t);
    }

    const issues = [];

    for (const [k, { entradas, saidas }] of byDayAmount.entries()) {
      const [day, amountKey] = k.split("||");
      const amount = parseFloat(amountKey);

      // Pares balanceados: 1 entrada = 1 saída de mesmo valor no mesmo dia
      const pairs = Math.min(entradas.length, saidas.length);
      const extraEntradas = entradas.slice(pairs);
      const extraSaidas = saidas.slice(pairs);

      for (const t of extraEntradas) {
        issues.push({
          key: `orphan-entrada-${t.id}`,
          problem: "entrada_sem_saida",
          amount,
          items: [t],
        });
      }

      for (const t of extraSaidas) {
        issues.push({
          key: `orphan-saida-${t.id}`,
          problem: "saida_sem_entrada",
          amount,
          items: [t],
        });
      }
    }

    return issues.sort((a, b) => b.amount - a.amount);
  }, [transactions, naoDreCatNames]);

  // Totais de transferências para o card de resumo
  const transferSummary = useMemo(() => {
    const transfers = transactions.filter((t) => naoDreCatNames.has(t.category));
    const totalEntradas = transfers.filter((t) => t.type === "entrada").reduce((s, t) => s + t.amount, 0);
    const totalSaidas = transfers.filter((t) => t.type === "saida").reduce((s, t) => s + t.amount, 0);
    const diff = totalEntradas - totalSaidas;
    return { totalEntradas, totalSaidas, diff, count: transfers.length };
  }, [transactions, naoDreCatNames]);

  const toggleExpand = (key) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const years = [currentYear - 1, currentYear, currentYear + 1];
  const transferBalanced = Math.abs(transferSummary.diff) < 0.01;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Auditoria</h1>
          <p className="text-sm text-muted-foreground">
            Duplicidades e validação de transferências entre contas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS_PT.map((m, i) => (
                <SelectItem key={i} value={String(i)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              {duplicateGroups.length > 0
                ? <AlertTriangle className="w-5 h-5 text-amber-500" />
                : <CheckCircle2 className="w-5 h-5 text-success" />}
            </div>
            <div>
              <p className="text-2xl font-bold">{isLoading ? "…" : duplicateGroups.length}</p>
              <p className="text-xs text-muted-foreground">Grupos com duplicidade</p>
            </div>
          </CardContent>
        </Card>

        <Card className={transferIssues.length > 0 ? "border-destructive/40" : ""}>
          <CardContent className="pt-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${transferIssues.length > 0 ? "bg-destructive/10" : "bg-success/10"}`}>
              {transferIssues.length > 0
                ? <AlertTriangle className="w-5 h-5 text-destructive" />
                : <ShieldCheck className="w-5 h-5 text-success" />}
            </div>
            <div>
              <p className="text-2xl font-bold">{isLoading ? "…" : transferIssues.length}</p>
              <p className="text-xs text-muted-foreground">Transferências sem par</p>
            </div>
          </CardContent>
        </Card>

        <Card className={!transferBalanced && transferSummary.count > 0 ? "border-orange-400/60" : ""}>
          <CardContent className="pt-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${!transferBalanced && transferSummary.count > 0 ? "bg-orange-500/10" : "bg-success/10"}`}>
              <ArrowLeftRight className={`w-5 h-5 ${!transferBalanced && transferSummary.count > 0 ? "text-orange-500" : "text-success"}`} />
            </div>
            <div>
              <p className={`text-lg font-bold ${!transferBalanced && transferSummary.count > 0 ? "text-orange-600" : "text-success"}`}>
                {isLoading ? "…" : (transferBalanced || transferSummary.count === 0 ? "Balanceado" : formatCurrency(Math.abs(transferSummary.diff)))}
              </p>
              <p className="text-xs text-muted-foreground">
                {transferBalanced || transferSummary.count === 0 ? "Transferências balanceadas" : `Diferença: ${transferSummary.diff > 0 ? "+entradas" : "+saídas"}`}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && (
        <>
          {/* ── SEÇÃO DUPLICATAS ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Copy className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">Duplicidades</h2>
              {duplicateGroups.length === 0 && (
                <Badge className="bg-success/15 text-success border-0 text-xs">Nenhuma encontrada</Badge>
              )}
            </div>

            {duplicateGroups.length === 0 ? (
              <Card className="border-success/40 bg-success/5">
                <CardContent className="pt-5 flex items-center gap-3">
                  <ShieldCheck className="w-6 h-6 text-success shrink-0" />
                  <p className="text-sm text-success font-medium">
                    Todos os {transactions.length} lançamentos de {MONTHS_PT[selectedMonth]} {selectedYear} são únicos.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  <span className="text-destructive font-semibold">{duplicateGroups.length} grupos</span> com lançamentos repetidos encontrados. Revise e exclua as duplicatas se necessário.
                </p>

                {duplicateGroups.map((group) => {
                  const expanded = expandedGroups.has(group.key);
                  return (
                    <Card key={group.key} className="border-amber-400/50 overflow-hidden">
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

                      {expanded && (
                        <div className="border-t border-border divide-y divide-border/50">
                          {group.items.map((t, idx) => (
                            <div
                              key={t.id}
                              className={`flex items-center gap-3 px-4 py-3 ${idx === 0 ? "bg-success/5" : "bg-amber-50/50 dark:bg-amber-900/10"}`}
                            >
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
                              <span className="text-xs text-muted-foreground w-16 shrink-0">
                                {t.date ? format(new Date(t.date.substring(0, 10)), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                              </span>
                              <span className="text-sm flex-1 truncate">{t.description || t.category || "—"}</span>
                              <span className="text-xs text-muted-foreground hidden sm:block w-28 truncate">{t.category || "Sem categoria"}</span>
                              <span className="text-xs text-muted-foreground hidden md:block w-24 truncate">{t.bank_account || "—"}</span>
                              <span className={`text-sm font-semibold w-24 text-right shrink-0 ${t.type === "entrada" ? "text-success" : "text-destructive"}`}>
                                {t.type === "entrada" ? "+" : "-"}{formatCurrency(t.amount)}
                              </span>
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
              </>
            )}
          </div>

          {/* ── SEÇÃO TRANSFERÊNCIAS ENTRE CONTAS ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">Transferências entre Contas (Não DRE)</h2>
              {transferIssues.length === 0 && transferBalanced && transferSummary.count > 0 && (
                <Badge className="bg-success/15 text-success border-0 text-xs">Balanceadas</Badge>
              )}
            </div>

            {naoDreCatNames.size === 0 ? (
              <Card className="border-muted">
                <CardContent className="pt-5 flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-muted-foreground shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma categoria marcada como "Não DRE" encontrada. Configure nas categorias para habilitar esta verificação.
                  </p>
                </CardContent>
              </Card>
            ) : transferSummary.count === 0 ? (
              <Card className="border-muted bg-muted/20">
                <CardContent className="pt-5 flex items-center gap-3">
                  <ArrowLeftRight className="w-5 h-5 text-muted-foreground shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma transferência entre contas em {MONTHS_PT[selectedMonth]} {selectedYear}.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Resumo de transferências */}
                <Card className={!transferBalanced ? "border-orange-400/50 bg-orange-50/20 dark:bg-orange-900/10" : "border-success/40 bg-success/5"}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex flex-wrap items-center gap-6">
                      <div className="flex items-center gap-2">
                        <ArrowUpRight className="w-4 h-4 text-success" />
                        <div>
                          <p className="text-xs text-muted-foreground">Total Entradas</p>
                          <p className="text-sm font-semibold text-success">+{formatCurrency(transferSummary.totalEntradas)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <ArrowDownRight className="w-4 h-4 text-destructive" />
                        <div>
                          <p className="text-xs text-muted-foreground">Total Saídas</p>
                          <p className="text-sm font-semibold text-destructive">-{formatCurrency(transferSummary.totalSaidas)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${transferBalanced ? "bg-success" : "bg-orange-500"}`} />
                        <div>
                          <p className="text-xs text-muted-foreground">Diferença</p>
                          <p className={`text-sm font-semibold ${transferBalanced ? "text-success" : "text-orange-600"}`}>
                            {transferBalanced ? "R$ 0,00 ✓" : formatCurrency(transferSummary.diff)}
                          </p>
                        </div>
                      </div>
                      {!transferBalanced && (
                        <p className="text-xs text-orange-600 font-medium ml-auto">
                          ⚠ Transferências desbalanceadas — verifique os lançamentos abaixo
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Alertas de transferências sem par */}
                {transferIssues.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      <span className="text-destructive font-semibold">{transferIssues.length} lançamento(s)</span> de transferência sem contraparte correspondente:
                    </p>
                    {transferIssues.map((issue) => {
                      const expanded = expandedGroups.has(issue.key);
                      const isMissingOut = issue.problem === "entrada_sem_saida";
                      return (
                        <Card key={issue.key} className="border-orange-400/50 overflow-hidden">
                          <button
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                            onClick={() => toggleExpand(issue.key)}
                          >
                            <div className="w-8 h-8 rounded-md bg-orange-500/10 flex items-center justify-center shrink-0">
                              {isMissingOut
                                ? <ArrowUpRight className="w-4 h-4 text-orange-500" />
                                : <ArrowDownRight className="w-4 h-4 text-orange-500" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">
                                {isMissingOut ? "Entrada sem saída correspondente" : "Saída sem entrada correspondente"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {issue.items[0]?.description || issue.items[0]?.category || "—"} ·{" "}
                                <span className="font-semibold text-orange-600">{formatCurrency(issue.amount)}</span>
                                {" · "}
                                {issue.items[0]?.bank_account || "Conta não informada"}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-orange-600 border-orange-400/50 text-xs shrink-0">
                              {isMissingOut ? "Falta a saída" : "Falta a entrada"}
                            </Badge>
                            <div className="shrink-0 text-muted-foreground">
                              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </div>
                          </button>

                          {expanded && (
                            <div className="border-t border-border divide-y divide-border/50">
                              {issue.items.map((t) => (
                                <div key={t.id} className="flex items-center gap-3 px-4 py-3 bg-orange-50/40 dark:bg-orange-900/10">
                                  <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${t.type === "entrada" ? "bg-success/10" : "bg-destructive/10"}`}>
                                    {t.type === "entrada"
                                      ? <ArrowUpRight className="w-3.5 h-3.5 text-success" />
                                      : <ArrowDownRight className="w-3.5 h-3.5 text-destructive" />}
                                  </div>
                                  <span className="text-xs text-muted-foreground w-16 shrink-0">
                                    {t.date ? format(new Date(t.date.substring(0, 10)), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                                  </span>
                                  <span className="text-sm flex-1 truncate">{t.description || t.category || "—"}</span>
                                  <span className="text-xs text-muted-foreground hidden sm:block w-28 truncate">{t.category || "—"}</span>
                                  <span className="text-xs text-muted-foreground hidden md:block w-28 truncate">{t.bank_account || "—"}</span>
                                  <span className={`text-sm font-semibold w-24 text-right shrink-0 ${t.type === "entrada" ? "text-success" : "text-destructive"}`}>
                                    {t.type === "entrada" ? "+" : "-"}{formatCurrency(t.amount)}
                                  </span>
                                  <div className="shrink-0 w-20 text-right">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-destructive hover:bg-destructive/10 hover:text-destructive text-xs gap-1"
                                      onClick={() => setDeleteTarget({ id: t.id, desc: t.description || t.category })}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      Excluir
                                    </Button>
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

                {transferIssues.length === 0 && transferBalanced && (
                  <Card className="border-success/40 bg-success/5">
                    <CardContent className="pt-5 flex items-center gap-3">
                      <ShieldCheck className="w-6 h-6 text-success shrink-0" />
                      <p className="text-sm text-success font-medium">
                        Todas as transferências estão balanceadas — cada entrada tem uma saída correspondente de mesmo valor.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
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
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}