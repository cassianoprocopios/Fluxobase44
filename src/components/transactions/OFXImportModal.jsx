import React, { useRef, useState } from "react";
import { parseOFX } from "@/lib/ofxParser";
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
import { Upload, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function OFXImportModal({ open, onOpenChange }) {
  const inputRef = useRef();
  const queryClient = useQueryClient();
  const [step, setStep] = useState("upload"); // upload | preview | done
  const [transactions, setTransactions] = useState([]);
  const [selected, setSelected] = useState([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const reset = () => {
    setStep("upload");
    setTransactions([]);
    setSelected([]);
    setFileName("");
    setError("");
    setLoading(false);
    setSaving(false);
    setSavedCount(0);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const processFile = (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["ofx", "txt"].includes(ext)) {
      setError("Use arquivos .ofx ou .txt");
      return;
    }
    setLoading(true);
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      const txns = parseOFX(e.target.result);
      if (txns.length === 0) {
        setError("Nenhuma transação encontrada no arquivo.");
        setLoading(false);
        return;
      }
      setTransactions(txns);
      setSelected(txns.map((_, i) => i));
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

  const handleImport = async () => {
    setSaving(true);
    const toCreate = transactions
      .filter((_, i) => selected.includes(i))
      .map((t) => ({
        date: t.date,
        type: t.type,
        amount: t.amount,
        description: t.description || "",
        category: t.type === "entrada" ? "Outras Receitas" : "Outras Despesas",
        payment_method: "outro",
      }));
    await base44.entities.Transaction.bulkCreate(toCreate);
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    setSavedCount(toCreate.length);
    setSaving(false);
    setStep("done");
    toast.success(`${toCreate.length} lançamentos importados!`);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar OFX</DialogTitle>
          <DialogDescription>
            Importe transações de um arquivo de extrato bancário .OFX diretamente como lançamentos.
          </DialogDescription>
        </DialogHeader>

        {/* UPLOAD STEP */}
        {step === "upload" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8">
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
                    <p className="font-semibold">Clique para selecionar o arquivo OFX</p>
                    <p className="text-sm text-muted-foreground mt-1">Formatos aceitos: .ofx, .txt</p>
                  </div>
                </>
              )}
            </div>
            <input ref={inputRef} type="file" accept=".ofx,.txt" className="hidden" onChange={(e) => processFile(e.target.files[0])} />
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 w-full">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}
          </div>
        )}

        {/* PREVIEW STEP */}
        {step === "preview" && (
          <div className="flex-1 flex flex-col overflow-hidden gap-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{fileName} · {transactions.length} transações</span>
              <button onClick={toggleAll} className="text-primary hover:underline text-xs font-medium">
                {selected.length === transactions.length ? "Desmarcar todos" : "Selecionar todos"}
              </button>
            </div>
            <div className="overflow-y-auto flex-1 border border-border rounded-xl divide-y divide-border">
              {transactions.map((t, i) => (
                <div
                  key={t.id}
                  onClick={() => toggleOne(i)}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors ${selected.includes(i) ? "" : "opacity-50"}`}
                >
                  <input type="checkbox" readOnly checked={selected.includes(i)} className="w-4 h-4 shrink-0 accent-primary" />
                  <span className="text-xs text-muted-foreground w-20 shrink-0">{t.date}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${t.type === "entrada" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                    {t.type === "entrada" ? "Entrada" : "Saída"}
                  </span>
                  <span className="text-sm flex-1 truncate">{t.description || "Sem descrição"}</span>
                  <span className={`text-sm font-semibold shrink-0 ${t.type === "entrada" ? "text-success" : "text-destructive"}`}>
                    {t.type === "entrada" ? "+" : "-"}{formatCurrency(t.amount)}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {selected.length} de {transactions.length} selecionados · As categorias poderão ser editadas depois em Lançamentos.
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
              <p className="text-sm text-muted-foreground mt-1">Os lançamentos já aparecem na lista abaixo.</p>
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