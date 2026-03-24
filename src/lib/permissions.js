/**
 * Níveis de acesso:
 *  - admin        → tudo
 *  - financeiro   → lança, importa, edita, concilia
 *  - gestor       → dashboards e relatórios (somente leitura)
 *  - colaborador  → consulta básica (lançamentos somente leitura, sem relatórios avançados)
 */

export const ROLES = {
  ADMIN: "admin",
  FINANCEIRO: "financeiro",
  GESTOR: "gestor",
  COLABORADOR: "colaborador",
};

// Quais roles podem acessar cada rota
export const ROUTE_PERMISSIONS = {
  "/":                      [ROLES.ADMIN, ROLES.FINANCEIRO, ROLES.GESTOR, ROLES.COLABORADOR],
  "/lancamentos":           [ROLES.ADMIN, ROLES.FINANCEIRO, ROLES.GESTOR, ROLES.COLABORADOR],
  "/dashboard-unidades":    [ROLES.ADMIN, ROLES.FINANCEIRO, ROLES.GESTOR],
  "/dre":                   [ROLES.ADMIN, ROLES.FINANCEIRO, ROLES.GESTOR],
  "/fluxo-caixa":           [ROLES.ADMIN, ROLES.FINANCEIRO, ROLES.GESTOR],
  "/relatorios":            [ROLES.ADMIN, ROLES.FINANCEIRO, ROLES.GESTOR],
  "/conciliacao":           [ROLES.ADMIN, ROLES.FINANCEIRO],
  "/importar":              [ROLES.ADMIN, ROLES.FINANCEIRO],
  "/recorrentes":           [ROLES.ADMIN, ROLES.FINANCEIRO],
  "/regras-categorizacao":  [ROLES.ADMIN, ROLES.FINANCEIRO],
  "/configuracoes":         [ROLES.ADMIN],
  "/usuarios":              [ROLES.ADMIN],
};

// Quais roles podem executar ações específicas
export const ACTION_PERMISSIONS = {
  canCreate:      [ROLES.ADMIN, ROLES.FINANCEIRO],
  canEdit:        [ROLES.ADMIN, ROLES.FINANCEIRO],
  canDelete:      [ROLES.ADMIN],
  canImport:      [ROLES.ADMIN, ROLES.FINANCEIRO],
  canConciliate:  [ROLES.ADMIN, ROLES.FINANCEIRO],
  canManageUsers: [ROLES.ADMIN],
  canViewReports: [ROLES.ADMIN, ROLES.FINANCEIRO, ROLES.GESTOR],
};

export function hasRouteAccess(role, path) {
  const allowed = ROUTE_PERMISSIONS[path];
  if (!allowed) return true; // rota não mapeada = livre
  return allowed.includes(role);
}

export function hasAction(role, action) {
  const allowed = ACTION_PERMISSIONS[action];
  if (!allowed) return false;
  return allowed.includes(role);
}