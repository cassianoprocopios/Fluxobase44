import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle } from "lucide-react";

export default function BulkCreateModal({
  open,
  onOpenChange,
  selectedMatches,
  categories,
  onConfirm,
  isLoading,
}) {
  const [selectedCategory, setSelectedCategory] = useState("");

  const entradas = useMemo(
    () => selectedMatches.filter((m) => m.bankTx.type === "entrada"),
    [selectedMatches]
  );
  const saidas = useMemo(
    () => selectedMatches.filter((m) => m.bankTx.type === "saida"),
    [selectedMatches]
  );

  const handleConfirm = () => {
    if (!selectedCategory) {
      alert("Selecione uma categoria");
      return;
    }
    onConfirm(selectedCategory);
    setSelectedCategory("");
  };

  const handleClose = () => {
    setSelectedCategory("");
    onOpenChange(false);
  };

  // If both entrada and saida are selected, show warning
  const hasBothTypes = entradas.length > 0 && saidas.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Novos Lançamentos</DialogTitle>
          <DialogDescription>
            Configure os detalhes para {selectedMatches.length} transação(ões)
            selecionada(s)
          </DialogDescription>
        </DialogHeader>

        {hasBothTypes && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-200">
              Você selecionou entradas e saídas. Será necessário escolher uma
              categoria que aplique apenas ao tipo correspondente.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 py-3 text-sm">
          {entradas.length > 0 && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-success/10 border border-success/20">
              <span className="text-xs text-muted-foreground">Entradas:</span>
              <span className="font-semibold text-success">{entradas.length}</span>
            </div>
          )}
          {saidas.length > 0 && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20">
              <span className="text-xs text-muted-foreground">Saídas:</span>
              <span className="font-semibold text-destructive">{saidas.length}</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Categoria para os novos lançamentos *</Label>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger id="category">
              <SelectValue placeholder="Selecione uma categoria..." />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id || c.name} value={c.name}>
                  <span className="flex items-center gap-2">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {c.type === "entrada" ? "Entrada" : "Saída"}
                    </span>
                    {c.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!selectedCategory && (
            <p className="text-xs text-muted-foreground">
              Selecione uma categoria para continuar
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedCategory || isLoading}
          >
            {isLoading ? "Criando..." : "Criar Lançamentos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}