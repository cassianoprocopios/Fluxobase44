import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
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
import { Plus, Upload, ArrowLeftRight, Download } from "lucide-react";
import { toast } from "sonner";
import { normalizeTransaction } from "@/lib/constants";
import TransactionForm from "@/components/transactions/TransactionForm";
import TransactionTable from "@/components/transactions/TransactionTable";
import TransactionFilters from "@/components/transactions/TransactionFilters";
import { Link } from "react-router-dom";

export default function Lancamentos() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [deleteTx, setDeleteTx] = useState(null);
  const [filters, setFilters] = useState({
    search: "",
    type: "todos",
    month: "",
  });

  const { data: rawTransactions = [], isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => base44.entities.Transaction.list("-date", 5000),
  });
  const transactions = rawTransactions.map(normalizeTransaction);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => base44.entities.Category.list(),
  });

  const { data: costCenters = [] } = useQuery({
    queryKey: ["costCenters"],
    queryFn: () => base44.entities.CostCenter.list("name"),
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bankAccounts"],
    queryFn: () => base44.entities.BankAccount.list("name"),
  });

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const userRole = me?.role || "colaborador";

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Transaction.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setShowForm(false);
      toast.success("Lançamento criado!");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Transaction.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setShowForm(false);
      setEditingTx(null);
      toast.success("Lançamento atualizado!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Transaction.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setDeleteTx(null);
      toast.success("Lançamento excluído!");
    },
  });

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (filters.type !== "todos" && t.type !== filters.type) return false;
      if (filters.month && t.date && !t.date.startsWith(filters.month)) return false;
      if (
        filters.search &&
        !(t.description || "").toLowerCase().includes(filters.search.toLowerCase()) &&
        !(t.category || "").toLowerCase().includes(filters.search.toLowerCase()) &&
        !(t.client_supplier || "").toLowerCase().includes(filters.search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [transactions, filters]);

  const handleExportCSV = () => {
    const headers = ["Data", "Tipo", "Categoria", "Descrição", "Valor", "Pagamento", "Unidade", "Banco"];
    const rows = filtered.map((t) => [
      t.date,
      t.type,
      t.category || "",
      t.description || "",
      t.amount,
      t.payment_method || "",
      t.cost_center || "",
      t.bank_account || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lancamentos_${filters.month || new Date().toISOString().substring(0, 7)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = (data) => {
    if (editingTx) {
      updateMutation.mutate({ id: editingTx.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lançamentos</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} lançamentos encontrados
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/conciliacao">
            <Button variant="outline" size="sm">
              <ArrowLeftRight className="w-4 h-4 mr-2" />
              Conciliação
            </Button>
          </Link>
          <Link to="/importar">
            <Button variant="outline" size="sm">
              <Upload className="w-4 h-4 mr-2" />
              Importar
            </Button>
          </Link>
          <Button
            size="sm"
            onClick={() => {
              setEditingTx(null);
              setShowForm(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Lançamento
          </Button>
        </div>
      </div>

      <TransactionFilters
        filters={filters}
        setFilters={setFilters}
        categories={categories}
      />

      <TransactionTable
        transactions={filtered}
        userRole={userRole}
        onEdit={(t) => {
          setEditingTx(t);
          setShowForm(true);
        }}
        onDelete={(t) => setDeleteTx(t)}
      />

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <TransactionForm
            transaction={editingTx}
            categories={categories}
            costCenters={costCenters}
            bankAccounts={bankAccounts}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingTx(null);
            }}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTx} onOpenChange={() => setDeleteTx(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O lançamento será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTx && deleteMutation.mutate(deleteTx.id)}
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