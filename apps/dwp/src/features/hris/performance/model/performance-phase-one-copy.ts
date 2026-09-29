import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import type {
  PerformanceGoalDraftValidation,
  PerformanceGoalSaveFailure,
} from './performance-goal-model';

export type PerformancePhaseOneCopy = Readonly<{
  scopeEyebrow: string;
  scopeTitle: string;
  scopeDescription: string;
  employeeContext: string;
  organizationFallback: string;
  editProgress: string;
  readOnlyGoal: string;
  sourceUnknownTitle: string;
  sourceUnknownDescription: string;
  staleDataTitle: string;
  staleDataDescription: string;
  retryRead: string;
  loadLatest: string;
  draftPreserved: string;
  saveFailure: Readonly<Record<PerformanceGoalSaveFailure, string>>;
  validation: Readonly<Record<PerformanceGoalDraftValidation, string>>;
}>;

const COPY: Readonly<Record<'ko' | 'en', PerformancePhaseOneCopy>> = {
  ko: {
    scopeEyebrow: 'PER · 개인 성과',
    scopeTitle: '내 목표 진행관리',
    scopeDescription:
      '내게 배정된 목표의 진행률을 기록합니다. 평가, 등급, 보상 결정은 이 1차 화면의 범위가 아닙니다.',
    employeeContext: '현재 직원',
    organizationFallback: '조직 정보 없음',
    editProgress: '진행률 수정',
    readOnlyGoal: '읽기 전용 목표',
    sourceUnknownTitle: '데이터 출처 확인 필요',
    sourceUnknownDescription:
      '현재 Talent API는 원천 데이터와 참조 데이터를 구분하는 메타데이터를 제공하지 않습니다. 표시된 값을 원천 확정값으로 간주하지 마세요.',
    staleDataTitle: '최신 데이터를 불러오지 못했습니다',
    staleDataDescription:
      '화면에는 마지막으로 확인된 값을 유지했습니다. 변경 전에 연결 상태를 확인하고 다시 불러오세요.',
    retryRead: '다시 불러오기',
    loadLatest: '최신 값 불러오기',
    draftPreserved: '입력한 진행률은 이 창에 보존됩니다.',
    saveFailure: {
      CONFLICT:
        '다른 변경이 먼저 저장되었습니다. 최신 값을 불러온 뒤 보존된 초안을 다시 확인하세요.',
      FORBIDDEN: '변경 권한을 확인할 수 없습니다. 초안은 보존되지만 저장할 수 없습니다.',
      NOT_FOUND: '이 목표를 더 이상 찾을 수 없습니다. 초안은 보존됩니다.',
      LOCKED: '최신 목표가 진행률 수정 가능 상태가 아니어서 더 이상 수정할 수 없습니다.',
      UNAVAILABLE: '저장 서비스에 연결할 수 없습니다. 초안은 보존되었으니 다시 시도하세요.',
      UNKNOWN: '목표를 저장하지 못했습니다. 초안은 보존되었으니 다시 시도하세요.',
    },
    validation: {
      READY: '',
      UNCHANGED: '변경된 내용이 없습니다.',
      NOT_EDITABLE: '활성 또는 위험 상태가 아닌 목표는 이 화면에서 수정할 수 없습니다.',
      LATEST_VERSION_REQUIRED: '저장하기 전에 최신 목표 값을 불러와야 합니다.',
      FORBIDDEN: '현재 권한으로는 이 목표를 저장할 수 없습니다.',
    },
  },
  en: {
    scopeEyebrow: 'PER · Personal performance',
    scopeTitle: 'My goal progress',
    scopeDescription:
      'Record progress for goals assigned to you. Ratings, review cycles, and compensation decisions are outside this Phase 1 surface.',
    employeeContext: 'Current employee',
    organizationFallback: 'Organization unavailable',
    editProgress: 'Edit progress',
    readOnlyGoal: 'Read-only goal',
    sourceUnknownTitle: 'Data provenance is not available',
    sourceUnknownDescription:
      'The current Talent API does not distinguish source data from reference data. Do not treat these values as source-confirmed.',
    staleDataTitle: 'Latest data could not be loaded',
    staleDataDescription:
      'The last confirmed values remain visible. Check connectivity and reload before making a change.',
    retryRead: 'Reload',
    loadLatest: 'Load latest values',
    draftPreserved: 'Your progress is preserved in this dialog.',
    saveFailure: {
      CONFLICT:
        'Another change was saved first. Load the latest values, then review your preserved draft.',
      FORBIDDEN:
        'Your update permission could not be confirmed. The draft is preserved but cannot be saved.',
      NOT_FOUND: 'This goal can no longer be found. Your draft is preserved.',
      LOCKED: 'The latest goal is not in a progress-editable state and can no longer be edited.',
      UNAVAILABLE: 'The save service is unavailable. Your draft is preserved; try again.',
      UNKNOWN: 'The goal could not be saved. Your draft is preserved; try again.',
    },
    validation: {
      READY: '',
      UNCHANGED: 'There are no changes to save.',
      NOT_EDITABLE: 'Only active or at-risk goals can be edited on this surface.',
      LATEST_VERSION_REQUIRED: 'Load the latest goal values before saving.',
      FORBIDDEN: 'Your current access does not allow this goal to be saved.',
    },
  },
};

export function getPerformancePhaseOneCopy(...languages: Array<string | null | undefined>) {
  return COPY[resolveSupportedLocale(...languages)];
}

export function performanceGoalFailureMessage(
  copy: PerformancePhaseOneCopy,
  failure: PerformanceGoalSaveFailure
): string {
  return copy.saveFailure[failure];
}

export function performanceGoalValidationMessage(
  copy: PerformancePhaseOneCopy,
  validation: PerformanceGoalDraftValidation
): string {
  return copy.validation[validation];
}
