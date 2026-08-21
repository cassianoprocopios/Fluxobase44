import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { formatCurrency } from "@/lib/constants";
import { toast } from "sonner";

export default function EditableRevenueRow({
  label,
  displayMonthly,
  autoMonthly,
  recordMap,
  manualMonths,
  selectedUnit,
  selectedYear,
  visibleMonths,
  showTotal,
  editable,
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState("");

  const year = parseInt(selectedYear);
  const unit = selectedUnit === "all" ? "" : selectedUnit;

  const upsertMutation = useMutation({
    mutationFn: async ({ monthIdx, value }) => {
      const existing = recordMap?.[unit]?.[monthIdx];
      if (value == null) {
        if (existing) return base44.entities.DREManualRevenue.delete(existing.id);
        return null;
      }
      const payload = { year, month: monthIdx, cost_center: unit, revenue: Number(value) };
      if (existing) return base44.entities.DREManualRevenue.update(existing.id, payload);
      return base44.entities.DREManualRevenue.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dreManualRevenues"] });
      setEditing(null);
      setDraft("");
      toast.success("Faturamento atualizado.");
    },
    onError: () => toast.error("Erro ao salvar faturamento."),
  });

  const startEdit = (monthIdx) => {
    if (!editable) return;
    setEditing(monthIdx);
    const existing = recordMap?.[unit]?.[monthIdx];
    setDraft(existing ? String(existing.revenue).replace(".", ",") : "");
  };

  const commit = () => {
    if (editing == null) return;
    const trimmed = draft.trim().replace(/[^\d.,-]/g, "");
    if (trimmed === "") {
      upsertMutation.mutate({ monthIdx: editing, value: null });
      return;
    }
    const normalized = trimmed.replace(/\./g, "").replace(",", ".");
    const value = Number(normalized);
    upsertMutation.mutate({ monthIdx: editing, value: isNaN(value) ? null : value });
  };

  const visibleValues = visibleMonths.map(({ idx }) => displayMonthly[idx] || 0);
  const total = visibleValues.reduce((s, v) => s + v, 0);

  const cellBase = "px-3 py-2.5 text-sm text-right whitespace-nowrap font-semibold";
  const labelBase =
    "px-4 py-2.5 text-sm whitespace-nowrap sticky left-0 bg-muted/50 z-10 border-r font-semibold";

  return (
    <tr className="bg-muted/50 transition-colors">
      <td className={labelBase}>{label}</td>
      {visibleMonths.map(({ idx }) => {
        const v = displayMonthly[idx] || 0;
        const isManual = manualMonths?.has(idx);
        const autoVal = autoMonthly?.[idx] || 0;

        if (editing === idx) {
          return (
            <td key={idx} className={`${cellBase} bg-primary/10`}>
              <input
                autoFocus
                type="text"
                inputMode="decimal"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") {
                    setEditing(null);
                    setDraft("");
                  }
                }}
                className="w-24 text-right rounded border border-primary bg-card px-2 py-1 text-sm outline-none"
                placeholder={autoVal ? String(autoVal) : "0"}
              />
            </td>
          );
        }

        return (
          <td
            key={idx}
            className={`${cellBase} ${
              isManual ? "bg-primary/15 text-primary" : ""
            } ${editable ? "cursor-pointer hover:bg-primary/10" : ""}`}
            title={isManual ? `Automático: ${formatCurrency(autoVal)}` : undefined}
            onClick={() => startEdit(idx)}
          >
            <span className="inline-flex items-center gap-1 justify-end">
              {isManual && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
              {formatCurrency(v)}
            </span>
          </td>
        );
      })}
      {showTotal && (
        <td className={`${cellBase} border-l`}>{formatCurrency(total)}</td>
      )}
    </tr>
  );
}