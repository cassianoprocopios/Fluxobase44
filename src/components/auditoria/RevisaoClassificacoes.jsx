import React, { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { formatCurrency, MONTHS_PT } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Check, X, ArrowUpRight, ArrowDownRight, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function RevisaoClassificacoes({ transactions, categories, selectedMonth, selectedYear }) {
  const queryClient = useQueryClient();
  const monthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;

  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Transaction.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions-audit", monthStr] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setEditingId(null);
      toast.success("Lançamento atualizado!");
    },
  });

  const entryCats = useMemo(() => categories.filter((c) => c.type === "entrada").sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), [categories]);
  const exitCats = useMemo(() => categories.filter((c) => c.type === "saida").sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), [categories]);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (filterType !== "all" && t.type !== filterType) return false;
      if (filterCategory !== "all" && t.category !== filterCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        const desc = (t.description || "").toLowerCase();
        const cat = (t.category || "").toLowerCase();
        if (!desc.includes(q) && !cat.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, filterType, filterCategory, search]);

  const totalEntradas = filtered.filter((t) => t.type === "entrada").reduce((s, t) => s + t.amount, 0);
  const totalSaidas = filtered.filter((t) => t.type === "saida").reduce((s, t) => s + t.amount, 0);

  const allCategories = useMemo(() => {
    const names = [...new Set(transactions.map((t) => t.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    return names;
  }, [transactions]);

  const startEdit = (t) => {
    setEditingId(t.id);
    setEditValues({ type: t.type, category: t.category || "", description: t.description || "" });
  };

  const saveEdit = (t) => {
    updateMutation.mutate({
      id: t.id,
      data: {
        type: editValues.type,
        category: editValues.category,
        description: editValues.description,
      },
    });
  };

  const currentEditCats = editValues.type === "entrada" ? entryCats : exitCats;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-9 text-sm"
            placeholder="Buscar descrição ou categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="entrada">Entradas</SelectItem>
            <SelectItem value="saida">Saídas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Todas as categorias" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {allCategories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Totals bar */}
      <div className="flex flex-wrap gap-4 px-3 py-2.5 bg-muted/40 rounded-lg text-sm">
        <span className="text-muted-foreground">{filtered.length} lançamentos</span>
        <span className="text-success font-semibold">+{formatCurrency(totalEntradas)}</span>
        <span className="text-destructive font-semibold">-{formatCurrency(totalSaidas)}</span>
        <span className={`font-bold ml-auto ${totalEntradas - totalSaidas >= 0 ? "text-success" : "text-destructive"}`}>
          Saldo: {formatCurrency(totalEntradas - totalSaidas)}
        </span>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60 border-b text-xs text-muted-foreground">
                  <th className="text-left px-4 py-2.5 w-24">Data</th>
                  <th className="text-left px-3 py-2.5 w-20">Tipo</th>
                  <th className="text-left px-3 py-2.5">Descrição</th>
                  <th className="text-left px-3 py-2.5 w-44">Categoria</th>
                  <th className="text-left px-3 py-2.5 w-32 hidden md:table-cell">Centro de Custo</th>
                  <th className="text-right px-3 py-2.5 w-28">Valor</th>
                  <th className="px-3 py-2.5 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-muted-foreground">
                      Nenhum lançamento encontrado
                    </td>
                  </tr>
                )}
                {filtered.map((t) => {
                  const isEditing = editingId === t.id;
                  return (
                    <tr key={t.id} className={`hover:bg-muted/20 transition-colors ${isEditing ? "bg-primary/5" : ""}`}>
                      {/* Data */}
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {t.date ? format(new Date(t.date.substring(0, 10)), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                      </td>

                      {/* Tipo */}
                      <td className="px-3 py-2.5">
                        {isEditing ? (
                          <Select value={editValues.type} onValueChange={(v) => setEditValues((p) => ({ ...p, type: v, category: "" }))}>
                            <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="entrada">Entrada</SelectItem>
                              <SelectItem value="saida">Saída</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className={`inline-flex items-center gap-1 text-xs font-medium ${t.type === "entrada" ? "text-success" : "text-destructive"}`}>
                            {t.type === "entrada"
                              ? <ArrowUpRight className="w-3.5 h-3.5" />
                              : <ArrowDownRight className="w-3.5 h-3.5" />}
                            {t.type === "entrada" ? "Entrada" : "Saída"}
                          </div>
                        )}
                      </td>

                      {/* Descrição */}
                      <td className="px-3 py-2.5 max-w-[200px]">
                        {isEditing ? (
                          <Input
                            className="h-7 text-xs"
                            value={editValues.description}
                            onChange={(e) => setEditValues((p) => ({ ...p, description: e.target.value }))}
                          />
                        ) : (
                          <span className="truncate block text-sm">{t.description || <span className="text-muted-foreground italic">sem descrição</span>}</span>
                        )}
                      </td>

                      {/* Categoria */}
                      <td className="px-3 py-2.5">
                        {isEditing ? (
                          <Select value={editValues.category} onValueChange={(v) => setEditValues((p) => ({ ...p, category: v }))}>
                            <SelectTrigger className="h-7 text-xs w-40"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              {currentEditCats.map((c) => (
                                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className={`text-xs font-normal ${!t.category ? "border-amber-400/60 text-amber-600" : ""}`}>
                            {t.category || "⚠ Sem categoria"}
                          </Badge>
                        )}
                      </td>

                      {/* Centro de custo */}
                      <td className="px-3 py-2.5 text-xs text-muted-foreground hidden md:table-cell truncate max-w-[120px]">
                        {t.cost_center || "—"}
                      </td>

                      {/* Valor */}
                      <td className={`px-3 py-2.5 text-sm font-semibold text-right whitespace-nowrap ${t.type === "entrada" ? "text-success" : "text-destructive"}`}>
                        {t.type === "entrada" ? "+" : "-"}{formatCurrency(t.amount)}
                      </td>

                      {/* Ações */}
                      <td className="px-3 py-2.5 text-right">
                        {isEditing ? (
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-success hover:bg-success/10"
                              disabled={updateMutation.isPending}
                              onClick={() => saveEdit(t)}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:bg-muted"
                              onClick={() => setEditingId(null)}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => startEdit(t)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}