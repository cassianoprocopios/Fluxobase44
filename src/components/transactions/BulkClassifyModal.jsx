import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, CheckSquare, Square, ArrowUpRight, ArrowDownRight, Sparkles } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { toast } from "sonner";

export default function BulkClassifyModal({ open, onOpenChange, transactions, categories, onBulkUpdate }) {
  const [search, setSearch] = useState("");
  const [selectedGroups, setSelectedGroups] = useState(new Set());
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
    // Retorna ordenado por quantidade de itens
    return Array.from(map.values()).sort((a, b) => b.items.length - a.items.length);
  }, [transactions]);

  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups.filter((g) => g.label.toLowerCase().includes(q));
  }, [groups, search]);

  const toggleGroup = (key) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedGroups.size === filtered.length) {
      setSelectedGroups(new Set());
    } else {
      setSelectedGroups(new Set(filtered.map((g) => g.key)));
    }
  };

  const categoryOptions = useMemo(() => {
    const cats = categories.map((c) => c.name);
    return [...new Set(cats)].sort();
  }, [categories]);

  const handleApply = async () => {
    if (!newCategory) { toast.error("Selecione uma categoria para aplicar."); return; }
    if (selectedGroups.size === 0) { toast.error("Selecione ao menos um grupo."); return; }

    setSaving(true);
    const idsToUpdate = groups
      .filter((g) => selectedGroups.has(g.key))
      .flatMap((g) => g.items.map((t) => t.id));

    await onBulkUpdate(idsToUpdate, newCategory);
    setSaving(false);
    toast.success(`${idsToUpdate.length} lançamento(s) atualizados!`);
    setSelectedGroups(new Set());
    setNewCategory("");
  };

  const selectedCount = groups
    .filter((g) => selectedGroups.has(g.key))
    .reduce((sum, g) => sum + g.items.length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Classificação em Massa</DialogTitle>
          <DialogDescription>
            Lançamentos agrupados por descrição. Selecione os grupos e aplique uma nova categoria.
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
            {selectedGroups.size === filtered.length && filtered.length > 0 ? (
              <><CheckSquare className="w-4 h-4 mr-1.5" /> Desmarcar</>
            ) : (
              <><Square className="w-4 h-4 mr-1.5" /> Selecionar todos</>
            )}
          </Button>
        </div>

        {/* Group list */}
        <div className="flex-1 overflow-y-auto border border-border rounded-xl divide-y divide-border min-h-0">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-10 text-sm">Nenhum grupo encontrado</p>
          ) : (
            filtered.map((g) => {
              const isSelected = selectedGroups.has(g.key);
              const multipleCategories = g.categories.size > 1;
              const singleCat = g.categories.size === 1 ? [...g.categories][0] : null;
              return (
                <div
                  key={g.key}
                  onClick={() => toggleGroup(g.key)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/40 ${isSelected ? "bg-primary/5" : ""}`}
                >
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}

                  <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${g.type === "entrada" ? "bg-success/10" : "bg-destructive/10"}`}>
                    {g.type === "entrada"
                      ? <ArrowUpRight className="w-3.5 h-3.5 text-success" />
                      : <ArrowDownRight className="w-3.5 h-3.5 text-destructive" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{g.label}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {multipleCategories ? (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          {g.categories.size} categorias diferentes
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{singleCat || "Sem categoria"}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant="secondary" className="text-xs">{g.items.length} lançamento{g.items.length > 1 ? "s" : ""}</Badge>
                    <span className={`text-sm font-semibold ${g.type === "entrada" ? "text-success" : "text-destructive"}`}>
                      {formatCurrency(g.totalAmount)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Apply bar */}
        <div className="flex items-center gap-3 pt-2 border-t border-border">
          <span className="text-sm text-muted-foreground shrink-0">
            {selectedCount > 0 ? `${selectedCount} lançamento(s) selecionado(s)` : "Nenhum selecionado"}
          </span>
          <div className="flex-1">
            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Nova categoria..." />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleApply} disabled={saving || selectedCount === 0 || !newCategory} className="shrink-0">
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