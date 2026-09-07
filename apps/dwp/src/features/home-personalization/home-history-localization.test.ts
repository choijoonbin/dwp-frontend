import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import { homeRevisionSourceLabel, homeRevisionSummaryLabel } from './home-history-localization';

const koreanCopy: Readonly<Record<string, string>> = {
  'history.sources.USER': '직접 변경',
  'history.sources.TEMPLATE': '템플릿 적용',
  'history.sources.AI': 'AI 제안',
  'history.sources.RESTORE': '버전 복원',
  'history.sources.UNDO': '되돌리기',
  'history.sources.UNKNOWN': '홈 변경',
  'history.summaries.created': '홈을 만들었습니다.',
  'history.summaries.updated': '홈 구성을 변경했습니다.',
  'history.summaries.reset': '조직 기본값으로 초기화했습니다.',
  'history.summaries.aiApplied': 'AI 제안을 적용했습니다.',
  'history.summaries.aiUndone': 'AI 제안을 되돌렸습니다.',
  'history.summaries.deviceUpdated': '{{device}} 레이아웃을 변경했습니다.',
  'history.summaries.revisionRestored': '{{number}}번 버전을 복원했습니다.',
  'history.summaries.templateApplied': '템플릿을 적용했습니다.',
  'history.summaries.widgetUpdated': '{{widget}} 콘텐츠 설정을 변경했습니다.',
  'history.summaries.fallback': '홈 구성을 변경했습니다.',
  'history.widgetFallback': '위젯',
  'device.desktop': '데스크톱',
  'device.mobile': '모바일',
  'content.widgetLabels.activity': '최근 활동',
  'content.widgetLabels.daily-brief': '다음 행동',
  'content.widgetLabels.focus-balance': '집중 시간',
  'content.widgetLabels.meeting-load': '회의 부하',
};

const t = ((key: string, options?: Record<string, unknown>) => {
  let result = koreanCopy[key] ?? key;
  for (const [name, value] of Object.entries(options ?? {})) {
    result = result.replaceAll(`{{${name}}}`, String(value));
  }
  return result;
}) as TFunction<'homeStudio'>;

describe('home history localization', () => {
  it('turns protocol source values and fixed server summaries into Korean product copy', () => {
    expect(homeRevisionSourceLabel(t, 'USER')).toBe('직접 변경');
    expect(homeRevisionSummaryLabel(t, 'Home view updated')).toBe('홈 구성을 변경했습니다.');
    expect(homeRevisionSummaryLabel(t, 'Approved composer proposal applied')).toBe(
      'AI 제안을 적용했습니다.'
    );
  });

  it('localizes structured device, widget, and restore summaries', () => {
    expect(homeRevisionSummaryLabel(t, 'MOBILE device overlay updated')).toBe(
      '모바일 레이아웃을 변경했습니다.'
    );
    expect(homeRevisionSummaryLabel(t, 'daily-brief configuration updated')).toBe(
      '다음 행동 콘텐츠 설정을 변경했습니다.'
    );
    expect(homeRevisionSummaryLabel(t, 'meeting-load configuration updated')).toBe(
      '회의 부하 콘텐츠 설정을 변경했습니다.'
    );
    expect(homeRevisionSummaryLabel(t, 'Revision 12 restored')).toBe('12번 버전을 복원했습니다.');
  });

  it('does not expose unknown protocol or identifier values', () => {
    expect(homeRevisionSourceLabel(t, 'SYSTEM')).toBe('홈 변경');
    expect(homeRevisionSummaryLabel(t, 'internal-widget-v7 configuration updated')).toBe(
      '위젯 콘텐츠 설정을 변경했습니다.'
    );
    expect(homeRevisionSummaryLabel(t, 'Unexpected server-owned summary')).toBe(
      '홈 구성을 변경했습니다.'
    );
  });
});
