import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  PlayCircle,
  PauseCircle,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, PAYMENT_METHODS } from "@/lib/constants";
import RecurringForm from "@/components/recorrentes/RecurringForm";
import GenerateModal from "@/components/recorrentes/GenerateModal";

export default function Recorrentes() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [showGenerate, setShowGenerate] = useState(false);

  const { data: recurrings = [], isLoading } = useQuery({
    queryKey: ["recurrings"],
    queryFn: () => base44.entities.RecurringTransaction.list("name"),
  });

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
  const canEdit = userRole === "admin" || userRole === "gerente";

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.RecurringTransaction.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurrings"] });
      setShowForm(false);
      toast.success("Lançamento recorrente criado!");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.RecurringTransaction.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurrings"] });
      setShowForm(false);
      setEditingItem(null);
      toast.success("Atualizado com sucesso!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RecurringTransaction.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurrings"] });
      setDeleteItem(null);
      toast.success("Recorrência excluída!");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }) =>
      base44.entities.RecurringTransaction.update(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurrings"] }),
  });

  const handleSubmit = (data) => {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const activeEntradas = recurrings.filter((r) => r.type === "entrada" && r.is_active !== false);
  const activeSaidas = recurrings.filter((r) => r.type === "saida" && r.is_active !== false);
  const totalEntradas = activeEntradas.reduce((s, r) => s + (r.amount || 0), 0);
  const totalSaidas = activeSaidas.reduce((s, r) => s + (r.amount || 0), 0);

  // Group by type
  const entradas = recurrings.filter((r) => r.type === "entrada");
  const saidas = recurrings.filter((r) => r.type === "saida");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lançamentos Recorrentes</h1>
          <p className="text-sm text-muted-foreground">
            Contas fixas que geram transações mensais automaticamente
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowGenerate(true)}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Gerar do Mês
          </Button>
          <Button size="sm" onClick={() => { setEditingItem(null); setShowForm(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Recorrência
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-success/5 border-success/20">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Entradas Fixas/mês</p>
            <p className="text-2xl font-bold text-success mt-1">{formatCurrency(totalEntradas)}</p>
            <p className="text-xs text-muted-foreground mt-1">{activeEntradas.length} ativas</p>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Saídas Fixas/mês</p>
            <p className="text-2xl font-bold text-destructive mt-1">{formatCurrency(totalSaidas)}</p>
            <p className="text-xs text-muted-foreground mt-1">{activeSaidas.length} ativas</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Saldo Fixo/mês</p>
            <p className={`text-2xl font-bold mt-1 ${totalEntradas - totalSaidas >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(totalEntradas - totalSaidas)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{recurrings.filter(r => r.is_active !== false).length} recorrências ativas</p>
          </CardContent>
        </Card>
      </div>

      {/* Sections */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : recurrings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <CalendarClock className="w-14 h-14 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">Nenhuma recorrência cadastrada</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
              Cadastre suas contas fixas para gerar automaticamente os lançamentos mensais com status "em aberto".
            </p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Cadastrar primeira recorrência
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecurringSection
            title="Entradas Recorrentes"
            items={entradas}
            type="entrada"
            canEdit={canEdit}
            onEdit={(item) => { setEditingItem(item); setShowForm(true); }}
            onDelete={setDeleteItem}
            onToggle={(item) => toggleActiveMutation.mutate({ id: item.id, is_active: !item.is_active })}
          />
          <RecurringSection
            title="Saídas Recorrentes"
            items={saidas}
            type="saida"
            canEdit={canEdit}
            onEdit={(item) => { setEditingItem(item); setShowForm(true); }}
            onDelete={setDeleteItem}
            onToggle={(item) => toggleActiveMutation.mutate({ id: item.id, is_active: !item.is_active })}
          />
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <RecurringForm
            item={editingItem}
            categories={categories}
            costCenters={costCenters}
            bankAccounts={bankAccounts}
            onSubmit={handleSubmit}
            onCancel={() => { setShowForm(false); setEditingItem(null); }}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Generate Modal */}
      <GenerateModal
        open={showGenerate}
        onClose={() => setShowGenerate(false)}
        recurrings={recurrings}
        categories={categories}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir recorrência?</AlertDialogTitle>
            <AlertDialogDescription>
              A recorrência "<strong>{deleteItem?.name}</strong>" será removida. Lançamentos já gerados não serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
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

function RecurringSection({ title, items, type, canEdit, onEdit, onDelete, onToggle }) {
  const isEntrada = type === "entrada";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {isEntrada
            ? <ArrowUpRight className="w-4 h-4 text-success" />
            : <ArrowDownRight className="w-4 h-4 text-destructive" />
          }
          {title}
          <Badge variant="outline" className="ml-auto text-xs">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhuma {isEntrada ? "entrada" : "saída"} recorrente
          </p>
        ) : (
          items.map((item) => (
            <RecurringCard
              key={item.id}
              item={item}
              canEdit={canEdit}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggle={onToggle}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function RecurringCard({ item, canEdit, onEdit, onDelete, onToggle }) {
  const isActive = item.is_active !== false;
  const isEntrada = item.type === "entrada";

  const pm = PAYMENT_METHODS.find((p) => p.value === item.payment_method)?.label || item.payment_method || "—";

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
        isActive ? "bg-card hover:border-primary/30" : "bg-muted/40 opacity-60"
      }`}
    >
      {/* Icon */}
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
          isEntrada ? "bg-success/10" : "bg-destructive/10"
        }`}
      >
        {isEntrada
          ? <ArrowUpRight className="w-4 h-4 text-success" />
          : <ArrowDownRight className="w-4 h-4 text-destructive" />
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold truncate">{item.name}</p>
          {!isActive && (
            <Badge variant="outline" className="text-xs py-0 px-1.5 text-muted-foreground">
              Pausada
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-muted-foreground">{item.category}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <CalendarClock className="w-3 h-3" />
            Dia {item.due_day}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">{pm}</span>
        </div>
      </div>

      {/* Amount */}
      <span className={`text-sm font-bold shrink-0 ${isEntrada ? "text-success" : "text-destructive"}`}>
        {formatCurrency(item.amount)}
      </span>

      {/* Actions */}
      {canEdit && (
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title={isActive ? "Pausar" : "Ativar"}
            onClick={() => onToggle(item)}
          >
            {isActive
              ? <PauseCircle className="w-3.5 h-3.5" />
              : <PlayCircle className="w-3.5 h-3.5" />
            }
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => onEdit(item)}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={() => onDelete(item)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}