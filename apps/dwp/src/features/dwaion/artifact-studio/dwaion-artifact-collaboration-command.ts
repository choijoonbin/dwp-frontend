import { newDwaionArtifactCollaborationCommandId } from '@dwp-frontend/shared-utils';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';
import type { DwaionArtifactDocument } from './dwaion-artifact-model';

export function collaborationPreflightSources(sources: DwaionArtifactDocument['sources']) {
  return [...sources];
}

export function collaborationCommandId(attempts: Map<string, string>, key: string) {
  const current = attempts.get(key);
  if (current) return current;
  const created = newDwaionArtifactCollaborationCommandId();
  attempts.set(key, created);
  return created;
}

export function collaborationAttemptKey(operation: string, ...values: unknown[]) {
  return `${operation}:${JSON.stringify(values)}`;
}

export function clearCollaborationAttempts(attempts: Map<string, string>, operation: string) {
  for (const key of attempts.keys()) if (key.startsWith(`${operation}:`)) attempts.delete(key);
}

export function collaborationCommand(
  commandId: string,
  expectedRevision: number,
  reasonCode: string,
  authority: ProductSurfaceGovernedMutationAuthority
) {
  return { commandId, expectedRevision, reasonCode, authority };
}

export function collaborationHighRiskCommand(
  commandId: string,
  expectedRevision: number,
  reasonCode: string,
  changeReason: string,
  authority: ProductSurfaceGovernedMutationAuthority
) {
  return {
    ...collaborationCommand(commandId, expectedRevision, reasonCode, authority),
    changeReason,
  };
}

export function collaborationReason(
  locale: 'ko' | 'en',
  action:
    | 'workspace'
    | 'members'
    | 'conflict'
    | 'share'
    | 'revoke'
    | 'accessRequest'
    | 'resubmit'
    | 'commentResolution'
    | 'reviewDecision'
) {
  const reasons = {
    ko: {
      workspace: '사용자가 팀 작업공간 생성과 권한 범위를 확인했습니다.',
      members: '사용자가 최신 사전검사 결과로 팀 권한 변경을 확인했습니다.',
      conflict: '사용자가 충돌 내용과 선택한 복구 방식을 확인했습니다.',
      share: '사용자가 내부 공유 대상, 권한, 만료 시점을 확인했습니다.',
      revoke: '사용자가 활성 공유의 해지와 영향 범위를 확인했습니다.',
      accessRequest: '사용자가 거부된 수신자와 출처를 검토하고 접근 권한 요청을 확인했습니다.',
      resubmit: '사용자가 최신 권한 사전검사, 팀 작업공간 생성, 만료형 내부 공유를 확인했습니다.',
      commentResolution: '사용자가 댓글 내용과 답글을 검토하고 해결 처리를 확인했습니다.',
      reviewDecision: '할당된 검토자가 4대 거버넌스 게이트와 문서 내용을 확인했습니다.',
    },
    en: {
      workspace: 'The user confirmed the team workspace and authorization scope.',
      members: 'The user confirmed the member update from the latest preflight.',
      conflict: 'The user reviewed the conflict and selected recovery action.',
      share: 'The user confirmed the internal recipients, permission, and expiry.',
      revoke: 'The user confirmed revocation of the active internal share.',
      accessRequest:
        'The user reviewed denied recipients and sources and confirmed the access request.',
      resubmit:
        'The user confirmed the renewed authorization preflight, team workspace, and expiring internal share.',
      commentResolution: 'The user reviewed the comment thread and confirmed its resolution.',
      reviewDecision: 'The assigned reviewer verified the four governance gates and document content.',
    },
  } as const;
  return reasons[locale][action];
}
