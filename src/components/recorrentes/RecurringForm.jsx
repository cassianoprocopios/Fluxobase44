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

const EMPTY = {
  name: "",
  type: "saida",
  category: "",
  amount: "",
  due_day: "5",
  payment_method: "boleto",
  cost_center: "",
  bank_account: "",
  client_supplier: "",
  description: "",
  is_active: true,
  start_date: new Date().toISOString().split("T")[0],
  end_date: "",
};

export default function RecurringForm({ item, categories, onSubmit, onCancel, isSubmitting }) {
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (item) {
      setForm({ ...EMPTY, ...item, amount: item.amount || "" });
    } else {
      setForm(EMPTY);
    }
  }, [item]);

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const filteredCats = categories.filter((c) => c.type === form.type);

  const dueDayOptions = Array.from({ length: 28 }, (_, i) => i + 1);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      amount: parseFloat(form.amount) || 0,
      due_day: parseInt(form.due_day) || 1,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {item ? "Editar Recorrência" : "Nova Recorrência"}
        </h3>
        <Button type="button" variant="ghost" size="icon" onClick={onCancel}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <Label>Nome da conta *</Label>
        <Input
          placeholder="Ex: Aluguel, Internet, Conta de Luz…"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Type */}
        <div className="space-y-2">
          <Label>Tipo *</Label>
          <Select value={form.type} onValueChange={(v) => { set("type", v); set("category", ""); }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="entrada">Entrada</SelectItem>
              <SelectItem value="saida">Saída</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label>Categoria *</Label>
          <Select value={form.category} onValueChange={(v) => set("category", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {filteredCats.map((c) => (
                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
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
            onChange={(e) => set("amount", e.target.value)}
            required
          />
        </div>

        {/* Due day */}
        <div className="space-y-2">
          <Label>Dia do vencimento *</Label>
          <Select value={String(form.due_day)} onValueChange={(v) => set("due_day", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dueDayOptions.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  Dia {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Payment method */}
        <div className="space-y-2">
          <Label>Forma de pagamento</Label>
          <Select value={form.payment_method} onValueChange={(v) => set("payment_method", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Cost center */}
        <div className="space-y-2">
          <Label>Centro de custo</Label>
          <Input
            value={form.cost_center}
            onChange={(e) => set("cost_center", e.target.value)}
            placeholder="Ex: Unidade 1"
          />
        </div>

        {/* Bank account */}
        <div className="space-y-2">
          <Label>Banco / Conta</Label>
          <Input
            value={form.bank_account}
            onChange={(e) => set("bank_account", e.target.value)}
            placeholder="Ex: Bradesco"
          />
        </div>

        {/* Client/Supplier */}
        <div className="space-y-2">
          <Label>Fornecedor / Cliente</Label>
          <Input
            value={form.client_supplier}
            onChange={(e) => set("client_supplier", e.target.value)}
          />
        </div>

        {/* Start date */}
        <div className="space-y-2">
          <Label>Início</Label>
          <Input
            type="date"
            value={form.start_date}
            onChange={(e) => set("start_date", e.target.value)}
          />
        </div>

        {/* End date */}
        <div className="space-y-2">
          <Label>Encerramento <span className="text-muted-foreground text-xs">(opcional)</span></Label>
          <Input
            type="date"
            value={form.end_date}
            onChange={(e) => set("end_date", e.target.value)}
          />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Informações adicionais..."
          rows={2}
        />
      </div>

      {/* Active toggle */}
      <div className="flex items-center gap-3">
        <Switch
          checked={form.is_active !== false}
          onCheckedChange={(v) => set("is_active", v)}
        />
        <Label>Recorrência ativa</Label>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : item ? "Atualizar" : "Criar"}
        </Button>
      </div>
    </form>
  );
}