import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Trash2, Tag, Zap, Search, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";

const MATCH_TYPE_LABELS = {
  contains: "Contém",
  starts_with: "Começa com",
  ends_with: "Termina com",
  exact: "Igual a",
};

const TX_TYPE_LABELS = {
  entrada: "Entrada",
  saida: "Saída",
  ambos: "Ambos",
};

const EMPTY_FORM = {
  keyword: "",
  match_type: "contains",
  transaction_type: "ambos",
  category: "",
  is_active: true,
};

export default function RegrasCategorizacao() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["categorizationRules"],
    queryFn: () => base44.entities.CategorizationRule.list(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => base44.entities.Category.list(),
  });

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });
  const canEdit = me?.role === "admin" || me?.role === "gerente";

  const handleSave = async () => {
    if (!form.keyword.trim() || !form.category) return;
    setSaving(true);
    await base44.entities.CategorizationRule.create({
      ...form,
      keyword: form.keyword.trim(),
    });
    queryClient.invalidateQueries({ queryKey: ["categorizationRules"] });
    setForm(EMPTY_FORM);
    setSaving(false);
    toast({ title: "Regra criada!", description: `Keyword "${form.keyword}" → ${form.category}` });
  };

  const handleDelete = async (id) => {
    await base44.entities.CategorizationRule.delete(id);
    queryClient.invalidateQueries({ queryKey: ["categorizationRules"] });
    toast({ title: "Regra removida" });
  };

  const handleToggle = async (rule) => {
    await base44.entities.CategorizationRule.update(rule.id, { is_active: !rule.is_active });
    queryClient.invalidateQueries({ queryKey: ["categorizationRules"] });
  };

  const filteredCategories = (type) => {
    if (type === "ambos") return categories;
    return categories.filter((c) => c.type === type);
  };

  const filteredRules = rules.filter((r) =>
    r.keyword.toLowerCase().includes(search.toLowerCase()) ||
    r.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Regras de Categorização</h1>
          <p className="text-sm text-muted-foreground">
            Crie regras por palavra-chave para categorizar automaticamente transações na conciliação.
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-xl p-4">
        <Zap className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          Quando uma transação do extrato contiver a palavra-chave, ela será automaticamente categorizada durante a conciliação, eliminando trabalho manual.
          <br />
          <span className="font-medium text-foreground">Exemplo:</span> "Uber" → Transporte · "Salário" → Receita de Vendas
        </p>
      </div>

      {/* Create form */}
      {canEdit && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="w-4 h-4" /> Nova Regra
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Palavra-chave</Label>
                <Input
                  placeholder="Ex: Uber, Salário, Netflix…"
                  value={form.keyword}
                  onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de correspondência</Label>
                <Select value={form.match_type} onValueChange={(v) => setForm({ ...form, match_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(MATCH_TYPE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de transação</Label>
                <Select value={form.transaction_type} onValueChange={(v) => setForm({ ...form, transaction_type: v, category: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ambos">Ambos</SelectItem>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {filteredCategories(form.transaction_type).map((c) => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving || !form.keyword.trim() || !form.category} className="gap-1.5">
                <Plus className="w-4 h-4" />
                {saving ? "Salvando…" : "Criar regra"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rules list */}
      <Card>
        <CardHeader className="pb-3 space-y-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Regras cadastradas
            </CardTitle>
            <Badge variant="secondary" className="ml-auto">{filteredRules.length} / {rules.length}</Badge>
          </div>
          {rules.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por palavra-chave ou categoria…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground px-6 py-8 text-center">Carregando…</p>
          ) : rules.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 py-8 text-center">Nenhuma regra cadastrada ainda.</p>
          ) : filteredRules.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 py-8 text-center">Nenhuma regra encontrada.</p>
          ) : (
            <div className="divide-y divide-border">
              {filteredRules.map((rule) => (
                <div key={rule.id} className={`flex items-center gap-3 px-4 py-3 ${!rule.is_active ? "opacity-50" : ""}`}>
                  {/* Toggle */}
                  {canEdit && (
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={() => handleToggle(rule)}
                      className="shrink-0"
                    />
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold bg-muted px-1.5 py-0.5 rounded">
                        {rule.keyword}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {MATCH_TYPE_LABELS[rule.match_type] || rule.match_type}
                      </span>
                      <span className="text-xs text-muted-foreground">→</span>
                      <span className="text-sm font-medium">{rule.category}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs py-0">
                        {TX_TYPE_LABELS[rule.transaction_type] || rule.transaction_type}
                      </Badge>
                      {!rule.is_active && (
                        <span className="text-xs text-muted-foreground italic">Desativada</span>
                      )}
                    </div>
                  </div>

                  {/* Delete */}
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(rule.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}