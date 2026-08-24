import type { ApprovalInsight } from '@dwp-frontend/shared-utils';

export function approvalInsightFallback(
  insight: Pick<ApprovalInsight, 'titleKo' | 'titleEn' | 'detailKo' | 'detailEn'>,
  language: string | undefined
) {
  const korean = language?.startsWith('ko') ?? false;
  return korean
    ? { title: insight.titleKo, detail: insight.detailKo }
    : { title: insight.titleEn, detail: insight.detailEn };
}
