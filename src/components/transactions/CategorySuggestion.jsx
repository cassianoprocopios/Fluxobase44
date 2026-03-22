import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Lightbulb, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CategorySuggestion({
  description,
  transactionType,
  existingCategories,
  onSuggestion,
  loading: externalLoading,
}) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!description?.trim() || !transactionType || externalLoading) {
      setSuggestion(null);
      setError("");
      return;
    }

    const debounceTimer = setTimeout(() => {
      fetchSuggestion();
    }, 800);

    return () => clearTimeout(debounceTimer);
  }, [description, transactionType, externalLoading]);

  const fetchSuggestion = async () => {
    setLoading(true);
    setError("");

    const categoryList = existingCategories
      .filter((c) => c.type === transactionType)
      .map((c) => c.name)
      .join(", ");

    const prompt = `Baseado no histórico de transações e nas categorias disponíveis, sugerir a categoria mais apropriada para esta transação.

Tipo: ${transactionType === "entrada" ? "Receita/Entrada" : "Despesa/Saída"}
Descrição: "${description}"

Categorias disponíveis: ${categoryList || "Nenhuma categoria específica"}

Responda APENAS com o nome exato de uma categoria ou "Outra categoria" se nenhuma se encaixar. Não adicione explicações, apenas o nome da categoria.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      model: "gemini_3_flash",
    });

    const suggestedCategory = result?.trim();

    if (
      suggestedCategory &&
      suggestedCategory !== "Outra categoria" &&
      suggestedCategory.length > 0
    ) {
      setSuggestion(suggestedCategory);
      onSuggestion?.(suggestedCategory);
    } else {
      setSuggestion(null);
    }

    setLoading(false);
  };

  if (!description?.trim() || !transactionType || externalLoading) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Analisando...
        </div>
      ) : suggestion ? (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
          <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs text-primary font-medium">
            Sugestão: <span className="font-semibold">{suggestion}</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}