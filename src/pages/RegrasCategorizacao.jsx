import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, Tag, Zap, Search, Check, ChevronDown, ChevronUp, GripVertical } from "lucide-react";
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
  amount_exact: "",
  amount_min: "",
  amount_max: "",
  cost_center: "",
  bank_account: "",
  priority: 0,
  is_active: true,
};

function RuleRow({ rule, canEdit, onToggle, onDelete }) {
  const hasKeyword = rule.keyword && rule.keyword.trim();
  const hasValue = rule.amount_exact != null || rule.amount_min != null || rule.amount_max != null;

  const valueCriteria = () => {
    if (rule.amount_exact != null) return `= R$ ${rule.amount_exact.toFixed(2)}`;
    const parts = [];
    if (rule.amount_min != null) parts.push(`≥ R$ ${rule.amount_min.toFixed(2)}`);
    if (rule.amount_max != null) parts.push(`≤ R$ ${rule.amount_max.toFixed(2)}`);
    return parts.join(" e ");
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors ${!rule.is_active ? "opacity-50 bg-muted/20" : ""}`}>
      <div className="shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: rule.is_active ? "hsl(var(--success))" : "hsl(var(--muted-foreground))" }} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {hasKeyword && (
            <code className="text-sm font-semibold bg-muted px-2 py-0.5 rounded text-foreground">
              {rule.keyword}
            </code>
          )}
          {hasKeyword && <span className="text-xs text-muted-foreground">{MATCH_TYPE_LABELS[rule.match_type]}</span>}
          {hasValue && (
            <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">
              Valor {valueCriteria()}
            </span>
          )}
          <span className="text-xs text-muted-foreground">→</span>
          <span className="font-medium text-sm">{rule.category}</span>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Badge variant="outline" className="text-xs">{TX_TYPE_LABELS[rule.transaction_type]}</Badge>
          {rule.cost_center && <span className="text-xs text-muted-foreground">CC: {rule.cost_center}</span>}
          {rule.priority > 0 && <span className="text-xs text-muted-foreground">Prioridade: {rule.priority}</span>}
          {rule.is_active ? (
            <div className="flex items-center gap-1 text-xs text-success"><Check className="w-3 h-3" /> Ativa</div>
          ) : (
            <span className="text-xs text-muted-foreground">Desativada</span>
          )}
        </div>
      </div>

      {canEdit && (
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={onToggle} className="h-7 px-2 text-xs">
            {rule.is_active ? "Desativar" : "Ativar"}
          </Button>
          <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive h-7 w-7" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function RegrasCategorizacao() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["categorizationRules"],
    queryFn: () => base44.entities.CategorizationRule.list(),
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
  const canEdit = me?.role === "admin" || me?.role === "gerente";

  const handleSave = async () => {
    const hasKeyword = form.keyword.trim();
    const hasValue = form.amount_exact !== "" || form.amount_min !== "" || form.amount_max !== "";
    if (!hasKeyword && !hasValue) {
      toast({ title: "Defina ao menos um critério", description: "Informe uma palavra-chave ou critério de valor.", variant: "destructive" });
      return;
    }
    if (!form.category) {
      toast({ title: "Selecione uma categoria", variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload = {
      keyword: form.keyword.trim(),
      match_type: form.match_type,
      transaction_type: form.transaction_type,
      category: form.category,
      is_active: true,
      priority: Number(form.priority) || 0,
    };
    if (form.amount_exact !== "") payload.amount_exact = parseFloat(form.amount_exact);
    if (form.amount_min !== "") payload.amount_min = parseFloat(form.amount_min);
    if (form.amount_max !== "") payload.amount_max = parseFloat(form.amount_max);
    if (form.cost_center) payload.cost_center = form.cost_center;
    if (form.bank_account) payload.bank_account = form.bank_account;

    await base44.entities.CategorizationRule.create(payload);
    queryClient.invalidateQueries({ queryKey: ["categorizationRules"] });
    setForm(EMPTY_FORM);
    setShowAdvanced(false);
    setSaving(false);
    toast({ title: "Regra criada!", description: `→ ${form.category}` });
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
    (r.keyword || "").toLowerCase().includes(search.toLowerCase()) ||
    (r.category || "").toLowerCase().includes(search.toLowerCase()) ||
    (r.cost_center || "").toLowerCase().includes(search.toLowerCase())
  );

  const hasValueCriteria = form.amount_exact !== "" || form.amount_min !== "" || form.amount_max !== "";

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Regras de Negócio</h1>
          <p className="text-sm text-muted-foreground">
            Defina critérios para classificar lançamentos automaticamente ao importar extratos.
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-xl p-4">
        <Zap className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground space-y-1">
          <p>Ao importar um extrato, cada transação é verificada contra as regras ativas. A primeira regra que corresponder (por prioridade) é aplicada automaticamente.</p>
          <p className="text-foreground font-medium">Critérios disponíveis: palavra-chave na descrição · valor exato ou faixa de valor · tipo (entrada/saída)</p>
        </div>
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
            {/* Tipo e Categoria */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <Label className="text-xs">Categoria <span className="text-destructive">*</span></Label>
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

            {/* Critério por palavra-chave */}
            <div className="rounded-lg border border-border p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Critério por Palavra-chave</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Palavra-chave na descrição</Label>
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
              </div>
            </div>

            {/* Critério por valor */}
            <div className="rounded-lg border border-border p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Critério por Valor (opcional)</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Valor exato</Label>
                  <Input
                    type="number"
                    placeholder="0,00"
                    value={form.amount_exact}
                    onChange={(e) => setForm({ ...form, amount_exact: e.target.value, amount_min: "", amount_max: "" })}
                    disabled={form.amount_min !== "" || form.amount_max !== ""}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Valor mínimo</Label>
                  <Input
                    type="number"
                    placeholder="0,00"
                    value={form.amount_min}
                    onChange={(e) => setForm({ ...form, amount_min: e.target.value, amount_exact: "" })}
                    disabled={form.amount_exact !== ""}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Valor máximo</Label>
                  <Input
                    type="number"
                    placeholder="0,00"
                    value={form.amount_max}
                    onChange={(e) => setForm({ ...form, amount_max: e.target.value, amount_exact: "" })}
                    disabled={form.amount_exact !== ""}
                  />
                </div>
              </div>
              {hasValueCriteria && (
                <p className="text-xs text-muted-foreground">
                  Critério ativo: {form.amount_exact !== "" ? `valor = R$ ${form.amount_exact}` : [form.amount_min !== "" && `≥ R$ ${form.amount_min}`, form.amount_max !== "" && `≤ R$ ${form.amount_max}`].filter(Boolean).join(" e ")}
                </p>
              )}
            </div>

            {/* Campos opcionais avançados */}
            <button
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              Campos adicionais (centro de custo, conta, prioridade)
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-muted/30 rounded-lg p-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Centro de custo (opcional)</Label>
                  <Select value={form.cost_center} onValueChange={(v) => setForm({ ...form, cost_center: v })}>
                    <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>Nenhum</SelectItem>
                      {costCenters.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Conta bancária (opcional)</Label>
                  <Select value={form.bank_account} onValueChange={(v) => setForm({ ...form, bank_account: v })}>
                    <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>Nenhuma</SelectItem>
                      {bankAccounts.map((b) => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Prioridade (0 = padrão)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={saving || (!form.keyword.trim() && !hasValueCriteria) || !form.category}
                className="gap-1.5"
              >
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
              {filteredRules
                .sort((a, b) => (b.priority || 0) - (a.priority || 0))
                .map((rule) => (
                  <RuleRow
                    key={rule.id}
                    rule={rule}
                    canEdit={canEdit}
                    onToggle={() => handleToggle(rule)}
                    onDelete={() => handleDelete(rule.id)}
                  />
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}