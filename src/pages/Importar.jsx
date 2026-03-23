import React, { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileSpreadsheet, CheckCircle, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/constants";
import { Link, useNavigate } from "react-router-dom";

export default function Importar() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState("upload"); // upload | preview | done
  const [uploading, setUploading] = useState(false);
  const [extractedData, setExtractedData] = useState([]);
  const [selected, setSelected] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importType, setImportType] = useState("auto");

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => base44.entities.Category.list(),
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: "object",
        properties: {
          transactions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: { type: "string", description: "Data no formato YYYY-MM-DD" },
                description: { type: "string", description: "Descrição do lançamento" },
                category: { type: "string", description: "Categoria ou plano de contas" },
                amount: { type: "number", description: "Valor numérico. Use negativo para saídas/débitos/despesas e positivo para entradas/créditos/receitas" },
                type: { type: "string", description: "Tipo: 'entrada' para créditos/receitas, 'saida' para débitos/despesas. Detectar pelo contexto ou sinal do valor." },
                payment_method: { type: "string", description: "Forma de pagamento" },
                status: { type: "string", description: "Status: pago ou em_aberto" },
                cost_center: { type: "string", description: "Centro de custo" },
                bank_account: { type: "string", description: "Banco ou conta" },
                client_supplier: { type: "string", description: "Cliente ou fornecedor" },
              },
            },
          },
        },
      },
    });

    setUploading(false);

    if (result.status === "success" && result.output?.transactions) {
      const txns = result.output.transactions
        .map((t, i) => {
          const rawAmount = t.amount || 0;
          // Detecta tipo: campo explícito > sinal do valor > fallback para importType
          let detectedType = t.type;
          if (!detectedType || !["entrada", "saida"].includes(detectedType)) {
            detectedType = rawAmount < 0 ? "saida" : (importType === "auto" ? "entrada" : importType);
          }
          return {
            ...t,
            _id: i,
            type: detectedType,
            amount: Math.abs(rawAmount),
          };
        })
        .sort((a, b) => b.amount - a.amount);
      setExtractedData(txns);
      setSelected(txns.map((_, i) => i));
      setStep("preview");
    } else {
      toast.error("Não foi possível extrair os dados do arquivo.");
    }
  };

  const handleImport = async () => {
    setImporting(true);
    const toImport = extractedData
      .filter((_, i) => selected.includes(i))
      .map((t) => ({
        date: t.date,
        type: importType === "auto" ? (t.type || "saida") : importType,
        category: t.category || "Outros",
        description: t.description,
        amount: t.amount,
        payment_method: t.payment_method || "outro",
        status: t.status || "pago",
        cost_center: t.cost_center,
        bank_account: t.bank_account,
        client_supplier: t.client_supplier,
      }));

    await base44.entities.Transaction.bulkCreate(toImport);
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    setImporting(false);
    setStep("done");
    toast.success(`${toImport.length} lançamentos importados!`);
  };

  const toggleSelect = (idx) => {
    setSelected((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const toggleAll = () => {
    if (selected.length === extractedData.length) {
      setSelected([]);
    } else {
      setSelected(extractedData.map((_, i) => i));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/lancamentos">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Importar Dados</h1>
          <p className="text-sm text-muted-foreground">
            Importe lançamentos de arquivos Excel ou CSV
          </p>
        </div>
      </div>

      {step === "upload" && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-border rounded-xl">
              <FileSpreadsheet className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Arraste ou selecione um arquivo
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Formatos: CSV, XLS, XLSX
              </p>

              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-3">
                  <Label className="text-sm">Tipo dos lançamentos:</Label>
                  <Select value={importType} onValueChange={setImportType}>
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">🔍 Detectar automaticamente</SelectItem>
                      <SelectItem value="entrada">Forçar Entradas</SelectItem>
                      <SelectItem value="saida">Forçar Saídas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <label className="cursor-pointer">
                  <Input
                    type="file"
                    accept=".csv,.xls,.xlsx"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button asChild disabled={uploading}>
                    <span>
                      {uploading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      {uploading ? "Processando..." : "Selecionar Arquivo"}
                    </span>
                  </Button>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "preview" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Revisão — {extractedData.length} registros encontrados
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Voltar
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing || selected.length === 0}
              >
                {importing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Importar {selected.length} lançamentos
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selected.length === extractedData.length}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extractedData.map((t, i) => (
                    <TableRow key={i} className="hover:bg-muted/30">
                      <TableCell>
                        <Checkbox
                          checked={selected.includes(i)}
                          onCheckedChange={() => toggleSelect(i)}
                        />
                      </TableCell>
                      <TableCell className="text-sm">{t.date || "—"}</TableCell>
                      <TableCell>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          (importType === "auto" ? t.type : importType) === "entrada"
                            ? "bg-success/10 text-success"
                            : "bg-destructive/10 text-destructive"
                        }`}>
                          {(importType === "auto" ? t.type : importType) === "entrada" ? "Entrada" : "Saída"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{t.category || "—"}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {t.description || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-right font-medium">
                        {formatCurrency(t.amount)}
                      </TableCell>
                      <TableCell className="text-sm capitalize">
                        {t.status || "pago"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "done" && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center py-16">
              <CheckCircle className="w-16 h-16 text-success mb-4" />
              <h3 className="text-xl font-semibold mb-2">Importação Concluída!</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Todos os lançamentos foram importados com sucesso.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => {
                  setStep("upload");
                  setExtractedData([]);
                  setSelected([]);
                }}>
                  Importar mais
                </Button>
                <Button onClick={() => navigate("/lancamentos")}>
                  Ver Lançamentos
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}