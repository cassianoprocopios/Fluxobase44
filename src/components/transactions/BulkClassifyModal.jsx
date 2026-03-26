import React, { useState, useMemo, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, ArrowUpRight, ArrowDownRight, ChevronDown, ChevronRight,
  CheckCircle2, Loader2, Clock,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function BulkClassifyModal({ open, onOpenChange, transactions, categories, onBulkUpdate }) {
  const [search, setSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  // { groupKey: "saving" | "done" | null }
  const [groupStatus, setGroupStatus] = useState({});

  const unclassified = useMemo(
    () => transactions.filter((t) => !t.category || t.category.trim() === ""),
    [transactions]
  );

  const groups = useMemo(() => {
    const map = new Map();
    for (const t of unclassified) {
      const key = (t.description || "Sem descrição").trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: (t.description || "Sem descrição").trim(),
          type: t.type,
          items: [],
          totalAmount: 0,
        });
      }
      const g = map.get(key);
      g.items.push(t);
      g.totalAmount += t.amount || 0;
    }
    return Array.from(map.values()).sort((a, b) => b.items.length - a.items.length);
  }, [unclassified]);

  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups.filter((g) => g.label.toLowerCase().includes(q));
  }, [groups, search]);

  const categoryOptionsByType = useMemo(() => ({
    entrada: [...new Set(categories.filter((c) => c.type === "entrada").map((c) => c.name))].sort(),
    saida: [...new Set(categories.filter((c) => c.type === "saida").map((c) => c.name))].sort(),
  }), [categories]);

  const toggleExpand = (key) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Aplica a categoria imediatamente ao selecionar — sem botão extra
  const handleSelectCategory = useCallback(async (group, cat) => {
    if (!cat || groupStatus[group.key] === "saving") return;
    setGroupStatus((prev) => ({ ...prev, [group.key]: "saving" }));
    const ids = group.items.map((t) => t.id);
    await onBulkUpdate(ids, cat);
    setGroupStatus((prev) => ({ ...prev, [group.key]: "done" }));
    toast.success(`"${group.label}" → ${cat}`, { duration: 2000 });

    // Após todos ficarem "done", fecha automaticamente
    setTimeout(() => {
      setGroupStatus((prev) => {
        const allDone = groups.every((g) => prev[g.key] === "done" || g.key === group.key);
        if (allDone) onOpenChange(false);
        return prev;
      });
    }, 600);
  }, [groupStatus, groups, onBulkUpdate, onOpenChange]);

  const doneCount = groups.filter((g) => groupStatus[g.key] === "done").length;
  const pendingGroups = filtered.filter((g) => groupStatus[g.key] !== "done");
  const doneGroups = filtered.filter((g) => groupStatus[g.key] === "done");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Classificação Rápida</DialogTitle>
          <DialogDescription>
            {unclassified.length === 0 ? (
              <span className="text-success font-medium">✓ Todos os lançamentos foram classificados!</span>
            ) : (
              <>
                <span className="font-medium text-amber-600">{unclassified.length - doneCount * 0} lançamentos</span> agrupados por descrição.{" "}
                Selecione a categoria de cada grupo — ela é aplicada na hora.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        {groups.length > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{doneCount} de {groups.length} grupos classificados</span>
              <span>{Math.round((doneCount / groups.length) * 100)}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-success rounded-full transition-all duration-500"
                style={{ width: `${(doneCount / groups.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Search */}
        {unclassified.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
        )}

        {/* Group list */}
        <div className="flex-1 overflow-y-auto border border-border rounded-xl divide-y divide-border min-h-0">
          {unclassified.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-10">
              <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-success" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">Todos classificados!</p>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-10 text-sm">Nenhum grupo encontrado</p>
          ) : (
            <>
              {/* Grupos pendentes */}
              {pendingGroups.map((g) => {
                const expanded = expandedGroups.has(g.key);
                const status = groupStatus[g.key]; // "saving" | undefined

                return (
                  <div key={g.key}>
                    <div className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/20 transition-colors">
                      {/* Status */}
                      <div className="shrink-0 w-5 flex items-center justify-center">
                        {status === "saving"
                          ? <Loader2 className="w-4 h-4 text-primary animate-spin" />
                          : <Clock className="w-4 h-4 text-amber-400" />}
                      </div>

                      {/* Type */}
                      <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${g.type === "entrada" ? "bg-success/10" : "bg-destructive/10"}`}>
                        {g.type === "entrada"
                          ? <ArrowUpRight className="w-3.5 h-3.5 text-success" />
                          : <ArrowDownRight className="w-3.5 h-3.5 text-destructive" />}
                      </div>

                      {/* Description */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{g.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {g.items.length} lançamento(s) ·{" "}
                          <span className={`font-semibold ${g.type === "entrada" ? "text-success" : "text-destructive"}`}>
                            {g.type === "saida" ? "-" : "+"}{formatCurrency(g.totalAmount)}
                          </span>
                        </p>
                      </div>

                      {/* Category selector — aplica imediatamente */}
                      <div className="shrink-0 w-48" onClick={(e) => e.stopPropagation()}>
                        <Select
                          disabled={status === "saving"}
                          onValueChange={(v) => handleSelectCategory(g, v)}
                        >
                          <SelectTrigger className="h-8 text-xs border-amber-400/70 bg-amber-50/50 dark:bg-amber-900/10">
                            <SelectValue placeholder="Selecionar categoria..." />
                          </SelectTrigger>
                          <SelectContent>
                            {(categoryOptionsByType[g.type] || []).map((cat) => (
                              <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Expand */}
                      <button
                        onClick={() => toggleExpand(g.key)}
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Expanded items */}
                    {expanded && (
                      <div className="bg-muted/20 border-t border-border/50 divide-y divide-border/30">
                        {g.items.map((t) => (
                          <div key={t.id} className="flex items-center gap-3 pl-10 pr-4 py-1.5">
                            <span className="text-xs text-muted-foreground w-16 shrink-0">
                              {t.date ? format(new Date(t.date.substring(0, 10)), "dd/MM/yy", { locale: ptBR }) : "—"}
                            </span>
                            <span className="text-xs flex-1 truncate text-muted-foreground">{t.description || "—"}</span>
                            <span className="text-xs text-muted-foreground hidden sm:block w-20 truncate">{t.bank_account || "—"}</span>
                            <span className={`text-xs font-semibold shrink-0 ${t.type === "entrada" ? "text-success" : "text-destructive"}`}>
                              {t.type === "entrada" ? "+" : "-"}{formatCurrency(t.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Grupos já classificados (comprimidos) */}
              {doneGroups.length > 0 && (
                <div className="divide-y divide-border/30">
                  {doneGroups.map((g) => (
                    <div key={g.key} className="flex items-center gap-2.5 px-3 py-2 bg-success/5 opacity-60">
                      <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                      <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${g.type === "entrada" ? "bg-success/10" : "bg-destructive/10"}`}>
                        {g.type === "entrada"
                          ? <ArrowUpRight className="w-3.5 h-3.5 text-success" />
                          : <ArrowDownRight className="w-3.5 h-3.5 text-destructive" />}
                      </div>
                      <p className="text-sm text-muted-foreground flex-1 truncate line-through">{g.label}</p>
                      <span className="text-xs text-success font-medium">Classificado</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}