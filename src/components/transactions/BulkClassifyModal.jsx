import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, CheckSquare, Square, ArrowUpRight, ArrowDownRight, Sparkles, ChevronDown, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function BulkClassifyModal({ open, onOpenChange, transactions, categories, onBulkUpdate }) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [newCategory, setNewCategory] = useState("");
  const [saving, setSaving] = useState(false);

  // Agrupa por descrição normalizada
  const groups = useMemo(() => {
    const map = new Map();
    for (const t of transactions) {
      const key = (t.description || "Sem descrição").trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: (t.description || "Sem descrição").trim(),
          type: t.type,
          items: [],
          categories: new Set(),
          totalAmount: 0,
        });
      }
      const g = map.get(key);
      g.items.push(t);
      g.categories.add(t.category || "");
      g.totalAmount += t.amount || 0;
    }
    return Array.from(map.values()).sort((a, b) => b.items.length - a.items.length);
  }, [transactions]);

  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups.filter((g) => g.label.toLowerCase().includes(q));
  }, [groups, search]);

  const allVisibleIds = useMemo(() => filtered.flatMap((g) => g.items.map((t) => t.id)), [filtered]);

  const toggleItem = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleGroup = (g) => {
    const ids = g.items.map((t) => t.id);
    const allSelected = ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const toggleAll = () => {
    if (allVisibleIds.every((id) => selectedIds.has(id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allVisibleIds));
    }
  };

  const toggleExpand = (key) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Detecta o tipo dos itens selecionados
  const selectedType = useMemo(() => {
    if (selectedIds.size === 0) return null;
    const allTxns = transactions;
    const types = new Set(allTxns.filter((t) => selectedIds.has(t.id)).map((t) => t.type));
    if (types.size > 1) return "mixed";
    return [...types][0];
  }, [selectedIds, transactions]);

  const categoryOptions = useMemo(() => {
    if (!selectedType || selectedType === "mixed") return [];
    return [...new Set(categories.filter((c) => c.type === selectedType).map((c) => c.name))].sort();
  }, [categories, selectedType]);

  // Impede selecionar item de tipo diferente dos já selecionados
  const toggleItemSafe = (id) => {
    const t = transactions.find((tx) => tx.id === id);
    if (!t) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); return next; }
      // Verifica tipo dos já selecionados
      const existingTypes = new Set(transactions.filter((tx) => next.has(tx.id)).map((tx) => tx.type));
      if (existingTypes.size > 0 && !existingTypes.has(t.type)) {
        toast.error("Selecione apenas entradas ou apenas saídas por vez.");
        return prev;
      }
      next.add(id);
      return next;
    });
  };

  const toggleGroupSafe = (g) => {
    const ids = g.items.map((t) => t.id);
    const allSelected = ids.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds((prev) => { const next = new Set(prev); ids.forEach((id) => next.delete(id)); return next; });
      return;
    }
    // Verifica se mistura tipos
    const existingTypes = new Set(transactions.filter((t) => selectedIds.has(t.id)).map((t) => t.type));
    if (existingTypes.size > 0 && !existingTypes.has(g.type)) {
      toast.error("Selecione apenas entradas ou apenas saídas por vez.");
      return;
    }
    setSelectedIds((prev) => { const next = new Set(prev); ids.forEach((id) => next.add(id)); return next; });
  };

  const handleApply = async () => {
    if (!newCategory) { toast.error("Selecione uma categoria para aplicar."); return; }
    if (selectedIds.size === 0) { toast.error("Selecione ao menos um lançamento."); return; }
    if (selectedType === "mixed") { toast.error("Mistura de entradas e saídas. Selecione apenas um tipo."); return; }
    setSaving(true);
    await onBulkUpdate([...selectedIds], newCategory);
    setSaving(false);
    toast.success(`${selectedIds.size} lançamento(s) atualizados!`);
    setSelectedIds(new Set());
    setNewCategory("");
  };

  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.has(id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Classificação em Massa</DialogTitle>
          <DialogDescription>
            Lançamentos agrupados por descrição. Expanda um grupo para selecionar itens individualmente.
          </DialogDescription>
        </DialogHeader>

        {/* Search + select all */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={toggleAll} className="shrink-0">
            {allSelected ? <><CheckSquare className="w-4 h-4 mr-1.5" />Desmarcar</> : <><Square className="w-4 h-4 mr-1.5" />Todos</>}
          </Button>
        </div>

        {/* Group list */}
        <div className="flex-1 overflow-y-auto border border-border rounded-xl divide-y divide-border min-h-0">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-10 text-sm">Nenhum grupo encontrado</p>
          ) : (
            filtered.map((g) => {
              const expanded = expandedGroups.has(g.key);
              const groupIds = g.items.map((t) => t.id);
              const allGroupSelected = groupIds.every((id) => selectedIds.has(id));
              const someGroupSelected = groupIds.some((id) => selectedIds.has(id));
              const multiCat = g.categories.size > 1;
              const singleCat = g.categories.size === 1 ? [...g.categories][0] : null;

              return (
                <div key={g.key}>
                  {/* Group header row */}
                  <div className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 ${allGroupSelected ? "bg-primary/5" : someGroupSelected ? "bg-primary/3" : ""}`}>
                    {/* Checkbox group */}
                    <button onClick={() => toggleGroupSafe(g)} className="shrink-0">
                      {allGroupSelected
                        ? <CheckSquare className="w-4 h-4 text-primary" />
                        : someGroupSelected
                        ? <div className="w-4 h-4 border-2 border-primary rounded-sm bg-primary/30" />
                        : <Square className="w-4 h-4 text-muted-foreground" />}
                    </button>

                    {/* Type icon */}
                    <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${g.type === "entrada" ? "bg-success/10" : "bg-destructive/10"}`}>
                      {g.type === "entrada"
                        ? <ArrowUpRight className="w-3.5 h-3.5 text-success" />
                        : <ArrowDownRight className="w-3.5 h-3.5 text-destructive" />}
                    </div>

                    {/* Label + category */}
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(g.key)}>
                      <p className="text-sm font-medium truncate">{g.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        {multiCat && <Sparkles className="w-3 h-3 text-amber-500" />}
                        {multiCat ? `${g.categories.size} categorias diferentes` : (singleCat || "Sem categoria")}
                      </p>
                    </div>

                    {/* Count + total + expand */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="text-xs">{g.items.length}</Badge>
                      <span className={`text-sm font-semibold ${g.type === "entrada" ? "text-success" : "text-destructive"}`}>
                        {formatCurrency(g.totalAmount)}
                      </span>
                      <button onClick={() => toggleExpand(g.key)} className="text-muted-foreground hover:text-foreground transition-colors">
                        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded items */}
                  {expanded && (
                    <div className="bg-muted/20 border-t border-border divide-y divide-border/50">
                      {g.items.map((t) => {
                        const isSelected = selectedIds.has(t.id);
                        return (
                          <div
                            key={t.id}
                            onClick={() => toggleItemSafe(t.id)}
                            className={`flex items-center gap-3 pl-12 pr-4 py-2 cursor-pointer transition-colors hover:bg-muted/40 ${isSelected ? "bg-primary/5" : ""}`}
                          >
                            {isSelected
                              ? <CheckSquare className="w-3.5 h-3.5 text-primary shrink-0" />
                              : <Square className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                            <span className="text-xs text-muted-foreground w-20 shrink-0">
                              {t.date ? format(new Date(t.date.substring(0, 10)), "dd/MM/yy", { locale: ptBR }) : "—"}
                            </span>
                            <span className="text-xs flex-1 truncate text-muted-foreground">{t.category || "Sem categoria"}</span>
                            <span className={`text-xs font-semibold shrink-0 ${t.type === "entrada" ? "text-success" : "text-destructive"}`}>
                              {t.type === "entrada" ? "+" : "-"}{formatCurrency(t.amount)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Apply bar */}
        <div className="flex items-center gap-3 pt-2 border-t border-border">
          <span className="text-sm text-muted-foreground shrink-0 min-w-0">
            {selectedIds.size > 0 ? `${selectedIds.size} selecionado(s)` : "Nenhum selecionado"}
          </span>
          <div className="flex-1">
            <Select
              value={newCategory}
              onValueChange={setNewCategory}
              disabled={!selectedType || selectedType === "mixed"}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder={
                  !selectedType ? "Selecione itens primeiro..." :
                  selectedType === "mixed" ? "Tipos mistos — desfaça a seleção" :
                  `Categoria de ${selectedType}...`
                } />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleApply} disabled={saving || selectedIds.size === 0 || !newCategory || selectedType === "mixed"} className="shrink-0">
            {saving ? "Aplicando…" : "Aplicar"}
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}