import React, { useRef, useState } from "react";
import { Upload, FileText, AlertCircle, CheckCircle2, Landmark, FileSpreadsheet } from "lucide-react";
import { parseOFX, parseCSV } from "@/lib/ofxParser";

const BANK_TIPS = [
  { bank: "Nubank", steps: "App → Extrato → Exportar OFX" },
  { bank: "Bradesco", steps: "Internet Banking → Extrato → Exportar OFX" },
  { bank: "Itaú", steps: "Internet Banking → Extrato → Baixar OFX" },
  { bank: "Santander", steps: "Internet Banking → Extrato → Exportar → OFX" },
  { bank: "Banco do Brasil", steps: "Internet Banking → Extrato → Exportar OFX" },
  { bank: "Sicoob/Sicredi", steps: "Internet Banking → Extrato → Salvar como OFX" },
  { bank: "Qualquer banco", steps: "CSV com colunas: Data, Valor, Descrição" },
];

export default function UploadStep({ onParsed }) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState(null); // { count, name }

  const processFile = (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["ofx", "csv", "txt"].includes(ext)) {
      setError("Formato não suportado. Use arquivos .ofx ou .csv");
      return;
    }
    setLoading(true);
    setError("");
    setParsed(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      let txns = [];
      if (ext === "ofx" || ext === "txt") txns = parseOFX(content);
      else txns = parseCSV(content);

      if (txns.length === 0) {
        setError("Nenhuma transação encontrada. Verifique se o arquivo está correto ou tente outro formato.");
        setLoading(false);
        return;
      }

      setParsed({ count: txns.length, name: file.name });
      setLoading(false);

      // Small delay for visual feedback before advancing
      setTimeout(() => onParsed(txns, file.name), 600);
    };
    reader.onerror = () => {
      setError("Erro ao ler o arquivo. Tente novamente.");
      setLoading(false);
    };
    reader.readAsText(file, "latin1");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    processFile(e.dataTransfer.files[0]);
  };

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !loading && !parsed && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-5 transition-all cursor-pointer select-none
          ${loading ? "cursor-wait opacity-70" : ""}
          ${parsed ? "border-success bg-success/5 cursor-default" : ""}
          ${dragging ? "border-primary bg-primary/5 scale-[1.01]" : ""}
          ${!dragging && !parsed && !loading ? "border-border hover:border-primary/60 hover:bg-muted/20" : ""}
        `}
      >
        {parsed ? (
          <>
            <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-success" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-success">{parsed.count} transações lidas com sucesso!</p>
              <p className="text-sm text-muted-foreground mt-1">{parsed.name}</p>
              <p className="text-xs text-muted-foreground mt-1">Preparando conciliação…</p>
            </div>
          </>
        ) : loading ? (
          <>
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
            <p className="font-medium text-muted-foreground">Lendo arquivo…</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-semibold text-base">Arraste seu extrato aqui</p>
              <p className="text-sm text-muted-foreground">ou clique para selecionar</p>
              <div className="flex items-center justify-center gap-3 mt-3">
                <span className="flex items-center gap-1.5 text-xs border border-border rounded-full px-3 py-1 text-muted-foreground">
                  <FileText className="w-3 h-3" /> .OFX
                </span>
                <span className="flex items-center gap-1.5 text-xs border border-border rounded-full px-3 py-1 text-muted-foreground">
                  <FileSpreadsheet className="w-3 h-3" /> .CSV
                </span>
              </div>
            </div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".ofx,.csv,.txt"
          className="hidden"
          onChange={(e) => processFile(e.target.files[0])}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-4 rounded-xl bg-destructive/10 text-destructive text-sm border border-destructive/20">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Não foi possível ler o arquivo</p>
            <p className="text-xs mt-0.5 opacity-80">{error}</p>
          </div>
        </div>
      )}

      {/* Bank tips */}
      <div className="rounded-xl border bg-muted/30 divide-y divide-border overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-2">
          <Landmark className="w-4 h-4 text-muted-foreground" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Como exportar o extrato do seu banco
          </p>
        </div>
        {BANK_TIPS.map((tip) => (
          <div key={tip.bank} className="px-4 py-2.5 flex items-center justify-between gap-4">
            <span className="text-xs font-medium">{tip.bank}</span>
            <span className="text-xs text-muted-foreground text-right">{tip.steps}</span>
          </div>
        ))}
      </div>
    </div>
  );
}