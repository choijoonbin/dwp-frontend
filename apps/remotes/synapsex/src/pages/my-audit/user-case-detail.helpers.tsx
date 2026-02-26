import type { ReactNode } from 'react';

export type UserInfoLike = {
  id?: string | number;
  userId?: string | number;
  roles?: string[];
  [key: string]: unknown;
};

type StatusMeta = {
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'default';
  label: string;
  guide: string;
};

export const STATUS_META: Record<string, StatusMeta> = {
  ANALYZING: {
    color: 'primary',
    label: 'AI 분석 중',
    guide: 'AI가 전표를 분석 중입니다. 잠시만 기다려주세요.',
  },
  PENDING_EXPLANATION: {
    color: 'warning',
    label: '소명 필요',
    guide: '감사관이 소명을 요청했습니다. 내용을 입력해 주세요.',
  },
  IN_REVIEW: {
    color: 'info',
    label: '검토 중',
    guide: '소명이 제출되어 검토 중입니다. (수정 불가)',
  },
  RESOLVED: {
    color: 'success',
    label: '종결(해결)',
    guide: '감사가 종료되었습니다.',
  },
  IGNORED: {
    color: 'default',
    label: '종결(제외)',
    guide: '감사가 종료되었습니다.',
  },
  PENDING_APPROVAL: {
    color: 'secondary',
    label: '결재 대기',
    guide: '관리자 승인 절차가 진행 중입니다.',
  },
  NEW: {
    color: 'secondary',
    label: '분석 완료',
    guide: 'AI 분석이 완료되어 감사관의 최초 확인을 기다리고 있습니다.',
  },
};

const REGULATION_REGEX = /(제\s*\d+\s*조(?:\s*제\s*\d+\s*항)?)/g;

export const toUpperStatus = (status: unknown): string =>
  typeof status === 'string' && status.trim() ? status.trim().toUpperCase() : 'NEW';

const normalizeId = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return null;
};

export const extractMyUserId = (me: UserInfoLike | null | undefined): string | null =>
  normalizeId(me?.userId ?? me?.id);

export const extractRoles = (me: UserInfoLike | null | undefined): string[] => {
  if (!Array.isArray(me?.roles)) return [];
  return me.roles.filter((role): role is string => typeof role === 'string');
};

export const extractCaseOwnerId = (dto: Record<string, unknown> | null | undefined): string | null =>
  normalizeId(
    dto?.user_id ??
      dto?.userId ??
      dto?.owner_user_id ??
      dto?.ownerUserId ??
      dto?.created_by ??
      dto?.createdBy
  );

export const extractExistingExplanation = (dto: Record<string, unknown> | null | undefined): string => {
  const explanationHistory = dto?.explanationHistory;
  if (Array.isArray(explanationHistory) && explanationHistory.length > 0) {
    const latest = [...explanationHistory]
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .sort((a, b) => {
        const aTime = new Date(String(a.createdAt ?? '')).getTime();
        const bTime = new Date(String(b.createdAt ?? '')).getTime();
        return bTime - aTime;
      })[0];
    const historyText = latest?.explanationText;
    if (typeof historyText === 'string' && historyText.trim()) return historyText;
  }

  const directCandidates = [
    dto?.explanation_text,
    dto?.explanationText,
    (dto?.explanation as Record<string, unknown> | undefined)?.explanation_text,
    (dto?.explanation as Record<string, unknown> | undefined)?.explanationText,
    (dto?.explanation as Record<string, unknown> | undefined)?.content,
  ];
  for (const candidate of directCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }

  const explanations = dto?.explanations;
  if (Array.isArray(explanations) && explanations.length > 0) {
    for (const item of explanations) {
      if (!item || typeof item !== 'object') continue;
      const record = item as Record<string, unknown>;
      const fromList = [record.explanation_text, record.explanationText, record.content].find(
        (value) => typeof value === 'string' && value.trim()
      );
      if (typeof fromList === 'string') return fromList;
    }
  }

  return '';
};

export const extractReasonText = (dto: Record<string, unknown> | null | undefined): string => {
  const reasoning = dto?.reasoning as Record<string, unknown> | undefined;
  const candidates = [reasoning?.reasonText, dto?.reasonText, dto?.reason_text, dto?.reasoningText];
  const found = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim());
  return typeof found === 'string' ? found : '';
};

export const highlightRegulations = (text: string): ReactNode => {
  if (!text.trim()) return '-';
  const parts = text.split(REGULATION_REGEX);
  const clausePattern = /(제\s*\d+\s*조(?:\s*제\s*\d+\s*항)?)/;
  return (
    <>
      {parts.map((part, idx) => {
        if (!part) return null;
        return clausePattern.test(part) ? (
          <strong key={`${part}-${idx}`}>{part}</strong>
        ) : (
          <span key={`${part}-${idx}`}>{part}</span>
        );
      })}
    </>
  );
};
