import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, SlidersHorizontal, X } from "lucide-react";

export default function TransactionFilters({ filters, setFilters, categories, costCenters, bankAccounts }) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Estado local dos filtros avançados — só aplica ao clicar em Buscar
  const [draft, setDraft] = useState({
    dateFrom: filters.dateFrom || "",
    dateTo: filters.dateTo || "",
    unit: filters.unit || "",
    bankAccount: filters.bankAccount || "",
    category: filters.category || "",
  });

  const updateDraft = (field, value) => setDraft((prev) => ({ ...prev, [field]: value }));

  const applyAdvanced = () => {
    setFilters((prev) => ({ ...prev, ...draft }));
    setShowAdvanced(false);
  };

  const clearFilters = () => {
    const cleared = { dateFrom: "", dateTo: "", unit: "", bankAccount: "", category: "" };
    setDraft(cleared);
    setFilters((prev) => ({ ...prev, search: "", type: "todos", ...cleared }));
  };

  const update = (field, value) => setFilters((prev) => ({ ...prev, [field]: value }));

  const hasActiveAdvancedFilters =
    filters.dateFrom || filters.dateTo || filters.unit || filters.bankAccount || filters.category;

  return (
    <div className="space-y-3">
      {/* Linha principal */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição, categoria..."
            value={filters.search}
            onChange={(e) => update("search", e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={filters.type} onValueChange={(v) => update("type", v)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="entrada">Entradas</SelectItem>
            <SelectItem value="saida">Saídas</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="month"
          value={filters.month}
          onChange={(e) => update("month", e.target.value)}
          className="w-44"
        />

        <Button
          variant={hasActiveAdvancedFilters ? "default" : "outline"}
          size="sm"
          onClick={() => setShowAdvanced((v) => !v)}
          className="gap-2 h-9"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filtros
          {hasActiveAdvancedFilters && (
            <span className="bg-primary-foreground text-primary rounded-full w-4 h-4 text-[10px] flex items-center justify-center font-bold">
              {[filters.dateFrom, filters.dateTo, filters.unit, filters.bankAccount, filters.category].filter(Boolean).length}
            </span>
          )}
        </Button>

        {hasActiveAdvancedFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 h-9 text-muted-foreground">
            <X className="w-3.5 h-3.5" />
            Limpar
          </Button>
        )}
      </div>

      {/* Filtros avançados */}
      {showAdvanced && (
        <div className="space-y-3 p-4 bg-muted/30 border border-border rounded-xl">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Data inicial</label>
              <Input
                type="date"
                value={draft.dateFrom}
                onChange={(e) => updateDraft("dateFrom", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Data final</label>
              <Input
                type="date"
                value={draft.dateTo}
                onChange={(e) => updateDraft("dateTo", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Unidade</label>
              <Select value={draft.unit || "all"} onValueChange={(v) => updateDraft("unit", v === "all" ? "" : v)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(costCenters || []).map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Conta bancária</label>
              <Select value={draft.bankAccount || "all"} onValueChange={(v) => updateDraft("bankAccount", v === "all" ? "" : v)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(bankAccounts || []).map((b) => (
                    <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Categoria</label>
              <Select value={draft.category || "all"} onValueChange={(v) => updateDraft("category", v === "all" ? "" : v)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(categories || []).map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAdvanced(false)}>Cancelar</Button>
            <Button size="sm" onClick={applyAdvanced} className="gap-1.5">
              <Search className="w-3.5 h-3.5" />
              Buscar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}