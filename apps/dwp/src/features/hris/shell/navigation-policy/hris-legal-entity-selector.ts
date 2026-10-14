export const HRIS_LEGAL_ENTITY_SELECTOR_PARAM = 'legalEntityPublicId' as const;

export type HrisLegalEntitySelector = Readonly<{
  state: 'TENANT' | 'LEGAL_ENTITY' | 'INVALID';
  legalEntityPublicId: string | null;
}>;

const LEGAL_ENTITY_PUBLIC_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * Reads the browser's requested legal-entity selector. The result is never proof of scope: the
 * People owner must resolve it again against the authenticated context before using it.
 */
export function selectHrisLegalEntitySelector(
  searchParams: URLSearchParams
): HrisLegalEntitySelector {
  const values = searchParams.getAll(HRIS_LEGAL_ENTITY_SELECTOR_PARAM);
  if (values.length === 0) return { state: 'TENANT', legalEntityPublicId: null };
  const candidate = values[0] ?? '';
  if (
    values.length !== 1 ||
    candidate !== candidate.trim() ||
    !isHrisLegalEntityPublicId(candidate)
  ) {
    return { state: 'INVALID', legalEntityPublicId: null };
  }
  return { state: 'LEGAL_ENTITY', legalEntityPublicId: candidate.toLowerCase() };
}

export function replaceHrisLegalEntitySelector(
  searchParams: URLSearchParams,
  scopeKind: 'TENANT' | 'LEGAL_ENTITY',
  legalEntityPublicId?: string | null
) {
  const next = new URLSearchParams(searchParams);
  next.delete(HRIS_LEGAL_ENTITY_SELECTOR_PARAM);
  if (scopeKind === 'TENANT') return next;

  const candidate = legalEntityPublicId?.trim() ?? '';
  if (!isHrisLegalEntityPublicId(candidate)) {
    throw new Error('A valid legal-entity public ID is required.');
  }
  next.set(HRIS_LEGAL_ENTITY_SELECTOR_PARAM, candidate.toLowerCase());
  return next;
}

export function isHrisLegalEntityPublicId(value: string) {
  return LEGAL_ENTITY_PUBLIC_ID_PATTERN.test(value);
}
