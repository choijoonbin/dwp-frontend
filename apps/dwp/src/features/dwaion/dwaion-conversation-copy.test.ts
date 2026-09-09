import { describe, expect, it } from 'vitest';

import { conversationAnswerStatus, conversationAnswerSummary } from './dwaion-conversation-copy';

describe('conversation answer status copy', () => {
  it.each([
    ['SELECTED_WORK_STALE', '최신 업무 확인 필요'],
    ['SELECTED_WORK_UNAVAILABLE', '선택 업무 확인 불가'],
    ['SELECTED_WORK_AUTHORIZATION_REQUIRED', '접근 권한 확인 필요'],
    ['ASK_POLICY_HANDOFF', '전문 절차 인계 필요'],
    ['CONTEXT_SOURCE_UNAVAILABLE', '근거 소스 일시 장애'],
    ['NO_GROUNDED_SOURCE', '확인 가능한 근거 없음'],
    ['EVIDENCE_INSUFFICIENT', '근거 부족으로 답변 보류'],
    ['PROMPT_INJECTION_BLOCKED', '안전하지 않은 지시 차단'],
    ['MUTATION_REQUIRES_GOVERNED_WORKFLOW', '업무 변경 검토 필요'],
    ['MODEL_CITATION_OUT_OF_SCOPE', '인용 범위 검증 실패'],
    ['ASK_RUNTIME_FAILED', '질문 처리 실패'],
    ['ASK_STREAM_TIMEOUT', '실시간 답변 시간 초과'],
  ])('maps %s to a user-facing Korean label', (status, label) => {
    expect(conversationAnswerStatus(status, 'ko')?.label).toBe(label);
    expect(conversationAnswerSummary(status, status, 'ko')).not.toContain(status);
  });

  it('keeps a real answer excerpt when it is not an internal status token', () => {
    const summary = '실제 답변 요약은 그대로 표시합니다.';

    expect(conversationAnswerSummary(summary, 'SELECTED_WORK_STALE', 'ko')).toBe(summary);
  });

  it('does not invent copy for an unknown server status', () => {
    expect(conversationAnswerStatus('FUTURE_STATUS', 'ko')).toBeNull();
    expect(conversationAnswerSummary('FUTURE_STATUS', 'FUTURE_STATUS', 'ko')).toBe(
      '저장된 처리 상태의 상세 설명을 현재 화면에서 확인할 수 없습니다.'
    );
  });
});
