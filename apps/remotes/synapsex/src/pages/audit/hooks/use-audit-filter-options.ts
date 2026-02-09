/**
 * 감사추적로그 필터 옵션 — 코드 API 바인딩
 * AUDIT_CATEGORY, AUDIT_EVENT_TYPE, AUDIT_OUTCOME, AUDIT_ACTOR_TYPE
 * BE 미제공 시 하드코딩 fallback
 */

import { useMemo } from 'react';
import { useCodes } from '@dwp-frontend/shared-utils';
import { useTranslation } from '@dwp-frontend/shared-i18n';

const FALLBACK_CATEGORY: { value: string; labelKey: string }[] = [
  { value: '', labelKey: 'audit.allCategories' },
  { value: 'CASE', labelKey: 'audit.categories.CASE' },
  { value: 'ACTION', labelKey: 'audit.categories.ACTION' },
  { value: 'AUDIT', labelKey: 'audit.categories.AUDIT' },
  { value: 'RUN', labelKey: 'audit.categories.RUN' },
  { value: 'ADMIN', labelKey: 'audit.categories.ADMIN' },
  { value: 'INTEGRATION', labelKey: 'audit.categories.INTEGRATION' },
  { value: 'POLICY', labelKey: 'audit.categories.POLICY' },
  { value: 'GUARDRAIL', labelKey: 'audit.categories.GUARDRAIL' },
];

const FALLBACK_EVENT_TYPE: { value: string; labelKey: string }[] = [
  { value: '', labelKey: 'audit.allTypes' },
  { value: 'action_approved', labelKey: 'audit.eventTypes.action_approved' },
  { value: 'action_rejected', labelKey: 'audit.eventTypes.action_rejected' },
  { value: 'action_executed', labelKey: 'audit.eventTypes.action_executed' },
  { value: 'case_created', labelKey: 'audit.eventTypes.case_created' },
  { value: 'simulation_run', labelKey: 'audit.eventTypes.simulation_run' },
  { value: 'comment_added', labelKey: 'audit.eventTypes.comment_added' },
];

const FALLBACK_OUTCOME: { value: string; labelKey: string }[] = [
  { value: '', labelKey: 'audit.allOutcomes' },
  { value: 'SUCCESS', labelKey: 'audit.outcomes.SUCCESS' },
  { value: 'FAILED', labelKey: 'audit.outcomes.FAILED' },
  { value: 'DENIED', labelKey: 'audit.outcomes.DENIED' },
  { value: 'NOOP', labelKey: 'audit.outcomes.NOOP' },
];

const FALLBACK_ACTOR_TYPE: { value: string; labelKey: string }[] = [
  { value: '', labelKey: 'audit.actorTypes.""' },
  { value: 'HUMAN', labelKey: 'audit.actorTypes.HUMAN' },
  { value: 'AGENT', labelKey: 'audit.actorTypes.AGENT' },
  { value: 'SYSTEM', labelKey: 'audit.actorTypes.SYSTEM' },
];

function codeMapToOptions(
  codeMap: Map<string, string>,
  allLabel: string
): { value: string; label: string }[] {
  if (codeMap.size === 0) return [];
  const items = Array.from(codeMap.entries())
    .filter(([k]) => k.trim())
    .map(([value, label]) => ({ value, label: label || value }));
  return [{ value: '', label: allLabel }, ...items];
}

export type AuditFilterOptions = {
  categoryOptions: { value: string; label: string }[];
  eventTypeOptions: { value: string; label: string }[];
  outcomeOptions: { value: string; label: string }[];
  actorTypeOptions: { value: string; label: string }[];
  isLoading: boolean;
};

export const useAuditFilterOptions = (): AuditFilterOptions => {
  const { t } = useTranslation('common');
  const categoryCodes = useCodes('AUDIT_CATEGORY');
  const eventTypeCodes = useCodes('AUDIT_EVENT_TYPE');
  const outcomeCodes = useCodes('AUDIT_OUTCOME');
  const actorTypeCodes = useCodes('AUDIT_ACTOR_TYPE');

  const categoryOptions = useMemo(() => {
    const fromApi = codeMapToOptions(
      categoryCodes.codeMap,
      t('audit.allCategories')
    );
    return fromApi.length > 0 ? fromApi : FALLBACK_CATEGORY.map((o) => ({ value: o.value, label: t(o.labelKey) }));
  }, [categoryCodes.codeMap, t]);

  const eventTypeOptions = useMemo(() => {
    const fromApi = codeMapToOptions(eventTypeCodes.codeMap, t('audit.allTypes'));
    return fromApi.length > 0 ? fromApi : FALLBACK_EVENT_TYPE.map((o) => ({ value: o.value, label: t(o.labelKey) }));
  }, [eventTypeCodes.codeMap, t]);

  const outcomeOptions = useMemo(() => {
    const fromApi = codeMapToOptions(
      outcomeCodes.codeMap,
      t('audit.allOutcomes')
    );
    return fromApi.length > 0 ? fromApi : FALLBACK_OUTCOME.map((o) => ({ value: o.value, label: t(o.labelKey) }));
  }, [outcomeCodes.codeMap, t]);

  const actorTypeOptions = useMemo(() => {
    const fromApi = codeMapToOptions(
      actorTypeCodes.codeMap,
      t('audit.actorTypes.""')
    );
    return fromApi.length > 0 ? fromApi : FALLBACK_ACTOR_TYPE.map((o) => ({ value: o.value, label: t(o.labelKey) }));
  }, [actorTypeCodes.codeMap, t]);

  const isLoading =
    categoryCodes.isLoading ||
    eventTypeCodes.isLoading ||
    outcomeCodes.isLoading ||
    actorTypeCodes.isLoading;

  return {
    categoryOptions,
    eventTypeOptions,
    outcomeOptions,
    actorTypeOptions,
    isLoading,
  };
};
