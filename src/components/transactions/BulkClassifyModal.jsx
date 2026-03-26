import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Search, CheckSquare, Square, ArrowUpRight, ArrowDownRight,
  ChevronDown, ChevronRight, Check, Clock, CheckCircle2,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function BulkClassifyModal({ open, onOpenChange, transactions, categories, onBulkUpdate }) {
  const [search, setSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  // Mapa: groupKey -> categoria selecionada para aquele grupo
  const [groupCategories, setGroupCategories] = useState({});
  const [saving, setSaving] = useState(false);

  // Filtra apenas transações sem classificação
  const unclassifiedTransactions = useMemo(
    () => transactions.filter((t) => !t.category || t.category.trim() === ""),
    [transactions]
  );

  // Agrupa por descrição normalizada
  const groups = useMemo(() => {
    const map = new Map();
    for (const t of unclassifiedTransactions) {
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
  }, [unclassifiedTransactions]);

  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups.filter((g) => g.label.toLowerCase().includes(q));
  }, [groups, search]);

  const categoryOptionsByType = useMemo(() => {
    const entrada = [...new Set(categories.filter((c) => c.type === "entrada").map((c) => c.name))].sort();
    const saida = [...new Set(categories.filter((c) => c.type === "saida").map((c) => c.name))].sort();
    return { entrada, saida };
  }, [categories]);

  const toggleExpand = (key) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const pendingGroups = filtered.filter((g) => !groupCategories[g.key]);
  const readyGroups = filtered.filter((g) => !!groupCategories[g.key]);

  const handleApplyGroup = async (group) => {
    const cat = groupCategories[group.key];
    if (!cat) return;
    setSaving(true);
    const ids = group.items.map((t) => t.id);
    await onBulkUpdate(ids, cat);
    // Remove o grupo do mapa de categorias pois já foi salvo
    setGroupCategories((prev) => {
      const next = { ...prev };
      delete next[group.key];
      return next;
    });
    setSaving(false);
  };

  const handleApplyAll = async () => {
    const toApply = filtered.filter((g) => !!groupCategories[g.key]);
    if (toApply.length === 0) { toast.error("Defina a categoria de ao menos um grupo."); return; }
    setSaving(true);
    for (const group of toApply) {
      const ids = group.items.map((t) => t.id);
      await onBulkUpdate(ids, groupCategories[group.key]);
    }
    setGroupCategories({});
    toast.success(`${toApply.length} grupo(s) classificados!`);
    setSaving(false);
    if (unclassifiedTransactions.length - toApply.reduce((s, g) => s + g.items.length, 0) === 0) {
      setTimeout(() => onOpenChange(false), 800);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Classificação em Massa</DialogTitle>
          <DialogDescription>
            {unclassifiedTransactions.length === 0 ? (
              <span className="text-success font-medium">✓ Todos os lançamentos foram classificados!</span>
            ) : (
              <>
                <span className="font-medium text-amber-600">{unclassifiedTransactions.length} lançamentos</span> sem categoria, agrupados por descrição.
                Selecione a categoria de cada grupo e aplique.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        {unclassifiedTransactions.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        )}

        {/* Group list */}
        <div className="flex-1 overflow-y-auto border border-border rounded-xl divide-y divide-border min-h-0">
          {unclassifiedTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-10">
              <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-success" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">Todos os lançamentos foram classificados</p>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-10 text-sm">Nenhum grupo encontrado</p>
          ) : (
            filtered.map((g) => {
              const expanded = expandedGroups.has(g.key);
              const selectedCat = groupCategories[g.key] || "";
              const isReady = !!selectedCat;

              return (
                <div key={g.key} className={isReady ? "bg-success/5" : ""}>
                  {/* Group header */}
                  <div className="flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-muted/20">
                    {/* Status icon */}
                    <div className="shrink-0 w-5 flex items-center justify-center">
                      {isReady
                        ? <Check className="w-4 h-4 text-success" />
                        : <Clock className="w-4 h-4 text-amber-500" />}
                    </div>

                    {/* Type icon */}
                    <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${g.type === "entrada" ? "bg-success/10" : "bg-destructive/10"}`}>
                      {g.type === "entrada"
                        ? <ArrowUpRight className="w-3.5 h-3.5 text-success" />
                        : <ArrowDownRight className="w-3.5 h-3.5 text-destructive" />}
                    </div>

                    {/* Description + count */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{g.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {g.items.length} lançamento(s) ·{" "}
                        <span className={`font-semibold ${g.type === "entrada" ? "text-success" : "text-destructive"}`}>
                          {g.type === "saida" ? "-" : "+"}{formatCurrency(g.totalAmount)}
                        </span>
                      </p>
                    </div>

                    {/* Category selector (inline, igual ao OFX) */}
                    <div className="shrink-0 w-44" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={selectedCat}
                        onValueChange={(v) => setGroupCategories((prev) => ({ ...prev, [g.key]: v }))}
                      >
                        <SelectTrigger className={`h-7 text-xs ${isReady ? "border-success/50 bg-success/5" : "border-amber-400/70 bg-amber-50/50 dark:bg-amber-900/10"}`}>
                          <SelectValue placeholder="Selecionar categoria..." />
                        </SelectTrigger>
                        <SelectContent>
                          {(categoryOptionsByType[g.type] || []).map((cat) => (
                            <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Expand toggle */}
                    <button
                      onClick={() => toggleExpand(g.key)}
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Expanded sub-items */}
                  {expanded && (
                    <div className="bg-muted/20 border-t border-border/50 divide-y divide-border/30">
                      {g.items.map((t) => (
                        <div key={t.id} className="flex items-center gap-3 pl-10 pr-4 py-2">
                          <span className="text-xs text-muted-foreground w-16 shrink-0">
                            {t.date ? format(new Date(t.date.substring(0, 10)), "dd/MM/yy", { locale: ptBR }) : "—"}
                          </span>
                          <span className="text-xs flex-1 truncate text-muted-foreground">
                            {t.description || "—"}
                          </span>
                          <span className="text-xs text-muted-foreground hidden sm:block w-24 truncate">
                            {t.bank_account || "—"}
                          </span>
                          <span className={`text-xs font-semibold shrink-0 ${t.type === "entrada" ? "text-success" : "text-destructive"}`}>
                            {t.type === "entrada" ? "+" : "-"}{formatCurrency(t.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Status bar + apply all */}
        {unclassifiedTransactions.length > 0 && (
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              <span className="text-success font-medium">{readyGroups.length} grupo(s)</span> com categoria definida
              {pendingGroups.length > 0 && <> · <span className="text-amber-600 font-medium">{pendingGroups.length} pendente(s)</span></>}
            </p>
            <Button
              onClick={handleApplyAll}
              disabled={saving || readyGroups.length === 0}
              size="sm"
            >
              {saving ? "Salvando…" : `Salvar ${readyGroups.length} grupo(s)`}
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}