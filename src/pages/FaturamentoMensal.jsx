import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Plus, Pencil, Trash2, TrendingUp, DollarSign, Users } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, MONTHS_PT } from "@/lib/constants";

const EMPTY_FORM = {
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  cost_center: "",
  gross_revenue: "",
  commissions: "",
  notes: "",
};

export default function FaturamentoMensal() {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: billings = [], isLoading } = useQuery({
    queryKey: ["monthly-billing", selectedYear],
    queryFn: () =>
      base44.entities.MonthlyBilling.filter({ year: parseInt(selectedYear) }, "month"),
  });

  const { data: costCenters = [] } = useQuery({
    queryKey: ["costCenters"],
    queryFn: () => base44.entities.CostCenter.list("name"),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["monthly-billing", selectedYear] });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.MonthlyBilling.create(data),
    onSuccess: () => { invalidate(); setShowForm(false); toast.success("Faturamento registrado!"); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MonthlyBilling.update(id, data),
    onSuccess: () => { invalidate(); setShowForm(false); setEditing(null); toast.success("Faturamento atualizado!"); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.MonthlyBilling.delete(id),
    onSuccess: () => { invalidate(); setDeleteTarget(null); toast.success("Registro excluído!"); },
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (b) => {
    setEditing(b);
    setForm({
      year: b.year,
      month: b.month,
      cost_center: b.cost_center,
      gross_revenue: b.gross_revenue,
      commissions: b.commissions || "",
      notes: b.notes || "",
    });
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...form,
      year: parseInt(form.year),
      month: parseInt(form.month),
      gross_revenue: parseFloat(form.gross_revenue) || 0,
      commissions: parseFloat(form.commissions) || 0,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const years = Array.from({ length: 4 }, (_, i) => String(currentYear - 1 + i));

  // Agrupar por mês para exibição
  const byMonth = MONTHS_PT.map((label, idx) => {
    const month = idx + 1;
    const entries = billings.filter((b) => b.month === month);
    const totalRevenue = entries.reduce((s, b) => s + (b.gross_revenue || 0), 0);
    const totalCommissions = entries.reduce((s, b) => s + (b.commissions || 0), 0);
    return { month, label, entries, totalRevenue, totalCommissions };
  }).filter((m) => m.entries.length > 0);

  // KPIs anuais
  const totalRevenue = billings.reduce((s, b) => s + (b.gross_revenue || 0), 0);
  const totalCommissions = billings.reduce((s, b) => s + (b.commissions || 0), 0);
  const netRevenue = totalRevenue - totalCommissions;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Faturamento Mensal</h1>
          <p className="text-sm text-muted-foreground">
            Faturamento bruto e comissões por período de competência (independente do caixa)
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Registrar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Faturamento Bruto {selectedYear}</p>
              <p className="text-xl font-bold text-success">{formatCurrency(totalRevenue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Comissões do Período</p>
              <p className="text-xl font-bold text-destructive">{formatCurrency(totalCommissions)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Faturamento Líquido (após comissões)</p>
              <p className={`text-xl font-bold ${netRevenue >= 0 ? "text-primary" : "text-destructive"}`}>
                {formatCurrency(netRevenue)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela por mês */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : byMonth.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-10 pb-10 flex flex-col items-center gap-3 text-center">
            <TrendingUp className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-muted-foreground font-medium">Nenhum faturamento registrado para {selectedYear}</p>
            <Button size="sm" variant="outline" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Registrar primeiro faturamento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {byMonth.map(({ month, label, entries, totalRevenue: rev, totalCommissions: comm }) => (
            <Card key={month}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{label} {selectedYear}</CardTitle>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-success font-semibold">Fat: {formatCurrency(rev)}</span>
                    <span className="text-destructive font-semibold">Com: {formatCurrency(comm)}</span>
                    <span className="text-primary font-bold">Líq: {formatCurrency(rev - comm)}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left py-2 px-3">Unidade</th>
                        <th className="text-right py-2 px-3">Faturamento Bruto</th>
                        <th className="text-right py-2 px-3">Comissões</th>
                        <th className="text-right py-2 px-3">Fat. Líquido</th>
                        <th className="text-left py-2 px-3">Obs.</th>
                        <th className="py-2 px-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {entries.map((b) => (
                        <tr key={b.id} className="hover:bg-muted/20">
                          <td className="py-2.5 px-3 font-medium">{b.cost_center}</td>
                          <td className="py-2.5 px-3 text-right text-success font-semibold">
                            {formatCurrency(b.gross_revenue)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-destructive">
                            {formatCurrency(b.commissions || 0)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-primary font-semibold">
                            {formatCurrency((b.gross_revenue || 0) - (b.commissions || 0))}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground text-xs max-w-[200px] truncate">
                            {b.notes || "—"}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(b)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteTarget(b)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Faturamento" : "Registrar Faturamento"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mês *</Label>
                <Select value={String(form.month)} onValueChange={(v) => setForm((p) => ({ ...p, month: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS_PT.map((m, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ano *</Label>
                <Select value={String(form.year)} onValueChange={(v) => setForm((p) => ({ ...p, year: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Unidade *</Label>
              <Select value={form.cost_center} onValueChange={(v) => setForm((p) => ({ ...p, cost_center: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {costCenters.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Faturamento Bruto *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={form.gross_revenue}
                  onChange={(e) => setForm((p) => ({ ...p, gross_revenue: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Comissões
                  <span className="text-xs text-muted-foreground ml-1">(do período)</span>
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={form.commissions}
                  onChange={(e) => setForm((p) => ({ ...p, commissions: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                placeholder="Detalhes do período, ajustes, etc."
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="p-3 bg-muted/40 rounded-lg text-sm text-muted-foreground">
              💡 <strong>Faturamento Líquido:</strong>{" "}
              {formatCurrency(
                (parseFloat(form.gross_revenue) || 0) - (parseFloat(form.commissions) || 0)
              )}
              {" "}— as comissões serão pagas em outro momento via lançamento de saída.
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending || !form.cost_center}
              >
                {createMutation.isPending || updateMutation.isPending ? "Salvando..." : editing ? "Atualizar" : "Registrar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
            <AlertDialogDescription>
              O faturamento de <strong>{deleteTarget && MONTHS_PT[deleteTarget.month - 1]}/{deleteTarget?.year}</strong> — <strong>{deleteTarget?.cost_center}</strong> será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
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