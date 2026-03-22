import React from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

export default function TransactionFilters({ filters, setFilters, categories }) {
  const update = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="flex flex-wrap gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar..."
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

      <Select value={filters.status} onValueChange={(v) => update("status", v)}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos</SelectItem>
          <SelectItem value="pago">Pago</SelectItem>
          <SelectItem value="em_aberto">Em Aberto</SelectItem>
          <SelectItem value="cancelado">Cancelado</SelectItem>
        </SelectContent>
      </Select>

      <Input
        type="month"
        value={filters.month}
        onChange={(e) => update("month", e.target.value)}
        className="w-44"
      />
    </div>
  );
}