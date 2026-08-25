export const PRODUCT_SCOPE_KINDS = [
  'TENANT',
  'SELF',
  'TEAM',
  'ORG_UNIT',
  'LEGAL_ENTITY',
  'DOMAIN',
  'RESOURCE_SET',
  'RESOURCE',
  'POLICY_NODE',
  'TARGET_POPULATION',
  'SUPPORT_SESSION',
] as const;

export type ProductScopeKind = (typeof PRODUCT_SCOPE_KINDS)[number];

const PRODUCT_SCOPE_KIND_SET: ReadonlySet<string> = new Set(PRODUCT_SCOPE_KINDS);

export function isProductScopeKind(value: string): value is ProductScopeKind {
  return PRODUCT_SCOPE_KIND_SET.has(value);
}
