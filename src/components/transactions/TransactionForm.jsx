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
import { PAYMENT_METHODS } from "@/lib/constants";
import { X } from "lucide-react";
import CategorySuggestion from "./CategorySuggestion";

const EMPTY_FORM = {
  date: new Date().toISOString().split("T")[0],
  type: "entrada",
  category: "",
  description: "",
  amount: "",
  payment_method: "pix",
  cost_center: "",
  bank_account: "",
  is_recurring: false,
  dre_classification: "",
};

export default function TransactionForm({
  transaction,
  categories = [],
  costCenters = [],
  bankAccounts = [],
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
    if (!form.cost_center) {
      alert("Por favor, selecione a Unidade.");
      return;
    }
    if (!form.bank_account) {
      alert("Por favor, selecione o Banco / Conta.");
      return;
    }
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

        {/* Cost Center */}
        <div className="space-y-2">
          <Label>Unidade *</Label>
          <Select value={form.cost_center} onValueChange={(v) => handleChange("cost_center", v)} required>
            <SelectTrigger className={!form.cost_center ? "border-destructive/50" : ""}>
              <SelectValue placeholder="Selecione a unidade" />
            </SelectTrigger>
            <SelectContent>
              {costCenters.map((c) => (
                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bank Account */}
        <div className="space-y-2">
          <Label>Banco / Conta *</Label>
          <Select value={form.bank_account} onValueChange={(v) => handleChange("bank_account", v)} required>
            <SelectTrigger className={!form.bank_account ? "border-destructive/50" : ""}>
              <SelectValue placeholder="Selecione o banco" />
            </SelectTrigger>
            <SelectContent>
              {bankAccounts.map((b) => (
                <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        <CategorySuggestion
          description={form.description}
          transactionType={form.type}
          existingCategories={categories}
          onSuggestion={(suggestion) => handleChange("category", suggestion)}
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