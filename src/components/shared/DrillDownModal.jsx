import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency, MONTHS_PT } from "@/lib/constants";
import { Pencil, Trash2 } from "lucide-react";
import TransactionForm from "@/components/transactions/TransactionForm";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DrillDownModal({ open, onClose, title, transactions }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => base44.entities.Category.list(),
    enabled: open,
  });
  const { data: costCenters = [] } = useQuery({
    queryKey: ["costCenters"],
    queryFn: () => base44.entities.CostCenter.list("name"),
    enabled: open,
  });
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bankAccounts"],
    queryFn: () => base44.entities.BankAccount.list("name"),
    enabled: open,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Transaction.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Transaction.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setConfirmDelete(null);
    },
  });

  const total = transactions.reduce((s, t) => s + (t.amount || 0), 0);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {transactions.length} lançamento{transactions.length !== 1 ? "s" : ""} · Total: <span className="font-semibold">{formatCurrency(total)}</span>
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {editing ? (
            <div className="border border-border rounded-lg p-4">
              <TransactionForm
                transaction={editing}
                categories={categories}
                costCenters={costCenters}
                bankAccounts={bankAccounts}
                isSubmitting={updateMutation.isPending}
                onCancel={() => setEditing(null)}
                onSubmit={(data) => updateMutation.mutate({ id: editing.id, data })}
              />
            </div>
          ) : (
            <>
              {transactions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum lançamento encontrado.</p>
              )}
              {transactions
                .slice()
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 border border-border rounded-lg px-3 py-2.5 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.description || t.category || "—"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t.date ? format(new Date(t.date + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                        {t.category && <span className="ml-1.5 text-muted-foreground/70">· {t.category}</span>}
                        {t.cost_center && <span className="ml-1.5 text-muted-foreground/70">· {t.cost_center}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-sm font-semibold ${t.type === "entrada" ? "text-success" : "text-destructive"}`}>
                        {t.type === "saida" ? "−" : "+"}{formatCurrency(t.amount || 0)}
                      </span>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(t)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      {confirmDelete === t.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 px-2 text-xs"
                            onClick={() => deleteMutation.mutate(t.id)}
                            disabled={deleteMutation.isPending}
                          >
                            Confirmar
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setConfirmDelete(null)}>
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setConfirmDelete(t.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}