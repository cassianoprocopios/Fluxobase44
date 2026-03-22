import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Link2, Plus, X, ChevronDown, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const CATEGORIES_FALLBACK = {
  entrada: "Outras Receitas",
  saida: "Outras Despesas",
};

export default function MatchRow({
  match,
  systemTransactions,
  categories = [],
  onConfirmMatch,
  onCreateNew,
  onIgnore,
}) {
  const { bankTx, systemTx, status } = match;
  const confirmed = match.confirmed;
  const ignored = match.ignored;

  const [expanded, setExpanded] = useState(false);
  const [action, setAction] = useState(status === "matched" ? "link" : null);
  const [selectedId, setSelectedId] = useState(systemTx?.id || "");
  const [search, setSearch] = useState("");
  const [newCategory, setNewCategory] = useState("");

  // Filter candidates by search
  const candidates = useMemo(() => {
    const base = systemTransactions
      .filter((t) => t.type === bankTx.type)
      .sort((a, b) => Math.abs(a.amount - bankTx.amount) - Math.abs(b.amount - bankTx.amount));

    if (!search) return base.slice(0, 60);
    const q = search.toLowerCase();
    return base
      .filter((t) =>
        (t.description || "").toLowerCase().includes(q) ||
        (t.category || "").toLowerCase().includes(q) ||
        String(t.amount).includes(q)
      )
      .slice(0, 60);
  }, [systemTransactions, bankTx, search]);

  const filteredCategories = categories.filter((c) => c.type === bankTx.type);

  const handleConfirm = () => {
    if (action === "link") {
      const tx = systemTransactions.find((t) => t.id === selectedId);
      if (tx) onConfirmMatch(bankTx.id, tx);
    } else if (action === "create") {
      onCreateNew(bankTx, newCategory || filteredCategories[0]?.name || CATEGORIES_FALLBACK[bankTx.type]);
    } else if (action === "ignore") {
      onIgnore(bankTx.id);
    }
    setExpanded(false);
  };

  // Color scheme
  const rowBg = confirmed
    ? "bg-success/5 border-success/20"
    : ignored
    ? "bg-muted/40 border-border opacity-60"
    : status === "matched"
    ? "bg-blue-50/60 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800"
    : "bg-amber-50/60 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800";

  const linkedTx = confirmed && match.linkedTx;
  const createdNew = confirmed && match.createNew;

  return (
    <div className={`rounded-xl border transition-all ${rowBg}`}>
      {/* Main row */}
      <div className="flex items-center gap-3 p-4 flex-wrap sm:flex-nowrap">

        {/* Status indicator dot */}
        <div className="shrink-0">
          {confirmed ? (
            <div className="w-8 h-8 rounded-full bg-success/15 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-success" />
            </div>
          ) : ignored ? (
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <X className="w-4 h-4 text-muted-foreground" />
            </div>
          ) : (
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              status === "matched" ? "bg-blue-100 dark:bg-blue-900/30" : "bg-amber-100 dark:bg-amber-900/30"
            }`}>
              <Link2 className={`w-4 h-4 ${status === "matched" ? "text-blue-600 dark:text-blue-400" : "text-amber-600 dark:text-amber-400"}`} />
            </div>
          )}
        </div>

        {/* Bank transaction */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className={`text-base font-bold ${bankTx.type === "entrada" ? "text-success" : "text-destructive"}`}>
              {bankTx.type === "entrada" ? "+" : "-"}{formatCurrency(bankTx.amount)}
            </span>
            <span className="text-xs text-muted-foreground">{formatDate(bankTx.date)}</span>
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${
              bankTx.type === "entrada" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
            }`}>
              {bankTx.type === "entrada" ? "Entrada" : "Saída"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground truncate mt-0.5">{bankTx.description || "Sem descrição"}</p>
        </div>

        {/* Arrow */}
        <ArrowRight className="w-4 h-4 text-muted-foreground/40 hidden sm:block shrink-0" />

        {/* System match info */}
        <div className="flex-1 min-w-0">
          {linkedTx ? (
            <div>
              <p className="text-sm font-medium truncate">{linkedTx.description || linkedTx.category}</p>
              <p className="text-xs text-muted-foreground">{linkedTx.category} · {formatDate(linkedTx.date)} · {formatCurrency(linkedTx.amount)}</p>
            </div>
          ) : createdNew ? (
            <div>
              <p className="text-sm font-medium text-success">Novo lançamento criado</p>
              <p className="text-xs text-muted-foreground">{match.newCategory || "—"}</p>
            </div>
          ) : ignored ? (
            <p className="text-sm text-muted-foreground italic">Ignorado</p>
          ) : systemTx ? (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Sugestão automática:</p>
              <p className="text-sm font-medium truncate">{systemTx.description || systemTx.category}</p>
              <p className="text-xs text-muted-foreground">{systemTx.category} · {formatDate(systemTx.date)} · {formatCurrency(systemTx.amount)}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Nenhum lançamento correspondente</p>
          )}
        </div>

        {/* Expand / action button */}
        {!confirmed && !ignored && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors"
          >
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {/* Expanded panel */}
      {expanded && !confirmed && !ignored && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
          {/* Action tabs */}
          <div className="flex gap-2 flex-wrap">
            {[
              { value: "link", label: "Vincular lançamento", icon: Link2 },
              { value: "create", label: "Criar novo", icon: Plus },
              { value: "ignore", label: "Ignorar", icon: X },
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setAction(value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  action === value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>

          {/* Link: search + select */}
          {action === "link" && (
            <div className="space-y-2">
              <Input
                placeholder="Buscar por descrição, categoria ou valor…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-sm"
              />
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o lançamento…" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.length === 0 ? (
                    <div className="py-3 text-center text-sm text-muted-foreground">Nenhum resultado</div>
                  ) : (
                    candidates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="flex items-center gap-2">
                          <span className={`text-xs font-semibold ${t.type === "entrada" ? "text-success" : "text-destructive"}`}>
                            {formatCurrency(t.amount)}
                          </span>
                          <span className="text-muted-foreground">·</span>
                          <span>{formatDate(t.date)}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="truncate max-w-[160px]">{t.description || t.category}</span>
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedId && (() => {
                const sel = systemTransactions.find((t) => t.id === selectedId);
                if (!sel) return null;
                const diff = Math.abs(sel.amount - bankTx.amount);
                return diff > 0.01 ? (
                  <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded px-2 py-1">
                    ⚠ Diferença de {formatCurrency(diff)} entre extrato e lançamento selecionado.
                  </p>
                ) : null;
              })()}
            </div>
          )}

          {/* Create new: choose category */}
          {action === "create" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Categoria para o novo lançamento:</p>
              <Select
                value={newCategory || filteredCategories[0]?.name || ""}
                onValueChange={setNewCategory}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione a categoria…" />
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.map((c) => (
                    <SelectItem key={c.id || c.name} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2.5">
                Cria lançamento de <strong>{formatCurrency(bankTx.amount)}</strong> em <strong>{formatDate(bankTx.date)}</strong> como <strong>Pago</strong>. Editável depois em Lançamentos.
              </p>
            </div>
          )}

          {/* Ignore: confirmation message */}
          {action === "ignore" && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2.5">
              Esta transação do extrato será ignorada e não criará nenhum lançamento no sistema.
            </p>
          )}

          {/* Confirm */}
          {action && (
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setExpanded(false)}>
                Cancelar
              </Button>
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