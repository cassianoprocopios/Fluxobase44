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
import { Plus, ArrowLeftRight, Download, Upload, Undo2, Tags } from "lucide-react";
import { toast } from "sonner";
import { normalizeTransaction } from "@/lib/constants";
import { hasAction } from "@/lib/permissions";
import TransactionForm from "@/components/transactions/TransactionForm";
import TransactionTable from "@/components/transactions/TransactionTable";
import TransactionFilters from "@/components/transactions/TransactionFilters";
import OFXImportModal from "@/components/transactions/OFXImportModal";
import BulkClassifyModal from "@/components/transactions/BulkClassifyModal";
import UnclassifiedAlert from "@/components/transactions/UnclassifiedAlert";
import { Link } from "react-router-dom";

export default function Lancamentos() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [deleteTx, setDeleteTx] = useState(null);
  const [showOFX, setShowOFX] = useState(false);
  const [showClassify, setShowClassify] = useState(false);
  const [lastCreatedId, setLastCreatedId] = useState(null);
  const currentMonth = new Date().toISOString().substring(0, 7); // "YYYY-MM"

  const [filters, setFilters] = useState({
    search: "",
    type: "todos",
    month: currentMonth,
    dateFrom: "",
    dateTo: "",
    unit: "",
    bankAccount: "",
    category: "",
  });

  // Busca apenas o mês selecionado no filtro para evitar carregar tudo
  const { data: rawTransactions = [], isLoading } = useQuery({
    queryKey: ["transactions", filters.month],
    queryFn: () => {
      if (filters.month) {
        return base44.entities.Transaction.filter(
          { date: { $gte: `${filters.month}-01`, $lte: `${filters.month}-31` } },
          "-date",
          500
        );
      }
      return base44.entities.Transaction.list("-date", 500);
    },
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
  const canEdit = hasAction(userRole, "canEdit");
  const canCreate = hasAction(userRole, "canCreate");
  const canImport = hasAction(userRole, "canImport");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["transactions", filters.month] });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Transaction.create(data),
    onSuccess: (created) => {
      invalidate();
      setShowForm(false);
      setLastCreatedId(created?.id || null);
      toast.success("Lançamento criado!");
    },
  });

  const undoMutation = useMutation({
    mutationFn: (id) => base44.entities.Transaction.delete(id),
    onSuccess: () => {
      invalidate();
      setLastCreatedId(null);
      toast.success("Último lançamento desfeito!");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Transaction.update(id, data),
    onSuccess: () => {
      invalidate();
      setShowForm(false);
      setEditingTx(null);
      toast.success("Lançamento atualizado!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Transaction.delete(id),
    onSuccess: () => {
      invalidate();
      setDeleteTx(null);
      toast.success("Lançamento excluído!");
    },
  });

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (filters.type !== "todos" && t.type !== filters.type) return false;
      if (filters.month && t.date && !t.date.startsWith(filters.month)) return false;
      if (filters.dateFrom && t.date && t.date < filters.dateFrom) return false;
      if (filters.dateTo && t.date && t.date > filters.dateTo) return false;
      if (filters.unit && t.cost_center !== filters.unit) return false;
      if (filters.bankAccount && t.bank_account !== filters.bankAccount) return false;
      if (filters.category && t.category !== filters.category) return false;
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

  const handleBulkUpdate = async (ids, category) => {
    // Processa um por um com delay para evitar rate limit
    for (let i = 0; i < ids.length; i++) {
      await base44.entities.Transaction.update(ids[i], { category });
      if (i < ids.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500)); // 500ms entre requisições
      }
    }
    invalidate();
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
        <div className="flex gap-2 flex-wrap">
          {canCreate && lastCreatedId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => undoMutation.mutate(lastCreatedId)}
              disabled={undoMutation.isPending}
              className="text-destructive border-destructive/40 hover:bg-destructive/10"
            >
              <Undo2 className="w-4 h-4 mr-2" />
              Desfazer último
            </Button>
          )}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setShowClassify(true)} disabled={filtered.length === 0}>
              <Tags className="w-4 h-4 mr-2" />
              Classificar
            </Button>
          )}

          {canImport && (
            <Button variant="outline" size="sm" onClick={() => setShowOFX(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Importar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={filtered.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
          {canCreate && (
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
          )}
        </div>
      </div>

      <UnclassifiedAlert
        transactions={transactions}
        onClassify={() => setShowClassify(true)}
      />

      <TransactionFilters
        filters={filters}
        setFilters={setFilters}
        categories={categories}
        costCenters={costCenters}
        bankAccounts={bankAccounts}
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

      <OFXImportModal open={showOFX} onOpenChange={setShowOFX} />

      <BulkClassifyModal
        open={showClassify}
        onOpenChange={setShowClassify}
        transactions={filtered}
        categories={categories}
        onBulkUpdate={handleBulkUpdate}
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