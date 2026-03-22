import React, { useState, useEffect } from "react";
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
import { Switch } from "@/components/ui/switch";
import { PAYMENT_METHODS, STATUS_OPTIONS } from "@/lib/constants";
import { X } from "lucide-react";

const EMPTY_FORM = {
  date: new Date().toISOString().split("T")[0],
  type: "entrada",
  category: "",
  subcategory: "",
  description: "",
  amount: "",
  payment_method: "pix",
  status: "pago",
  cost_center: "",
  bank_account: "",
  client_supplier: "",
  is_recurring: false,
  dre_classification: "",
};

export default function TransactionForm({
  transaction,
  categories = [],
  onSubmit,
  onCancel,
  isSubmitting,
}) {
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (transaction) {
      setForm({
        ...EMPTY_FORM,
        ...transaction,
        amount: transaction.amount || "",
      });
    }
  }, [transaction]);

  const filteredCategories = categories.filter(
    (c) => c.type === form.type
  );

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      amount: parseFloat(form.amount) || 0,
    });
  };

  // Auto-set DRE classification when category changes
  useEffect(() => {
    if (form.category) {
      const cat = categories.find(
        (c) => c.name === form.category && c.type === form.type
      );
      if (cat?.dre_group) {
        setForm((prev) => ({ ...prev, dre_classification: cat.dre_group }));
      }
    }
  }, [form.category, form.type, categories]);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {transaction ? "Editar Lançamento" : "Novo Lançamento"}
        </h3>
        <Button type="button" variant="ghost" size="icon" onClick={onCancel}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Type */}
        <div className="space-y-2">
          <Label>Tipo *</Label>
          <Select value={form.type} onValueChange={(v) => handleChange("type", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="entrada">Entrada</SelectItem>
              <SelectItem value="saida">Saída</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date */}
        <div className="space-y-2">
          <Label>Data *</Label>
          <Input
            type="date"
            value={form.date}
            onChange={(e) => handleChange("date", e.target.value)}
            required
          />
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label>Categoria *</Label>
          <Select value={form.category} onValueChange={(v) => handleChange("category", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {filteredCategories.map((c) => (
                <SelectItem key={c.id || c.name} value={c.name}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Amount */}
        <div className="space-y-2">
          <Label>Valor *</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            value={form.amount}
            onChange={(e) => handleChange("amount", e.target.value)}
            required
          />
        </div>

        {/* Payment method */}
        <div className="space-y-2">
          <Label>Forma de Pagamento</Label>
          <Select
            value={form.payment_method}
            onValueChange={(v) => handleChange("payment_method", v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => handleChange("status", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Cost Center */}
        <div className="space-y-2">
          <Label>Centro de Custo</Label>
          <Input
            value={form.cost_center}
            onChange={(e) => handleChange("cost_center", e.target.value)}
            placeholder="Ex: Unidade 1"
          />
        </div>

        {/* Bank Account */}
        <div className="space-y-2">
          <Label>Banco / Conta</Label>
          <Input
            value={form.bank_account}
            onChange={(e) => handleChange("bank_account", e.target.value)}
            placeholder="Ex: Bradesco"
          />
        </div>

        {/* Client/Supplier */}
        <div className="space-y-2">
          <Label>Cliente / Fornecedor</Label>
          <Input
            value={form.client_supplier}
            onChange={(e) => handleChange("client_supplier", e.target.value)}
          />
        </div>

        {/* Subcategory */}
        <div className="space-y-2">
          <Label>Subcategoria</Label>
          <Input
            value={form.subcategory}
            onChange={(e) => handleChange("subcategory", e.target.value)}
          />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Textarea
          value={form.description}
          onChange={(e) => handleChange("description", e.target.value)}
          placeholder="Detalhe o lançamento..."
          rows={2}
        />
      </div>

      {/* Recurring */}
      <div className="flex items-center gap-3">
        <Switch
          checked={form.is_recurring}
          onCheckedChange={(v) => handleChange("is_recurring", v)}
        />
        <Label>Lançamento recorrente</Label>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : transaction ? "Atualizar" : "Criar"}
        </Button>
      </div>
    </form>
  );
}