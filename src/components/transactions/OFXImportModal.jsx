import React, { useRef, useState, useMemo, useEffect } from "react";
import { parseOFX, parseCSV, parseBradesco, applyCategorizationRules } from "@/lib/ofxParser";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, AlertCircle, FileText, Sparkles, Check, Clock, AlertTriangle, ChevronDown, ChevronRight, CheckSquare, Square, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const DRAFT_KEY = "ofx_import_draft";

export default function OFXImportModal({ open, onOpenChange }) {
  const inputRef = useRef();
  const queryClient = useQueryClient();
  const [step, setStep] = useState("upload");
  const [transactions, setTransactions] = useState([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [importUnit, setImportUnit] = useState("");
  const [importBank, setImportBank] = useState("");
  const [hasDraft, setHasDraft] = useState(false);

  // Verifica se há rascunho salvo ao abrir
  useEffect(() => {
    if (open) {
      const draft = localStorage.getItem(DRAFT_KEY);
      setHasDraft(!!draft);
    }
  }, [open]);

  const { data: costCenters = [] } = useQuery({
    queryKey: ["costCenters"],
    queryFn: () => base44.entities.CostCenter.list("name"),
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bankAccounts"],
    queryFn: () => base44.entities.BankAccount.list("name"),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => base44.entities.Category.list(),
  });

  const { data: rules = [] } = useQuery({
    queryKey: ["categorizationRules"],
    queryFn: () => base44.entities.CategorizationRule.list(),
  });

  const saveDraft = (txns, unit, bank, name) => {
    const draft = { transactions: txns, importUnit: unit, importBank: bank, fileName: name, savedAt: new Date().toISOString() };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    setHasDraft(true);
  };

  const loadDraft = () => {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);
    const savedAt = draft.savedAt ? new Date(draft.savedAt).toLocaleDateString("pt-BR") : "";
    setTransactions(draft.transactions || []);
    setImportUnit(draft.importUnit || "");
    setImportBank(draft.importBank || "");
    setFileName(draft.fileName || (savedAt ? `Rascunho de ${savedAt}` : "Rascunho"));
    setStep("review");
    setHasDraft(true);
    toast.success("Rascunho carregado!");
  };

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setHasDraft(false);
  };

  const reset = () => {
    clearDraft();
    setStep("upload");
    setTransactions([]);
    setFileName("");
    setError("");
    setLoading(false);
    setSaving(false);
    setSavedCount(0);
    setPendingCount(0);
    setImportUnit("");
    setImportBank("");
    setHasDraft(false);
  };

  const handleClose = () => {
    if (step === "review") {
      // Salva rascunho sem limpar localStorage
      saveDraft(transactions, importUnit, importBank, fileName);
      toast.success("Progresso salvo! Você pode continuar depois.");
      // Reseta estado local sem limpar o draft
      setStep("upload");
      setTransactions([]);
      setFileName("");
      setError("");
      setSaving(false);
      setSavedCount(0);
      setPendingCount(0);
      setImportUnit("");
      setImportBank("");
    } else {
      reset();
    }
    onOpenChange(false);
  };

  const enrichWithCategories = (rawTxns, activeRules) => {
    return rawTxns.map((t, i) => {
      const ruleMatch = applyCategorizationRules(t, activeRules);
      const csvCategory = t.category;
      const base = { ...t, _importId: i, excluded: false };

      if (ruleMatch?.category || csvCategory) {
        return { ...base, category: ruleMatch?.category || csvCategory, reviewStatus: "suggested", autoSource: ruleMatch?.category ? "regra" : "csv" };
      } else {
        return { ...base, category: "", reviewStatus: "pending", autoSource: null };
      }
    });
  };

  const processFile = (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["ofx", "csv", "txt"].includes(ext)) {
      setError("Use arquivos .ofx, .csv ou .txt");
      return;
    }
    setLoading(true);
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      let rawTxns = [];
      if (ext === "csv") rawTxns = parseCSV(e.target.result);
      else if (ext === "txt") rawTxns = parseBradesco(e.target.result);
      else rawTxns = parseOFX(e.target.result);

      if (rawTxns.length === 0) {
        setError("Nenhuma transação encontrada no arquivo.");
        setLoading(false);
        return;
      }
      const enriched = enrichWithCategories(rawTxns, rules);
      setTransactions(enriched);
      setFileName(file.name);
      saveDraft(enriched, importUnit, importBank, file.name);
      setLoading(false);
      setStep("review");
    };
    reader.onerror = () => { setError("Erro ao ler o arquivo."); setLoading(false); };
    reader.readAsText(file, "latin1");
  };

  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [bulkCategory, setBulkCategory] = useState({ entrada: "", saida: "" });

  const updateCategory = (descKey, cat) => {
    setTransactions((prev) => {
      const updated = prev.map((t) =>
        (t.description || "Sem descrição").trim().toLowerCase() === descKey
          ? { ...t, category: cat, reviewStatus: cat ? "approved" : "pending" }
          : t
      );
      saveDraft(updated, importUnit, importBank, fileName);
      return updated;
    });
  };

  const toggleItemIncluded = (id) => {
    setTransactions((prev) => {
      const updated = prev.map((t) =>
        t._importId === id ? { ...t, excluded: !t.excluded } : t
      );
      saveDraft(updated, importUnit, importBank, fileName);
      return updated;
    });
  };

  const updateItemCategory = (id, cat) => {
    setTransactions((prev) => {
      const updated = prev.map((t) =>
        t._importId === id
          ? { ...t, category: cat, reviewStatus: cat ? "approved" : "pending" }
          : t
      );
      saveDraft(updated, importUnit, importBank, fileName);
      return updated;
    });
  };

  const toggleGroupIncluded = (descKey) => {
    const groupItems = transactions.filter(
      (t) => (t.description || "Sem descrição").trim().toLowerCase() === descKey
    );
    const allExcluded = groupItems.every((t) => t.excluded);
    setTransactions((prev) => {
      const updated = prev.map((t) =>
        (t.description || "Sem descrição").trim().toLowerCase() === descKey
          ? { ...t, excluded: !allExcluded }
          : t
      );
      saveDraft(updated, importUnit, importBank, fileName);
      return updated;
    });
  };

  const toggleExpand = (key) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const applyBulkCategory = (type) => {
    const cat = bulkCategory[type];
    if (!cat) { toast.error("Selecione uma categoria primeiro."); return; }
    setTransactions((prev) =>
      prev.map((t) =>
        t.type === type && !t.excluded
          ? { ...t, category: cat, reviewStatus: "approved" }
          : t
      )
    );
    toast.success(`Categoria "${cat}" aplicada a todos os ${type === "entrada" ? "entradas" : "saídas"} incluídos.`);
  };

  const groups = useMemo(() => {
    const map = new Map();
    for (const t of transactions) {
      const key = (t.description || "Sem descrição").trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, { key, label: (t.description || "Sem descrição").trim(), type: t.type, items: [], totalAmount: 0 });
      }
      const g = map.get(key);
      g.items.push(t);
      g.totalAmount += t.amount || 0;
    }
    return Array.from(map.values()).sort((a, b) => b.items.length - a.items.length);
  }, [transactions]);

  const stats = useMemo(() => {
    const active = transactions.filter((t) => !t.excluded);
    return {
      approved: active.filter((t) => t.reviewStatus === "approved").length,
      suggested: active.filter((t) => t.reviewStatus === "suggested").length,
      pending: active.filter((t) => t.reviewStatus === "pending").length,
      excluded: transactions.filter((t) => t.excluded).length,
    };
  }, [transactions]);

  const categoryOptionsByType = useMemo(() => {
    const entrada = [...new Set(categories.filter((c) => c.type === "entrada").map((c) => c.name))].sort();
    const saida = [...new Set(categories.filter((c) => c.type === "saida").map((c) => c.name))].sort();
    return { entrada, saida };
  }, [categories]);

  const handleImport = async () => {
    if (!importUnit) { toast.error("Selecione a Unidade antes de importar."); return; }
    if (!importBank) { toast.error("Selecione o Banco/Conta antes de importar."); return; }

    const active = transactions.filter((t) => !t.excluded);
    const approved = active.filter((t) => t.reviewStatus === "approved");
    const pending = active.filter((t) => t.reviewStatus !== "approved");
    const toCreate = active; // Importa TODOS (aprovados + pendentes)

    if (toCreate.length === 0) {
      toast.error("Nenhum lançamento para importar.");
      return;
    }

    setSaving(true);
    await base44.entities.Transaction.bulkCreate(
      toCreate.map((t) => ({
        date: t.date,
        type: t.type,
        amount: t.amount,
        description: t.description || "",
        category: t.category || "",
        payment_method: "outro",
        cost_center: importUnit,
        bank_account: importBank,
      }))
    );
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    clearDraft();
    setSavedCount(approved.length);
    setPendingCount(pending.length);
    setSaving(false);
    setStep("done");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar OFX / CSV</DialogTitle>
          <DialogDescription>
            Todos os lançamentos precisam ser revisados e aprovados antes de entrar no sistema.
          </DialogDescription>
        </DialogHeader>

        {/* UPLOAD */}
        {step === "upload" && (
          <div className="flex-1 flex flex-col gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Unidade *</Label>
                <Select value={importUnit} onValueChange={setImportUnit}>
                  <SelectTrigger className={!importUnit ? "border-destructive/50" : ""}>
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {costCenters.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Banco / Conta *</Label>
                <Select value={importBank} onValueChange={setImportBank}>
                  <SelectTrigger className={!importBank ? "border-destructive/50" : ""}>
                    <SelectValue placeholder="Selecione o banco" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((b) => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div
              className={`w-full border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-4 transition-all ${
                !importUnit || !importBank
                  ? "border-border opacity-50 cursor-not-allowed"
                  : "border-border cursor-pointer hover:border-primary/60 hover:bg-muted/20"
              }`}
              onClick={() => !loading && importUnit && importBank && inputRef.current?.click()}
            >
              {loading ? (
                <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              ) : (
                <>
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileText className="w-7 h-7 text-primary" />
                  </div>
                  <div className="text-center">
                    {!importUnit || !importBank ? (
                      <p className="font-semibold text-muted-foreground">Selecione a unidade e o banco acima</p>
                    ) : (
                      <p className="font-semibold">Clique para selecionar o arquivo</p>
                    )}
                    <p className="text-sm text-muted-foreground mt-1">Formatos aceitos: .ofx, .csv, .txt</p>
                  </div>
                </>
              )}
            </div>
            <input ref={inputRef} type="file" accept=".ofx,.csv,.txt" className="hidden"
              disabled={!importUnit || !importBank}
              onChange={(e) => processFile(e.target.files[0])} />

            <div className="border border-border rounded-xl p-4 bg-muted/20 text-xs space-y-2">
              <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Exemplo de CSV aceito</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      {["Data", "Valor", "Descrição", "Categoria (opcional)"].map((h) => (
                        <th key={h} className="px-2 py-1 font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[
                      ["01/01/2026", "-150,00", "Mercado XYZ", "Alimentação"],
                      ["05/01/2026", "3.500,00", "Pagamento cliente", "Receita Serviços"],
                      ["10/01/2026", "-89,90", "Internet", ""],
                    ].map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j} className="px-2 py-1 font-mono">{cell || <span className="text-muted-foreground italic">vazio</span>}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {hasDraft && (
              <div className="flex items-center justify-between gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 text-sm">
                  <Sparkles className="w-4 h-4 text-primary shrink-0" />
                  <span>Há uma importação em andamento salva. Deseja continuar de onde parou?</span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={clearDraft}>Descartar</Button>
                  <Button size="sm" onClick={loadDraft}>Continuar</Button>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}
          </div>
        )}

        {/* REVIEW */}
        {step === "review" && (
          <div className="flex-1 flex flex-col overflow-hidden gap-3">
            {/* Stats bar */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground font-medium">{fileName} · {transactions.length} transações · {groups.length} grupos</span>
              <div className="flex items-center gap-2 ml-auto flex-wrap">
                {stats.approved > 0 && <span className="flex items-center gap-1 bg-success/10 text-success px-2.5 py-1 rounded-full font-medium"><Check className="w-3 h-3" /> {stats.approved} aprovados</span>}
                {stats.pending > 0 && <span className="flex items-center gap-1 bg-amber-500/10 text-amber-600 px-2.5 py-1 rounded-full font-medium"><Clock className="w-3 h-3" /> {stats.pending} sem categoria</span>}
                {stats.excluded > 0 && <span className="flex items-center gap-1 bg-muted text-muted-foreground px-2.5 py-1 rounded-full font-medium">{stats.excluded} excluídos</span>}
              </div>
            </div>

            {/* Bulk category bars */}
            <div className="grid grid-cols-2 gap-2">
              {["entrada", "saida"].map((tipo) => (
                <div key={tipo} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${tipo === "entrada" ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"}`}>
                  <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${tipo === "entrada" ? "bg-success/15" : "bg-destructive/15"}`}>
                    {tipo === "entrada" ? <ArrowUpRight className="w-3 h-3 text-success" /> : <ArrowDownRight className="w-3 h-3 text-destructive" />}
                  </div>
                  <Select value={bulkCategory[tipo]} onValueChange={(v) => setBulkCategory((p) => ({ ...p, [tipo]: v }))}>
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <SelectValue placeholder={`Categoria p/ todas as ${tipo === "entrada" ? "entradas" : "saídas"}...`} />
                    </SelectTrigger>
                    <SelectContent>
                      {(categoryOptionsByType[tipo] || []).map((cat) => (
                        <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => applyBulkCategory(tipo)}>
                    Aplicar
                  </Button>
                </div>
              ))}
            </div>

            {/* Groups list */}
            <div className="overflow-y-auto flex-1 border border-border rounded-xl divide-y divide-border min-h-0">
              {groups.map((g) => {
                const expanded = expandedGroups.has(g.key);
                const allExcluded = g.items.every((t) => t.excluded);
                const someExcluded = g.items.some((t) => t.excluded);
                const groupCategory = g.items.find((t) => !t.excluded)?.category || g.items[0]?.category || "";
                const groupStatus = allExcluded ? "excluded" : g.items.filter((t) => !t.excluded).every((t) => t.reviewStatus === "approved") ? "approved" : g.items.filter((t) => !t.excluded).some((t) => t.reviewStatus === "approved") ? "partial" : "pending";

                return (
                  <div key={g.key}>
                    {/* Group header */}
                    <div className={`flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-muted/30 ${allExcluded ? "opacity-40" : ""}`}>
                      {/* Include/exclude toggle */}
                      <button onClick={() => toggleGroupIncluded(g.key)} className="shrink-0" title={allExcluded ? "Incluir grupo" : "Excluir grupo"}>
                        {allExcluded ? <Square className="w-4 h-4 text-muted-foreground" /> : someExcluded ? <div className="w-4 h-4 border-2 border-primary rounded-sm bg-primary/30" /> : <CheckSquare className="w-4 h-4 text-primary" />}
                      </button>

                      {/* Type icon */}
                      <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${g.type === "entrada" ? "bg-success/10" : "bg-destructive/10"}`}>
                        {g.type === "entrada" ? <ArrowUpRight className="w-3.5 h-3.5 text-success" /> : <ArrowDownRight className="w-3.5 h-3.5 text-destructive" />}
                      </div>

                      {/* Description + status */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{g.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {g.items.length} lançamento(s) ·{" "}
                          {groupStatus === "approved" && <span className="text-success">✓ classificados</span>}
                          {groupStatus === "pending" && <span className="text-amber-500">sem categoria</span>}
                          {groupStatus === "partial" && <span className="text-primary">parcialmente classificados</span>}
                        </p>
                      </div>

                      {/* Category select (applies to all in group) */}
                      {!allExcluded && (
                        <div className="shrink-0 w-44" onClick={(e) => e.stopPropagation()}>
                          <Select value={groupCategory} onValueChange={(v) => updateCategory(g.key, v)}>
                            <SelectTrigger className={`h-7 text-xs ${groupStatus === "approved" ? "border-success/50 bg-success/5" : "border-amber-400/70 bg-amber-50/50 dark:bg-amber-900/10"}`}>
                              <SelectValue placeholder="Selecionar categoria..." />
                            </SelectTrigger>
                            <SelectContent>
                              {(categoryOptionsByType[g.type] || []).map((cat) => (
                                <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Total + expand */}
                      <span className={`text-sm font-semibold shrink-0 w-20 text-right ${g.type === "entrada" ? "text-success" : "text-destructive"}`}>
                        {g.type === "entrada" ? "+" : "-"}{formatCurrency(g.totalAmount)}
                      </span>
                      <button onClick={() => toggleExpand(g.key)} className="shrink-0 text-muted-foreground hover:text-foreground">
                        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Expanded sub-items */}
                    {expanded && (
                      <div className="bg-muted/20 border-t border-border/50 divide-y divide-border/30">
                        {g.items.map((t) => (
                          <div
                            key={t._importId}
                            className={`flex items-center gap-2 pl-8 pr-3 py-2 transition-colors ${t.excluded ? "opacity-40" : "hover:bg-muted/30"}`}
                          >
                            {/* Checkbox incluir/excluir */}
                            <button
                              onClick={() => toggleItemIncluded(t._importId)}
                              className="shrink-0"
                              title={t.excluded ? "Incluir" : "Excluir"}
                            >
                              {t.excluded
                                ? <Square className="w-3.5 h-3.5 text-muted-foreground" />
                                : <CheckSquare className="w-3.5 h-3.5 text-primary" />}
                            </button>

                            {/* Data */}
                            <span className="text-xs text-muted-foreground w-14 shrink-0">
                              {t.date ? format(new Date(t.date.substring(0, 10)), "dd/MM/yy", { locale: ptBR }) : "—"}
                            </span>

                            {/* Categoria individual — independente do grupo */}
                            <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                              <Select
                                value={t.category || ""}
                                onValueChange={(v) => updateItemCategory(t._importId, v)}
                                disabled={t.excluded}
                              >
                                <SelectTrigger className={`h-6 text-xs w-full ${
                                  t.excluded ? "" :
                                  t.reviewStatus === "approved" ? "border-success/50 bg-success/5" : "border-amber-400/60 bg-amber-50/40 dark:bg-amber-900/10"
                                }`}>
                                  <SelectValue placeholder="Categoria individual..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {(categoryOptionsByType[t.type] || []).map((cat) => (
                                    <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Valor */}
                            <span className={`text-xs font-semibold shrink-0 w-20 text-right ${t.type === "entrada" ? "text-success" : "text-destructive"}`}>
                              {t.type === "entrada" ? "+" : "-"}{formatCurrency(t.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground">
              {stats.approved} classificado(s) · {stats.pending} sem categoria (serão importados para classificar depois).
              {stats.excluded > 0 && <span className="text-muted-foreground"> · {stats.excluded} excluídos.</span>}
              {" "}<span className="text-primary font-medium">Progresso é salvo automaticamente.</span>
            </p>
          </div>
        )}

        {/* DONE */}
        {step === "done" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 py-8">
            <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-success" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-semibold text-success text-lg">{savedCount + pendingCount} lançamento(s) importados!</p>
              <p className="text-sm text-muted-foreground">
                {savedCount > 0 && `${savedCount} classificado(s)`}
                {savedCount > 0 && pendingCount > 0 && " · "}
                {pendingCount > 0 && `${pendingCount} sem categoria (classifique na página de Lançamentos)`}
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="pt-2">
          {step === "upload" && <Button variant="outline" onClick={handleClose}>Cancelar</Button>}
          {step === "review" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Salvar e Sair
              </Button>
              <Button variant="outline" onClick={reset}>Cancelar</Button>
              <Button onClick={handleImport} disabled={saving || (stats.approved + stats.pending) === 0}>
                {saving
                  ? "Importando…"
                  : `Importar ${stats.approved + stats.pending} lançamento(s)${stats.pending > 0 ? ` (${stats.pending} sem categoria)` : ""}`}
              </Button>
            </>
          )}
          {step === "done" && <Button onClick={handleClose}>Fechar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}