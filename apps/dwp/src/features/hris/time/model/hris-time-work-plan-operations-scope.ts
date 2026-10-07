import { Temporal } from 'temporal-polyfill';

import type { ProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';
import type { WorkPlanStudioScope } from '../api/hris-time-work-plan-api';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/u;

function validOpaqueScopeValue(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 500 &&
    value === value.trim() &&
    ![...value].some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f);
    })
  );
}

export function isWorkPlanEffectiveDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_ONLY.test(value)) return false;
  try {
    return Temporal.PlainDate.from(value).toString() === value;
  } catch {
    return false;
  }
}

export function workPlanOperationsToday(
  timeZone: string,
  now: string = Temporal.Now.instant().toString()
): string {
  try {
    return Temporal.Instant.from(now).toZonedDateTimeISO(timeZone).toPlainDate().toString();
  } catch {
    return Temporal.Now.plainDateISO().toString();
  }
}

export function resolveWorkPlanOperationsEffectiveOn(
  candidate: string | null | undefined,
  currentDate: string
): string {
  return isWorkPlanEffectiveDate(candidate) ? candidate : currentDate;
}

/**
 * A work-plan catalog has no safe legacy fallback: both the tenant scope and the exact PAGE
 * decision revision participate in its identity. Returning null guarantees a caller cannot
 * accidentally issue an unscoped owner request while the product surface is still resolving.
 */
export function resolveHrisTimeWorkPlanOperationsScope(
  requestScope: ProductSurfaceRequestScope,
  effectiveOn: string
): WorkPlanStudioScope | null {
  const scopeKey = requestScope.contextScopeKey;
  const decisionRevision = requestScope.queryMeta.decisionRevision;
  const [_tenantId, _actorId, _accessMode, cacheSurfaceKey, cacheScopeKey, cacheDecisionRevision] =
    requestScope.cacheKey;

  if (
    requestScope.governed !== true ||
    requestScope.ready !== true ||
    requestScope.queryMeta.productId !== 'hcm' ||
    requestScope.queryMeta.surfaceId !== 'hcm.operations' ||
    requestScope.queryMeta.contextScopeKey !== scopeKey ||
    !validOpaqueScopeValue(scopeKey) ||
    !validOpaqueScopeValue(decisionRevision) ||
    cacheSurfaceKey !== 'hcm.operations' ||
    cacheScopeKey !== scopeKey ||
    cacheDecisionRevision !== decisionRevision ||
    !isWorkPlanEffectiveDate(effectiveOn)
  ) {
    return null;
  }

  return Object.freeze({
    ready: true,
    scopeKey,
    decisionRevision,
    effectiveOn,
  });
}
