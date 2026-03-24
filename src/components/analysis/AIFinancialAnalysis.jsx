import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Loader2, ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Lightbulb } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function AIFinancialAnalysis({ context, data, label }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const runAnalysis = async () => {
    setLoading(true);
    setAnalysis(null);

    const prompt = `Você é um CFO experiente e consultor financeiro especialista em gestão de pequenas e médias empresas brasileiras. 
Analise os dados financeiros abaixo do relatório "${label}" e forneça insights práticos e objetivos.

CONTEXTO:
${context}

DADOS FINANCEIROS:
${JSON.stringify(data, null, 2)}

Sua análise deve incluir:

## 🔴 Pontos Críticos
Identifique os principais problemas, riscos e onde a empresa está errando. Seja direto e específico com números.

## 🟡 Alertas e Atenção
Tendências preocupantes que precisam de acompanhamento antes que virem problemas maiores.

## 🟢 Pontos Positivos
O que está funcionando bem e deve ser mantido ou ampliado.

## 💡 Recomendações Prioritárias
Liste de 3 a 5 ações concretas e práticas que o gestor deve tomar agora, em ordem de prioridade. Seja específico — cite categorias, percentuais e valores quando possível.

## 📊 Diagnóstico Geral
Em 2-3 frases, o diagnóstico geral da saúde financeira da empresa.

Use linguagem clara, direta e prática. Cite números e percentuais específicos dos dados. Foco em ações que um gestor não-financeiro consiga implementar.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      model: "claude_sonnet_4_6",
    });

    setAnalysis(result);
    setLoading(false);
    setExpanded(true);
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-background">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Análise de IA — CFO Virtual</p>
              <p className="text-xs text-muted-foreground">Insights financeiros baseados nos seus dados</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {analysis && (
              <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)} className="h-8 px-2">
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            )}
            <Button
              size="sm"
              onClick={runAnalysis}
              disabled={loading}
              className="gap-1.5 h-8"
            >
              {loading ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analisando…</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5" /> {analysis ? "Reanalisar" : "Analisar com IA"}</>
              )}
            </Button>
          </div>
        </div>

        {loading && (
          <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            O CFO Virtual está analisando seus dados financeiros…
          </div>
        )}

        {analysis && expanded && (
          <div className="mt-4 pt-4 border-t border-border/60">
            <div className="prose prose-sm max-w-none dark:prose-invert
              prose-headings:text-sm prose-headings:font-bold prose-headings:mt-4 prose-headings:mb-2
              prose-p:text-sm prose-p:text-foreground prose-p:leading-relaxed
              prose-li:text-sm prose-li:text-foreground
              prose-strong:text-foreground
              [&_h2]:flex [&_h2]:items-center [&_h2]:gap-2
            ">
              <ReactMarkdown>{analysis}</ReactMarkdown>
            </div>
            <p className="text-[10px] text-muted-foreground mt-4 pt-3 border-t border-border/40">
              ⚠️ Esta análise é gerada por IA e tem caráter orientativo. Consulte um contador ou CFO para decisões estratégicas importantes. Usa créditos de integração (modelo avançado).
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}