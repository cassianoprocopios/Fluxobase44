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
import { Upload, CheckCircle2, AlertCircle, FileText, Sparkles, ChevronDown } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

export default function OFXImportModal({ open, onOpenChange }) {
  const inputRef = useRef();
  const queryClient = useQueryClient();
  const [step, setStep] = useState("upload");
  const [transactions, setTransactions] = useState([]); // enriched with suggestedCategory, editedCategory
  const [selected, setSelected] = useState([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
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
    setSelected([]);
    setFileName("");
    setError("");
    setLoading(false);
    setSaving(false);
    setSavedCount(0);
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
      // Prioridade: regra de categorização > categoria vinda do CSV > fallback
      const suggested = ruleMatch?.category || t.category || (t.type === "entrada" ? "Outras Receitas" : "Outras Despesas");
      return {
        ...t,
        suggestedCategory: suggested,
        editedCategory: suggested,
        autoMatched: !!ruleMatch?.category || !!t.category,
      };
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
      setSelected(enriched.map((_, i) => i));
      setFileName(file.name);
      setLoading(false);
      setStep("preview");
    };
    reader.onerror = () => { setError("Erro ao ler o arquivo."); setLoading(false); };
    reader.readAsText(file, "latin1");
  };

  const toggleAll = () => {
    setSelected(selected.length === transactions.length ? [] : transactions.map((_, i) => i));
  };

  const toggleOne = (i) => {
    setSelected((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]);
  };

  const updateCategory = (i, cat) => {
    setTransactions((prev) => prev.map((t, idx) => idx === i ? { ...t, editedCategory: cat } : t));
  };

  const handleImport = async () => {
    if (!importUnit) { toast.error("Selecione a Unidade antes de importar."); return; }
    if (!importBank) { toast.error("Selecione o Banco/Conta antes de importar."); return; }
    setSaving(true);
    const toCreate = transactions
      .filter((_, i) => selected.includes(i))
      .map((t) => ({
        date: t.date,
        type: t.type,
        amount: t.amount,
        description: t.description || "",
        category: t.editedCategory || (t.type === "entrada" ? "Outras Receitas" : "Outras Despesas"),
        payment_method: "outro",
        cost_center: importUnit,
        bank_account: importBank,
      }));
    await base44.entities.Transaction.bulkCreate(toCreate);
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    setSavedCount(toCreate.length);
    setSaving(false);
    setStep("done");
    toast.success(`${toCreate.length} lançamentos importados!`);
  };

  const autoMatchedCount = useMemo(() => transactions.filter((t) => t.autoMatched).length, [transactions]);

  const categoryOptions = useMemo(() => {
    const cats = categories.map((c) => c.name);
    return [...new Set(cats)].sort();
  }, [categories]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar OFX / CSV</DialogTitle>
          <DialogDescription>
            Importe transações do extrato bancário. As categorias são sugeridas automaticamente pelas suas regras.
          </DialogDescription>
        </DialogHeader>

        {/* UPLOAD STEP */}
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
              className="w-full border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center gap-4 cursor-pointer hover:border-primary/60 hover:bg-muted/20 transition-all"
              onClick={() => !loading && inputRef.current?.click()}
            >
              {loading ? (
                <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              ) : (
                <>
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileText className="w-7 h-7 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold">Clique para selecionar o arquivo</p>
                    <p className="text-sm text-muted-foreground mt-1">Formatos aceitos: .ofx, .csv, .txt</p>
                  </div>
                </>
              )}
            </div>
            <input ref={inputRef} type="file" accept=".ofx,.csv,.txt" className="hidden" onChange={(e) => processFile(e.target.files[0])} />

            {/* Exemplo de formato */}
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
                      <tr key={i} className="hover:bg-muted/30">
                        {row.map((cell, j) => (
                          <td key={j} className="px-2 py-1 text-foreground/80 font-mono">{cell || <span className="text-muted-foreground italic">vazio</span>}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="text-muted-foreground space-y-0.5 mt-1">
                <li>• Separador: <span className="font-mono font-semibold">,</span> ou <span className="font-mono font-semibold">;</span></li>
                <li>• Data: <span className="font-mono">DD/MM/AAAA</span> ou <span className="font-mono">AAAA-MM-DD</span></li>
                <li>• Valor negativo = Saída · Valor positivo = Entrada</li>
                <li>• Coluna <span className="font-mono">Categoria</span> é usada automaticamente se presente</li>
              </ul>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}
          </div>
        )}

        {/* PREVIEW STEP */}
        {step === "preview" && (
          <div className="flex-1 flex flex-col overflow-hidden gap-3">
            {/* Header summary */}
            <div className="flex items-center justify-between text-sm flex-wrap gap-2">
              <span className="text-muted-foreground">{fileName} · {transactions.length} transações</span>
              <div className="flex items-center gap-3">
                {autoMatchedCount > 0 && (
                  <span className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
                    <Sparkles className="w-3 h-3" />
                    {autoMatchedCount} categorizadas automaticamente
                  </span>
                )}
                <button onClick={toggleAll} className="text-primary hover:underline text-xs font-medium">
                  {selected.length === transactions.length ? "Desmarcar todos" : "Selecionar todos"}
                </button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1 border border-border rounded-xl divide-y divide-border">
              {transactions.map((t, i) => (
                <div
                  key={t.id}
                  className={`flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/30 ${selected.includes(i) ? "" : "opacity-50"}`}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    readOnly
                    checked={selected.includes(i)}
                    onClick={() => toggleOne(i)}
                    className="w-4 h-4 shrink-0 accent-primary cursor-pointer"
                  />

                  {/* Date */}
                  <span className="text-xs text-muted-foreground w-20 shrink-0">{t.date}</span>

                  {/* Type badge */}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                    t.type === "entrada" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                  }`}>
                    {t.type === "entrada" ? "Entrada" : "Saída"}
                  </span>

                  {/* Description */}
                  <span className="text-sm flex-1 truncate min-w-0">{t.description || "Sem descrição"}</span>

                  {/* Category selector */}
                  <div className="shrink-0 w-44" onClick={(e) => e.stopPropagation()}>
                    <Select value={t.editedCategory} onValueChange={(v) => updateCategory(i, v)}>
                      <SelectTrigger className={`h-7 text-xs ${t.autoMatched ? "border-primary/50 bg-primary/5" : ""}`}>
                        <div className="flex items-center gap-1 overflow-hidden">
                          {t.autoMatched && <Sparkles className="w-3 h-3 text-primary shrink-0" />}
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((cat) => (
                          <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Amount */}
                  <span className={`text-sm font-semibold shrink-0 w-28 text-right ${
                    t.type === "entrada" ? "text-success" : "text-destructive"
                  }`}>
                    {t.type === "entrada" ? "+" : "-"}{formatCurrency(t.amount)}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              {selected.length} de {transactions.length} selecionados · Edite as categorias antes de importar.
            </p>
          </div>
        )}

        {/* DONE STEP */}
        {step === "done" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8">
            <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-success" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-success">{savedCount} lançamentos importados!</p>
              <p className="text-sm text-muted-foreground mt-1">Os lançamentos já aparecem na lista de Lançamentos.</p>
            </div>
          </div>
        )}

        <DialogFooter className="pt-2">
          {step === "upload" && <Button variant="outline" onClick={handleClose}>Cancelar</Button>}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={reset}>Voltar</Button>
              <Button onClick={handleImport} disabled={selected.length === 0 || saving}>
                {saving ? "Importando…" : `Importar ${selected.length} lançamentos`}
              </Button>
            </>
          )}
          {step === "done" && <Button onClick={handleClose}>Fechar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}