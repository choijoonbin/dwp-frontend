/**
 * Admin routes for E2E testing
 */
export const ADMIN_ROUTES = {
  monitoring: '/admin/monitoring',
  users: '/admin/users',
  roles: '/admin/roles',
  resources: '/admin/resources',
  codes: '/admin/codes',
  codeUsages: '/admin/code-usages',
  audit: '/admin/audit',
  menus: '/admin/menus',
} as const;

/**
 * AI Workspace routes
 */
export const AI_WORKSPACE_ROUTES = {
  main: '/ai-workspace',
} as const;

/**
 * Dashboard routes
 */
export const DASHBOARD_ROUTES = {
  main: '/dashboard',
} as const;

/**
 * Auth routes
 */
export const AUTH_ROUTES = {
  login: '/sign-in',
  signup: '/sign-up',
} as const;

/**
 * Synapse routes (tenant=1 기준 E2E smoke)
 * @see docs/reference/SYNAPSEX_CONTRACT_AND_VERIFICATION_SPEC.md
 */
export const SYNAPSE_ROUTES = {
  root: '/synapse',
  admin: '/synapse/admin',
  cases: '/synapse/cases',
  caseDetail: (id: string) => `/synapse/cases/${id}`,
  anomalies: '/synapse/anomalies',
  optimization: '/synapse/optimization',
  actions: '/synapse/actions',
  archive: '/synapse/archive',
  documents: '/synapse/documents',
  openItems: '/synapse/open-items',
  entities: '/synapse/entities',
  entityDetail: (id: string) => `/synapse/entities/${id}`,
  lineage: '/synapse/lineage',
  lineageWithCase: (caseId: string) => `/synapse/lineage?caseId=${caseId}`,
  rag: '/synapse/rag',
  policies: '/synapse/policies',
  guardrails: '/synapse/guardrails',
  dictionary: '/synapse/dictionary',
  feedback: '/synapse/feedback',
  reconciliation: '/synapse/reconciliation',
  actionRecon: '/synapse/action-recon',
  audit: '/synapse/audit',
  analytics: '/synapse/analytics',
} as const;
