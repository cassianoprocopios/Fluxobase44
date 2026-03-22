import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { autoMatch } from "@/lib/ofxParser";
import UploadStep from "@/components/conciliacao/UploadStep";
import MatchRow from "@/components/conciliacao/MatchRow";
import ConciliacaoSummary from "@/components/conciliacao/ConciliacaoSummary";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, CheckCheck, Download, Square, CheckSquare, MinusSquare, Trash2, Plus, Settings2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";

const FILTER_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "entrada", label: "Entradas" },
  { value: "saida", label: "Saídas" },
  { value: "pending", label: "Pendentes" },
  { value: "matched", label: "Com sugestão" },
  { value: "confirmed", label: "Conciliados" },
  { value: "ignored", label: "Ignorados" },
];

export default function Conciliacao() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [step, setStep] = useState("upload"); // "upload" | "review"
  const [fileName, setFileName] = useState("");
  const [matches, setMatches] = useState([]);
  const [filter, setFilter] = useState("all");
  const handleFilterChange = (val) => { setFilter(val); setSelectedIds(new Set()); };
  const [isSaving, setIsSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => base44.entities.Transaction.list("-date", 5000),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => base44.entities.Category.list(),
  });

  const { data: rules = [] } = useQuery({
    queryKey: ["categorizationRules"],
    queryFn: () => base44.entities.CategorizationRule.list(),
  });

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });
  const userRole = me?.role || "colaborador";

  const handleParsed = (bankTxns, name) => {
    setFileName(name);
    const result = autoMatch(bankTxns, transactions, rules);
    setMatches(result);
    setStep("review");
  };

  const handleConfirmMatch = (bankTxId, systemTx, reset = false) => {
    if (reset) {
      setMatches((prev) =>
        prev.map((m) =>
          m.bankTx.id === bankTxId
            ? { ...m, confirmed: false, ignored: false, linkedTx: null, createNew: false, newCategory: null }
            : m
        )
      );
      return;
    }
    setMatches((prev) =>
      prev.map((m) =>
        m.bankTx.id === bankTxId
          ? { ...m, confirmed: true, linkedTx: systemTx, status: "matched" }
          : m
      )
    );
  };

  const handleCreateNew = (bankTx, category) => {
    setMatches((prev) =>
      prev.map((m) =>
        m.bankTx.id === bankTx.id
          ? { ...m, confirmed: true, createNew: true, linkedTx: null, newCategory: category }
          : m
      )
    );
  };

  const handleIgnore = (bankTxId) => {
    setMatches((prev) =>
      prev.map((m) =>
        m.bankTx.id === bankTxId ? { ...m, ignored: true } : m
      )
    );
  };

  // Confirm all auto-matched at once
  const handleConfirmAll = () => {
    setMatches((prev) =>
      prev.map((m) =>
        m.status === "matched" && !m.confirmed && !m.ignored
          ? { ...m, confirmed: true, linkedTx: m.systemTx }
          : m
      )
    );
  };

  // Save all confirmed to DB
  const handleSaveAll = async () => {
    setIsSaving(true);
    const toCreate = matches.filter((m) => m.confirmed && m.createNew);
    const toUpdate = matches.filter((m) => m.confirmed && m.linkedTx && !m.createNew);

    let created = 0;
    let updated = 0;

    for (const m of toCreate) {
      const btx = m.bankTx;
      await base44.entities.Transaction.create({
        date: btx.date,
        type: btx.type,
        category: m.newCategory || (btx.type === "entrada" ? "Outras Receitas" : "Outras Despesas"),
        description: btx.description,
        amount: btx.amount,
        status: "pago",
        payment_method: "outro",
      });
      created++;
    }

    for (const m of toUpdate) {
      if (m.linkedTx?.status === "em_aberto") {
        await base44.entities.Transaction.update(m.linkedTx.id, { status: "pago" });
        updated++;
      }
    }

    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    setIsSaving(false);

    toast({
      title: "Conciliação salva",
      description: `${created} lançamento(s) criado(s), ${updated} atualizado(s) para "Pago".`,
    });
  };

  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      if (filter === "all") return true;
      if (filter === "entrada") return m.bankTx.type === "entrada";
      if (filter === "saida") return m.bankTx.type === "saida";
      if (filter === "confirmed") return m.confirmed;
      if (filter === "ignored") return m.ignored;
      if (filter === "pending") return !m.confirmed && !m.ignored && m.status === "pending";
      if (filter === "matched") return !m.confirmed && !m.ignored && m.status === "matched";
      return true;
    });
  }, [matches, filter]);

  const autoMatchCount = matches.filter((m) => m.status === "matched" && !m.confirmed && !m.ignored).length;
  const confirmedCount = matches.filter((m) => m.confirmed).length;

  // Split by type
  const entradasFiltered = filteredMatches.filter((m) => m.bankTx.type === "entrada");
  const saidasFiltered = filteredMatches.filter((m) => m.bankTx.type === "saida");

  // Bulk selection helpers (per visible group)
  const selectableIds = filteredMatches
    .filter((m) => !m.confirmed && !m.ignored)
    .map((m) => m.bankTx.id);

  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));
  const someSelected = selectableIds.some((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        selectableIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => new Set([...prev, ...selectableIds]));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Bulk actions
  const handleBulkConfirmMatched = () => {
    setMatches((prev) =>
      prev.map((m) =>
        selectedIds.has(m.bankTx.id) && m.status === "matched" && !m.confirmed && !m.ignored
          ? { ...m, confirmed: true, linkedTx: m.systemTx }
          : m
      )
    );
    setSelectedIds(new Set());
  };

  const handleBulkIgnore = () => {
    setMatches((prev) =>
      prev.map((m) =>
        selectedIds.has(m.bankTx.id) && !m.confirmed && !m.ignored
          ? { ...m, ignored: true }
          : m
      )
    );
    setSelectedIds(new Set());
  };

  const handleBulkCreateNew = () => {
    setMatches((prev) =>
      prev.map((m) =>
        selectedIds.has(m.bankTx.id) && !m.confirmed && !m.ignored
          ? {
              ...m,
              confirmed: true,
              createNew: true,
              linkedTx: null,
              newCategory: m.suggestedCategory || (m.bankTx.type === "entrada" ? "Outras Receitas" : "Outras Despesas"),
            }
          : m
      )
    );
    setSelectedIds(new Set());
  };

  const selectedCount = selectedIds.size;
  const selectedMatchedCount = [...selectedIds].filter((id) => {
    const m = matches.find((x) => x.bankTx.id === id);
    return m && m.status === "matched" && !m.confirmed && !m.ignored;
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
          <h1 className="text-2xl font-bold tracking-tight">Conciliação Bancária</h1>
          <p className="text-sm text-muted-foreground">
            {step === "upload"
              ? "Importe um extrato OFX ou CSV para comparar com os lançamentos do sistema."
              : `Extrato: ${fileName} · ${matches.length} transações importadas`}
          </p>
          </div>
        </div>

        {step === "review" && (
          <div className="flex items-center gap-2 flex-wrap">
            {autoMatchCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleConfirmAll} className="gap-1.5">
                <CheckCheck className="w-4 h-4" />
                Aceitar {autoMatchCount} sugestões
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSaveAll}
              disabled={isSaving || confirmedCount === 0}
              className="gap-1.5"
            >
              <Download className="w-4 h-4" />
              {isSaving ? "Salvando…" : `Salvar ${confirmedCount} conciliados`}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setStep("upload"); setMatches([]); }}
              className="gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" /> Novo extrato
            </Button>
          </div>
        )}
      </div>

      {step === "upload" && (
        <>
          <div className="flex justify-end">
            <Link to="/regras-categorizacao">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Settings2 className="w-4 h-4" />
                Regras de categorização
              </Button>
            </Link>
          </div>
          <UploadStep onParsed={handleParsed} />
        </>
      )}

      {step === "review" && (
        <>
          <ConciliacaoSummary matches={matches} />

          {/* Filter */}
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm font-medium text-muted-foreground">Filtrar:</p>
            <div className="flex gap-2 flex-wrap">
              {FILTER_OPTIONS.map((opt) => {
                const count = matches.filter((m) => {
                  if (opt.value === "all") return true;
                  if (opt.value === "confirmed") return m.confirmed;
                  if (opt.value === "ignored") return m.ignored;
                  if (opt.value === "pending") return !m.confirmed && !m.ignored && m.status === "pending";
                  if (opt.value === "matched") return !m.confirmed && !m.ignored && m.status === "matched";
                  return true;
                }).length;
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleFilterChange(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                      filter === opt.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {opt.label}
                    <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                      filter === opt.value ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bulk action bar */}
          {selectableIds.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap bg-muted/50 border border-border rounded-xl px-4 py-2.5">
              {/* Select all toggle */}
              <button onClick={toggleSelectAll} className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
                {allSelected ? (
                  <CheckSquare className="w-4 h-4 text-primary" />
                ) : someSelected ? (
                  <MinusSquare className="w-4 h-4 text-primary" />
                ) : (
                  <Square className="w-4 h-4 text-muted-foreground" />
                )}
                {allSelected ? "Desmarcar todos" : `Selecionar todos (${selectableIds.length})`}
              </button>

              {selectedCount > 0 && (
                <>
                  <span className="text-muted-foreground text-xs">|</span>
                  <span className="text-sm text-muted-foreground">{selectedCount} selecionado{selectedCount > 1 ? "s" : ""}</span>
                  <div className="flex gap-2 flex-wrap ml-auto">
                    {selectedMatchedCount > 0 && (
                      <Button size="sm" variant="outline" onClick={handleBulkConfirmMatched} className="gap-1.5 h-7 text-xs">
                        <CheckCheck className="w-3.5 h-3.5" />
                        Aceitar {selectedMatchedCount} sugestão{selectedMatchedCount > 1 ? "ões" : ""}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={handleBulkCreateNew} className="gap-1.5 h-7 text-xs">
                      <Plus className="w-3.5 h-3.5" />
                      Criar novos ({selectedCount})
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleBulkIgnore} className="gap-1.5 h-7 text-xs text-muted-foreground">
                      <Trash2 className="w-3.5 h-3.5" />
                      Ignorar ({selectedCount})
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Match list split by type */}
          {filteredMatches.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">Nenhuma transação neste filtro.</p>
          ) : (
            <div className="space-y-8">
              {[
                { label: "Entradas", type: "entrada", items: entradasFiltered, color: "text-success", bg: "bg-success/5 border-success/20" },
                { label: "Saídas", type: "saida", items: saidasFiltered, color: "text-destructive", bg: "bg-destructive/5 border-destructive/20" },
              ].map(({ label, items, color, bg }) =>
                items.length === 0 ? null : (
                  <div key={label} className="space-y-3">
                    {/* Group header */}
                    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${bg}`}>
                      <span className={`text-xs font-bold uppercase tracking-wider ${color}`}>{label}</span>
                      <span className="text-xs text-muted-foreground">{items.length} transação{items.length > 1 ? "ões" : ""}</span>
                    </div>

                    {/* Rows */}
                    <div className="space-y-3">
                      {items.map((match) => {
                        const isSelectable = !match.confirmed && !match.ignored;
                        const isSelected = selectedIds.has(match.bankTx.id);
                        return (
                          <div key={match.bankTx.id} className="flex items-start gap-2">
                            {isSelectable ? (
                              <button
                                onClick={() => toggleSelect(match.bankTx.id)}
                                className="mt-4 shrink-0 text-muted-foreground hover:text-primary transition-colors"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-primary" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            ) : (
                              <div className="w-4 mt-4 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <MatchRow
                                match={match}
                                systemTransactions={transactions}
                                categories={categories}
                                onConfirmMatch={handleConfirmMatch}
                                onCreateNew={handleCreateNew}
                                onIgnore={handleIgnore}
                                userRole={userRole}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}