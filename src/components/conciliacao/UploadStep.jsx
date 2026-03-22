import React, { useRef, useState } from "react";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseOFX, parseCSV } from "@/lib/ofxParser";

export default function UploadStep({ onParsed }) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const processFile = (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["ofx", "csv", "txt"].includes(ext)) {
      setError("Formato não suportado. Use arquivos .ofx ou .csv");
      return;
    }

    setLoading(true);
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      let txns = [];
      if (ext === "ofx" || ext === "txt") {
        txns = parseOFX(content);
      } else {
        txns = parseCSV(content);
      }

      if (txns.length === 0) {
        setError("Nenhuma transação encontrada no arquivo. Verifique o formato.");
        setLoading(false);
        return;
      }

      onParsed(txns, file.name);
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
    <div className="max-w-2xl mx-auto py-12 space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">Importar extrato bancário</h2>
        <p className="text-sm text-muted-foreground">
          Faça upload do extrato no formato OFX (exportado pelo seu banco) ou CSV.
        </p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-16 flex flex-col items-center gap-4 cursor-pointer transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
        }`}
      >
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Upload className="w-8 h-8 text-primary" />
        </div>
        <div className="text-center">
          <p className="font-medium">Arraste o arquivo aqui ou clique para selecionar</p>
          <p className="text-sm text-muted-foreground mt-1">Suporta .OFX e .CSV</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".ofx,.csv,.txt"
          className="hidden"
          onChange={(e) => processFile(e.target.files[0])}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && (
        <p className="text-center text-sm text-muted-foreground">Processando arquivo…</p>
      )}

      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <FileText className="w-3.5 h-3.5" /> Como exportar seu extrato
        </p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li><strong>Nubank:</strong> App → Extrato → Exportar → OFX</li>
          <li><strong>Bradesco:</strong> Internet Banking → Extrato → Exportar → OFX</li>
          <li><strong>Itaú:</strong> Internet Banking → Extrato → Baixar OFX</li>
          <li><strong>Qualquer banco:</strong> CSV com colunas Data, Valor, Descrição</li>
        </ul>
      </div>
    </div>
  );
}