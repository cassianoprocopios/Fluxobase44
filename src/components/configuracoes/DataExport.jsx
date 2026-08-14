import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Database, FileJson } from "lucide-react";
import { toast } from "sonner";

const ENTITIES = [
  { name: "Transaction", label: "Transações", key: "transactions" },
  { name: "Category", label: "Categorias", key: "categories" },
  { name: "CostCenter", label: "Unidades / Centros de custo", key: "cost_centers" },
  { name: "BankAccount", label: "Bancos / Contas", key: "bank_accounts" },
  { name: "CategorizationRule", label: "Regras de categorização", key: "categorization_rules" },
  { name: "RecurringTransaction", label: "Lançamentos recorrentes", key: "recurring_transactions" },
  { name: "MonthlyGoal", label: "Metas mensais", key: "monthly_goals" },
  { name: "MonthlyBilling", label: "Faturamento mensal", key: "monthly_billing" },
];

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function DataExport() {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState("");

  async function fetchAll() {
    const data = {};
    for (const e of ENTITIES) {
      setProgress(`Baixando ${e.label}...`);
      try {
        const records = await base44.entities[e.name].list("-created_date", 10000);
        data[e.key] = records;
      } catch (err) {
        console.warn(`Falha ao exportar ${e.name}:`, err);
        data[e.key] = [];
      }
    }
    return data;
  }

  async function handleExportJson() {
    setExporting(true);
    setProgress("Preparando exportação...");
    try {
      const data = await fetchAll();
      const payload = {
        app: "FinFlow Pro",
        exported_at: new Date().toISOString(),
        version: 1,
        data,
      };
      const stamp = new Date().toISOString().slice(0, 10);
      downloadFile(JSON.stringify(payload, null, 2), `finflow-backup-${stamp}.json`, "application/json");
      toast.success("Backup completo baixado!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao exportar dados.");
    } finally {
      setExporting(false);
      setProgress("");
    }
  }

  async function handleExportCsv() {
    setExporting(true);
    setProgress("Preparando transações...");
    try {
      const transactions = await base44.entities.Transaction.list("-created_date", 10000);
      if (transactions.length === 0) {
        toast.info("Nenhuma transação para exportar.");
        return;
      }
      const headers = [
        "id", "date", "competence_date", "type", "category", "description",
        "amount", "payment_method", "cost_center", "bank_account",
        "is_recurring", "dre_classification", "created_date",
      ];
      const escape = (v) => {
        if (v == null) return "";
        const s = String(v).replace(/"/g, '""');
        return /[",\n;]/.test(s) ? `"${s}"` : s;
      };
      const rows = transactions.map((t) =>
        headers.map((h) => escape(t[h])).join(";")
      );
      const csv = "\uFEFF" + headers.join(";") + "\n" + rows.join("\n");
      const stamp = new Date().toISOString().slice(0, 10);
      downloadFile(csv, `finflow-transacoes-${stamp}.csv`, "text/csv;charset=utf-8");
      toast.success("Transações exportadas em CSV!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao exportar transações.");
    } finally {
      setExporting(false);
      setProgress("");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          Backup e Migração
        </CardTitle>
        <CardDescription>
          Exporte todos os dados do sistema para não perder informações ao migrar para outra plataforma.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <FileJson className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Backup completo (JSON)</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Inclui transações, categorias, unidades, contas, regras, recorrentes, metas e faturamento. Ideal para migrar para outro sistema.
              </p>
            </div>
            <Button size="sm" onClick={handleExportJson} disabled={exporting}>
              <Download className="w-3.5 h-3.5 mr-1" />
              {exporting ? "Exportando..." : "Baixar JSON"}
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <Download className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Transações (CSV)</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Apenas as transações, em planilha. Útil para abrir no Excel ou importar em outro lugar.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={handleExportCsv} disabled={exporting}>
              <Download className="w-3.5 h-3.5 mr-1" />
              Baixar CSV
            </Button>
          </div>
        </div>

        {exporting && progress && (
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            {progress}
          </p>
        )}
      </CardContent>
    </Card>
  );
}