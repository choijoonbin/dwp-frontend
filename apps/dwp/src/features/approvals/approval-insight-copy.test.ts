import { describe, expect, it } from 'vitest';

import approvalsEn from '../../../../../libs/shared-i18n/src/locales/en/approvals.json';
import approvalsKo from '../../../../../libs/shared-i18n/src/locales/ko/approvals.json';

import { approvalInsightFallback } from './approval-insight-copy';

const insight = {
  titleKo: '한국어 제목',
  titleEn: 'English title',
  detailKo: '한국어 설명',
  detailEn: 'English detail',
};

describe('approval insight copy', () => {
  it('uses the API locale pair as a safe fallback for unknown dynamic insight keys', () => {
    expect(approvalInsightFallback(insight, 'ko-KR')).toEqual({
      title: '한국어 제목',
      detail: '한국어 설명',
    });
    expect(approvalInsightFallback(insight, 'en-US')).toEqual({
      title: 'English title',
      detail: 'English detail',
    });
  });

  it('keeps the canonical SLA risk insight translated in both supported locales', () => {
    for (const locale of [approvalsKo, approvalsEn]) {
      expect(locale.insights['approval-sla-risk'].title.trim()).not.toBe('');
      expect(locale.insights['approval-sla-risk'].detail.trim()).not.toBe('');
      expect(locale.status.PILOT.trim()).not.toBe('');
    }
  });
});
