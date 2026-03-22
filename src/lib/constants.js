export const PAYMENT_METHODS = [
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "credito", label: "Cartão de Crédito" },
  { value: "debito", label: "Cartão de Débito" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "outro", label: "Outro" },
];

export const STATUS_OPTIONS = [
  { value: "pago", label: "Pago" },
  { value: "em_aberto", label: "Em Aberto" },
  { value: "cancelado", label: "Cancelado" },
];

export const DEFAULT_ENTRY_CATEGORIES = [
  { name: "Receita c/ Serviços", dre_group: "Receita Operacional" },
  { name: "Receita c/ Produtos", dre_group: "Receita Operacional" },
  { name: "Receita Juros", dre_group: "Receita Financeira" },
  { name: "Receita Investimentos", dre_group: "Receita Financeira" },
  { name: "Outras Receitas", dre_group: "Outras Receitas" },
];

export const DEFAULT_EXIT_CATEGORIES = [
  { name: "Salários", dre_group: "Gastos Fixos" },
  { name: "Pró-labore", dre_group: "Gastos Fixos" },
  { name: "Aluguel", dre_group: "Gastos Fixos" },
  { name: "Água/Luz/Internet", dre_group: "Gastos Fixos" },
  { name: "Marketing", dre_group: "Gastos Variáveis" },
  { name: "Fornecedores", dre_group: "Custos Diretos" },
  { name: "Impostos", dre_group: "Impostos" },
  { name: "Manutenção", dre_group: "Gastos Variáveis" },
  { name: "Transferência entre contas", dre_group: "Não DRE" },
  { name: "Outras Despesas", dre_group: "Gastos Variáveis" },
];

export const DRE_ENTRY_GROUPS = [
  "Receita Operacional",
  "Receita Financeira",
  "Outras Receitas",
];

export const DRE_EXIT_GROUPS = [
  "Custos Diretos",
  "Gastos Fixos",
  "Gastos Variáveis",
  "Impostos",
  "Não DRE",
];

export const MONTHS_PT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

// Normaliza transações importadas da planilha (amount negativo = saida, positivo = entrada)
// e transações nativas do sistema (type = "entrada" | "saida", amount sempre positivo)
export function normalizeTransaction(t) {
  if (!t) return t;
  const amount = parseFloat(t.amount) || 0;
  // Normalizar data: remover horário para evitar problemas de fuso
  const date = t.date ? t.date.substring(0, 10) : t.date;
  // Se já tem type correto (entrada/saida), usa o amount absoluto
  if (t.type === "entrada" || t.type === "saida") {
    return { ...t, date, amount: Math.abs(amount) };
  }
  // Dados importados: amount negativo = saida, positivo = entrada
  return {
    ...t,
    date,
    type: amount >= 0 ? "entrada" : "saida",
    amount: Math.abs(amount),
  };
}

export function formatCurrency(value) {
  if (value == null || isNaN(value)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatCompactCurrency(value) {
  if (value == null || isNaN(value)) return "R$ 0";
  if (Math.abs(value) >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}K`;
  }
  return formatCurrency(value);
}