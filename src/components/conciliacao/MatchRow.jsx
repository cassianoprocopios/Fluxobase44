import React, { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Link2, Plus, ChevronDown, X, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function formatDate(d) {
  if (!d) return "—";
  try { return format(new Date(d + "T00:00:00"), "dd/MM/yy", { locale: ptBR }); }
  catch { return d; }
}

export default function MatchRow({ match, systemTransactions, onConfirmMatch, onCreateNew, onIgnore }) {
  const { bankTx, systemTx, status } = match;
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState(systemTx?.id || "");
  const [action, setAction] = useState(status === "matched" ? "link" : null); // "link" | "create" | "ignore"

  const confirmed = match.confirmed;

  const candidates = systemTransactions
    .filter((t) => t.type === bankTx.type)
    .sort((a, b) => {
      const da = Math.abs(a.amount - bankTx.amount);
      const db = Math.abs(b.amount - bankTx.amount);
      return da - db;
    })
    .slice(0, 50);

  const handleConfirm = () => {
    if (action === "link") {
      const tx = systemTransactions.find((t) => t.id === selectedId);
      if (tx) onConfirmMatch(bankTx.id, tx);
    } else if (action === "create") {
      onCreateNew(bankTx);
    } else if (action === "ignore") {
      onIgnore(bankTx.id);
    }
  };

  const statusColor = confirmed
    ? "bg-success/10 border-success/20"
    : match.ignored
    ? "bg-muted/50 border-border opacity-50"
    : status === "matched"
    ? "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800"
    : "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800";

  return (
    <div className={`rounded-xl border p-4 transition-all ${statusColor}`}>
      {/* Header row */}
      <div className="flex items-start gap-3 flex-wrap sm:flex-nowrap">
        {/* Bank transaction info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              bankTx.type === "entrada" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
            }`}>
              {bankTx.type === "entrada" ? "Entrada" : "Saída"}
            </span>
            <span className="text-xs text-muted-foreground">{formatDate(bankTx.date)}</span>
            {confirmed && <Badge className="bg-success/15 text-success border-0 text-xs">Conciliado</Badge>}
            {match.ignored && <Badge variant="secondary" className="text-xs">Ignorado</Badge>}
            {!confirmed && !match.ignored && status === "matched" && (
              <Badge className="bg-blue-100 text-blue-700 border-0 text-xs dark:bg-blue-900/30 dark:text-blue-400">Sugestão automática</Badge>
            )}
            {!confirmed && !match.ignored && status === "pending" && (
              <Badge className="bg-amber-100 text-amber-700 border-0 text-xs dark:bg-amber-900/30 dark:text-amber-400">Sem correspondência</Badge>
            )}
          </div>
          <p className="font-medium text-sm mt-1 truncate">{bankTx.description || "—"}</p>
          <p className="text-lg font-bold mt-0.5">
            <span className={bankTx.type === "entrada" ? "text-success" : "text-destructive"}>
              {bankTx.type === "entrada" ? "+" : "-"}{formatCurrency(bankTx.amount)}
            </span>
          </p>
        </div>

        {/* Arrow / link icon */}
        <div className="hidden sm:flex items-center self-center text-muted-foreground">
          <Link2 className="w-5 h-5" />
        </div>

        {/* System transaction match */}
        <div className="flex-1 min-w-0">
          {confirmed && match.linkedTx ? (
            <div className="text-sm space-y-0.5">
              <p className="text-xs text-muted-foreground">Vinculado a:</p>
              <p className="font-medium truncate">{match.linkedTx.description || match.linkedTx.category}</p>
              <p className="text-xs text-muted-foreground">{match.linkedTx.category} · {formatDate(match.linkedTx.date)}</p>
              <p className="font-semibold">{formatCurrency(match.linkedTx.amount)}</p>
            </div>
          ) : match.ignored ? (
            <p className="text-sm text-muted-foreground italic">Transação ignorada</p>
          ) : systemTx && !expanded ? (
            <div className="text-sm space-y-0.5">
              <p className="text-xs text-muted-foreground">Sugerido:</p>
              <p className="font-medium truncate">{systemTx.description || systemTx.category}</p>
              <p className="text-xs text-muted-foreground">{systemTx.category} · {formatDate(systemTx.date)}</p>
              <p className="font-semibold">{formatCurrency(systemTx.amount)}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              {expanded ? "Selecione abaixo" : "Nenhum lançamento encontrado"}
            </p>
          )}
        </div>

        {/* Actions */}
        {!confirmed && !match.ignored && (
          <div className="flex items-center gap-2 shrink-0 self-start">
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground h-8 px-2"
              onClick={() => setExpanded(!expanded)}
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </Button>
          </div>
        )}
      </div>

      {/* Expanded action panel */}
      {expanded && !confirmed && !match.ignored && (
        <div className="mt-4 pt-4 border-t border-border space-y-4">
          {/* Choose action */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setAction("link")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                action === "link" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
              }`}
            >
              <Link2 className="w-3.5 h-3.5" /> Vincular lançamento
            </button>
            <button
              onClick={() => setAction("create")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                action === "create" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
              }`}
            >
              <Plus className="w-3.5 h-3.5" /> Criar novo lançamento
            </button>
            <button
              onClick={() => setAction("ignore")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                action === "ignore" ? "bg-muted text-foreground border-border" : "border-border hover:bg-muted"
              }`}
            >
              <X className="w-3.5 h-3.5" /> Ignorar
            </button>
          </div>

          {/* Link selector */}
          {action === "link" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Selecione o lançamento para vincular:</p>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Buscar lançamento…" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {formatDate(t.date)} · {t.category} · {formatCurrency(t.amount)}
                      {t.description ? ` · ${t.description.substring(0, 30)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {action === "create" && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              Será criado um novo lançamento com os dados do extrato como <strong>Pago</strong>. Você poderá editar depois em Lançamentos.
            </p>
          )}

          {/* Confirm button */}
          {action && (
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={action === "link" && !selectedId}
                className="gap-1.5"
              >
                <Check className="w-3.5 h-3.5" /> Confirmar
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}