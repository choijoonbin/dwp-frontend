import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import type { ApprovalInsight } from '@dwp-frontend/shared-utils';

export function approvalInsightFallback(
  insight: Pick<ApprovalInsight, 'titleKo' | 'titleEn' | 'detailKo' | 'detailEn'>,
  language: string | undefined
) {
  const korean = resolveSupportedLocale(language) === 'ko';
  return korean
    ? { title: insight.titleKo, detail: insight.detailKo }
    : { title: insight.titleEn, detail: insight.detailEn };
}
