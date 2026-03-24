import React, { useRef, useState, useMemo } from "react";
import { parseOFX, parseCSV, applyCategorizationRules } from "@/lib/ofxParser";
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

  const reset = () => {
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
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const enrichWithCategories = (rawTxns, activeRules) => {
    return rawTxns.map((t) => {
      const ruleMatch = applyCategorizationRules(t, activeRules);
      const csvCategory = t.category;

      if (ruleMatch?.category || csvCategory) {
        return {
          ...t,
          category: ruleMatch?.category || csvCategory,
          reviewStatus: "suggested",
          autoSource: ruleMatch?.category ? "regra" : "csv",
        };
      } else {
        return {
          ...t,
          category: "",
          reviewStatus: "pending",
          autoSource: null,
        };
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
      else rawTxns = parseOFX(e.target.result);

      if (rawTxns.length === 0) {
        setError("Nenhuma transação encontrada no arquivo.");
        setLoading(false);
        return;
      }
      const enriched = enrichWithCategories(rawTxns, rules);
      setTransactions(enriched);
      setFileName(file.name);
      setLoading(false);
      setStep("review");
    };
    reader.onerror = () => { setError("Erro ao ler o arquivo."); setLoading(false); };
    reader.readAsText(file, "latin1");
  };

  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [bulkCategory, setBulkCategory] = useState({ entrada: "", saida: "" });

  const updateCategory = (descKey, cat) => {
    setTransactions((prev) =>
      prev.map((t) =>
        (t.description || "Sem descrição").trim().toLowerCase() === descKey
          ? { ...t, category: cat, reviewStatus: cat ? "approved" : "pending" }
          : t
      )
    );
  };

  const toggleItemIncluded = (id) => {
    setTransactions((prev) =>
      prev.map((t) =>
        t._importId === id
          ? { ...t, excluded: !t.excluded }
          : t
      )
    );
  };

  const toggleGroupIncluded = (descKey) => {
    const groupItems = transactions.filter(
      (t) => (t.description || "Sem descrição").trim().toLowerCase() === descKey
    );
    const allExcluded = groupItems.every((t) => t.excluded);
    setTransactions((prev) =>
      prev.map((t) =>
        (t.description || "Sem descrição").trim().toLowerCase() === descKey
          ? { ...t, excluded: !allExcluded }
          : t
      )
    );
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

  // Assign stable import IDs once
  const txWithIds = useMemo(() => {
    return transactions.map((t, i) => t._importId !== undefined ? t : { ...t, _importId: i });
  }, []); // intentionally static — we manage via setTransactions below

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

    const toCreate = transactions.filter((t) => t.reviewStatus === "approved");
    const pending = transactions.filter((t) => t.reviewStatus !== "approved");

    if (toCreate.length === 0) {
      toast.error("Nenhum lançamento aprovado para importar. Revise as categorias.");
      return;
    }

    setSaving(true);
    await base44.entities.Transaction.bulkCreate(
      toCreate.map((t) => ({
        date: t.date,
        type: t.type,
        amount: t.amount,
        description: t.description || "",
        category: t.category,
        payment_method: "outro",
        cost_center: importUnit,
        bank_account: importBank,
      }))
    );
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    setSavedCount(toCreate.length);
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
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground font-medium">{fileName} · {transactions.length} transações</span>
              <div className="flex items-center gap-2 ml-auto flex-wrap">
                {stats.approved > 0 && (
                  <span className="flex items-center gap-1 bg-success/10 text-success px-2.5 py-1 rounded-full font-medium">
                    <Check className="w-3 h-3" /> {stats.approved} aprovados
                  </span>
                )}
                {stats.suggested > 0 && (
                  <span className="flex items-center gap-1 bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
                    <Sparkles className="w-3 h-3" /> {stats.suggested} aguardando aprovação
                  </span>
                )}
                {stats.pending > 0 && (
                  <span className="flex items-center gap-1 bg-amber-500/10 text-amber-600 px-2.5 py-1 rounded-full font-medium">
                    <Clock className="w-3 h-3" /> {stats.pending} sem categoria
                  </span>
                )}
              </div>
            </div>

            {stats.suggested > 0 && (
              <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                <span className="text-xs text-primary font-medium flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {stats.suggested} lançamento(s) com categoria sugerida — revise e aprove
                </span>
                <Button size="sm" variant="outline" className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10" onClick={approveAllSuggested}>
                  Aprovar todos
                </Button>
              </div>
            )}

            <div className="overflow-y-auto flex-1 border border-border rounded-xl divide-y divide-border min-h-0">
              {transactions.map((t, i) => {
                const isPending = t.reviewStatus === "pending";
                const isSuggested = t.reviewStatus === "suggested";
                const isApproved = t.reviewStatus === "approved";

                return (
                  <div
                    key={t.id || i}
                    className={`flex items-center gap-2.5 px-3 py-2.5 transition-colors ${
                      isPending ? "bg-amber-50/50 dark:bg-amber-900/10" : ""
                    }`}
                  >
                    <div className="shrink-0 w-6 flex justify-center">
                      {isApproved && <Check className="w-4 h-4 text-success" />}
                      {isSuggested && <Sparkles className="w-4 h-4 text-primary" />}
                      {isPending && <Clock className="w-4 h-4 text-amber-500" />}
                    </div>

                    <span className="text-xs text-muted-foreground w-16 shrink-0">
                      {t.date ? format(new Date(t.date.substring(0, 10)), "dd/MM/yy", { locale: ptBR }) : t.date}
                    </span>

                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0 ${
                      t.type === "entrada" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                    }`}>
                      {t.type === "entrada" ? "E" : "S"}
                    </span>

                    <span className="text-sm flex-1 truncate min-w-0">{t.description || "Sem descrição"}</span>

                    <div className="shrink-0 w-44" onClick={(e) => e.stopPropagation()}>
                      <Select value={t.category || ""} onValueChange={(v) => updateCategory(i, v)}>
                        <SelectTrigger className={`h-7 text-xs ${
                          isPending ? "border-amber-400/70 bg-amber-50/50" :
                          isSuggested ? "border-primary/50 bg-primary/5" :
                          "border-success/50 bg-success/5"
                        }`}>
                          <SelectValue placeholder="Selecionar categoria..." />
                        </SelectTrigger>
                        <SelectContent>
                          {(categoryOptionsByType[t.type] || []).map((cat) => (
                            <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {isSuggested ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs border-success/50 text-success hover:bg-success/10 shrink-0"
                        onClick={() => approveItem(i)}
                      >
                        <Check className="w-3 h-3 mr-1" />
                        Ok
                      </Button>
                    ) : (
                      <div className="w-16 shrink-0" />
                    )}

                    <span className={`text-sm font-semibold shrink-0 w-24 text-right ${
                      t.type === "entrada" ? "text-success" : "text-destructive"
                    }`}>
                      {t.type === "entrada" ? "+" : "-"}{formatCurrency(t.amount)}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground">
              {stats.approved} aprovado(s) serão importados.
              {stats.pending > 0 && (
                <span className="text-amber-600 font-medium"> · {stats.pending} sem categoria ficarão de fora — classifique-os depois.</span>
              )}
              {stats.suggested > 0 && (
                <span className="text-primary font-medium"> · {stats.suggested} aguardando aprovação.</span>
              )}
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
              <p className="font-semibold text-success text-lg">{savedCount} lançamento(s) importados!</p>
              <p className="text-sm text-muted-foreground">Os lançamentos já aparecem na lista de Lançamentos.</p>
            </div>
            {pendingCount > 0 && (
              <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 max-w-sm">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                    {pendingCount} lançamento(s) sem categoria
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                    Lembre-se de classificá-los dentro do mês atual usando a função <strong>Classificar</strong> na página de Lançamentos.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="pt-2">
          {step === "upload" && <Button variant="outline" onClick={handleClose}>Cancelar</Button>}
          {step === "review" && (
            <>
              <Button variant="outline" onClick={reset}>Voltar</Button>
              <Button onClick={handleImport} disabled={saving || stats.approved === 0}>
                {saving ? "Importando…" : `Importar ${stats.approved} aprovados${stats.pending > 0 ? ` (${stats.pending} pendentes)` : ""}`}
              </Button>
            </>
          )}
          {step === "done" && <Button onClick={handleClose}>Fechar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}