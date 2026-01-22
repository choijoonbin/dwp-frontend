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
