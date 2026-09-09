const KO = {
  manage: '대화 관리',
  rename: '이름 변경',
  remove: '삭제',
  renameTitle: '대화 이름 변경',
  titleLabel: '대화 제목',
  cancel: '취소',
  save: '저장',
  saving: '저장 중',
  titleLength: '제목은 앞뒤 공백을 제외하고 1~160자로 입력하세요.',
  renameError: '이름을 변경하지 못했습니다. 입력한 제목을 유지했습니다. 다시 저장해 주세요.',
  renameMissing: '대화가 없거나 현재 계정에서 더 이상 접근할 수 없습니다.',
  renameForbidden: '대화 이름을 변경할 권한이 없습니다. 현재 계정의 권한을 확인하세요.',
  renameConflict: '수정 충돌로 저장하지 못했습니다. 입력을 유지했습니다. 목록을 다시 확인하세요.',
  questionShort: '질문은 앞뒤 공백을 제외하고 2자 이상 입력하세요.',
  questionLong:
    '질문은 앞뒤 공백을 제외하고 4,000자까지 보낼 수 있습니다. 입력을 유지했습니다. 내용을 줄여 주세요.',
  questionCount: '보낼 질문 글자 수',
  due: '기한',
  archiveCount: '보관함 {{count}}건',
  mobileCount: '{{count}}',
  encryption: '엔터프라이즈 암호화',
  mobileScope: '내 권한 범위 대화 · 최근 {{count}}개 조회 중',
  findShortcut: '⌘F',
  compliance: '조직 보존 정책 및 법적 보존(Legal Hold) 규정 적용 중',
  securityStrip:
    '현재 최근 {{count}}개 대화 조회 기준입니다. PII 마스킹과 감사 정책은 대화를 열 때 다시 적용됩니다.',
  filteredCount: '조회된 대화 {{total}}개 중 {{count}}개 표시',
  listLabel: '보관된 대화 목록',
  saved: '저장된 대화',
  verified: '검증 완료',
  completed: '완료됨',
  groundedFallback: '근거 기반 대체 응답',
  latest: '최신 작업중',
  legalHoldShort: 'Legal Hold (삭제 불가)',
  deletionLocked: '법적 보존으로 삭제 불가',
  grounded: '근거 {{count}}건',
  permissionRecheck: '열 때 권한 재검증',
  sourceRecords: '참여 근거 {{count}}건',
  sourceOnOpen: '근거와 소스는 선택 시 확인',
  retentionGuide: '보존 안내',
  open: '대화 열기',
  continue: '이어서 대화하기',
  detailTitle: '대화 요약 및 근거 스냅샷',
  detailLoading: '선택한 대화의 검증된 기록을 불러오는 중입니다.',
  detailError: '이 대화의 상세 기록을 확인하지 못했습니다.',
  selectDetail: '목록에서 대화를 선택하면 검증된 기록과 근거를 확인할 수 있습니다.',
  snapshotLabel: '선택된 대화',
  agent: '담당 에이전트',
  sourceScope: '소스 연동 범위',
  verification: '답변 검증 기록',
  retention: '보존 상태',
  verifiedEvidence: '근거 {{count}}건 기록됨',
  noVerifiedEvidence: '기록된 인용 근거 없음',
  policyApplied: '조직 정책 적용 · 삭제 시 재확인',
  legalHoldActive: '법적 보존 적용 중',
  retainedUntil: '{{date}}까지 보존',
  evidenceTitle: '참여 근거 및 문서 출처 ({{count}})',
  noEvidence: '이 대화에 저장된 인용 근거가 없습니다.',
  openWorkspace: '해당 대화 작업면으로 열기',
  restoreNote: '대화 상태와 접근 권한을 다시 확인한 뒤 작업면을 복원합니다.',
  defaultAgent: 'DWAI·ON 업무 에이전트',
  defaultAgentShort: '일반 업무 길잡이',
  approvalAgent: '전자결재 전문 에이전트',
  approvalAgentShort: '결재 전문가',
  unknownAgent: '저장된 에이전트',
  sourceUnavailable: '저장된 소스 없음',
  privacyTitle: '데이터 파기 및 보안 원칙',
  privacyDescription:
    '대화 삭제 시 원본 업무 문서는 유지되며 대화 기록은 조직의 보존 및 법적 보존 정책에 따라 처리됩니다.',
  retentionTitle: '보존 규정 안내',
  retentionDescription:
    '대화는 조직 보존 정책의 적용을 받습니다. 법적 보존 대상이면 삭제 요청이 차단되고 그 결과를 즉시 안내합니다.',
};
const EN: typeof KO = {
  manage: 'Conversation actions',
  rename: 'Rename',
  remove: 'Delete',
  renameTitle: 'Rename conversation',
  titleLabel: 'Conversation title',
  cancel: 'Cancel',
  save: 'Save',
  saving: 'Saving',
  titleLength: 'Use 1–160 characters after trimming leading and trailing spaces.',
  renameError: 'The conversation could not be renamed. Your title is still here. Try saving again.',
  renameMissing: 'This conversation is missing or is no longer accessible to your account.',
  renameForbidden:
    'You do not have permission to rename this conversation. Check your current access.',
  renameConflict:
    'The conversation could not be saved because of a conflict. Your title is still here. Check the list again.',
  questionShort: 'Enter at least 2 characters after trimming leading and trailing spaces.',
  questionLong:
    'Questions can contain up to 4,000 characters after trimming leading and trailing spaces. Your input is still here. Shorten it to continue.',
  questionCount: 'Question characters to send',
  due: 'Due',
  archiveCount: '{{count}} archived',
  mobileCount: '{{count}}',
  encryption: 'Enterprise encryption',
  mobileScope: '{{count}} recent conversations in your access scope',
  findShortcut: '⌘F',
  compliance: 'Organization retention and legal-hold rules apply',
  securityStrip:
    'This view contains the {{count}} most recent conversations. PII masking and audit policy are checked again when a conversation opens.',
  filteredCount: 'Showing {{count}} of {{total}} retrieved conversations',
  listLabel: 'Archived conversations',
  saved: 'Saved conversation',
  verified: 'Verified',
  completed: 'Completed',
  groundedFallback: 'Grounded fallback answer',
  latest: 'Latest activity',
  legalHoldShort: 'Legal hold (cannot delete)',
  deletionLocked: 'Deletion blocked by legal hold',
  grounded: '{{count}} evidence',
  permissionRecheck: 'Access rechecked on open',
  sourceRecords: '{{count}} participating sources',
  sourceOnOpen: 'Select to inspect evidence and sources',
  retentionGuide: 'Retention details',
  open: 'Open conversation',
  continue: 'Continue conversation',
  detailTitle: 'Conversation summary and evidence snapshot',
  detailLoading: 'Loading the verified record for the selected conversation.',
  detailError: 'The selected conversation record could not be verified.',
  selectDetail: 'Select a conversation to inspect its verified record and evidence.',
  snapshotLabel: 'Selected conversation',
  agent: 'Assigned agent',
  sourceScope: 'Connected source scope',
  verification: 'Answer verification record',
  retention: 'Retention state',
  verifiedEvidence: '{{count}} evidence records saved',
  noVerifiedEvidence: 'No cited evidence was saved',
  policyApplied: 'Organization policy applies · checked on delete',
  legalHoldActive: 'Legal hold active',
  retainedUntil: 'Retained until {{date}}',
  evidenceTitle: 'Participating evidence and sources ({{count}})',
  noEvidence: 'No cited evidence is stored with this conversation.',
  openWorkspace: 'Open conversation workspace',
  restoreNote: 'The workspace restores after the conversation and current access are verified.',
  defaultAgent: 'DWAI·ON work agent',
  defaultAgentShort: 'Work agent',
  approvalAgent: 'Approval expert agent',
  approvalAgentShort: 'Approval expert',
  unknownAgent: 'Saved agent',
  sourceUnavailable: 'No saved sources',
  privacyTitle: 'Data deletion and security',
  privacyDescription:
    'Deleting a conversation leaves source work documents intact. The conversation record follows organization retention and legal-hold policy.',
  retentionTitle: 'Retention policy',
  retentionDescription:
    'Organization retention policy applies to conversations. A legal hold blocks deletion and the result is shown immediately.',
};
export function conversationCopy(locale: 'ko' | 'en') {
  return locale === 'ko' ? KO : EN;
}

type ConversationAnswerStatusPresentation = {
  label: string;
  description: string;
};

const ANSWER_STATUS_COPY: Record<
  'ko' | 'en',
  Record<string, ConversationAnswerStatusPresentation>
> = {
  ko: {
    ANSWER_GROUNDED: {
      label: '근거 확인 완료',
      description: '저장된 근거를 바탕으로 답변을 완료했습니다.',
    },
    ANSWER_GROUNDED_FALLBACK: {
      label: '제한된 근거로 답변',
      description: '확인 가능한 근거 범위에서 대체 답변을 저장했습니다.',
    },
    ANSWER_ABSTAINED: {
      label: '답변 보류',
      description: '확인된 근거만으로는 안전하게 답변할 수 없어 결과를 보류했습니다.',
    },
    READ_ONLY_GROUNDED_ANSWER: {
      label: '읽기 전용 근거 답변',
      description: '현재 권한의 검증된 근거만 사용한 읽기 전용 답변입니다.',
    },
    COMPLETED: { label: '답변 완료', description: '답변 처리가 완료되어 대화에 저장되었습니다.' },
    MODEL_PROVIDER_UNAVAILABLE: {
      label: 'AI 처리 일시 장애',
      description: 'AI 모델 연결을 사용할 수 없어 답변을 완료하지 못했습니다.',
    },
    MODEL_ROUTE_CONFIGURATION_REQUIRED: {
      label: 'AI 경로 설정 필요',
      description: '사용 가능한 AI 모델 경로가 설정되지 않아 답변을 완료하지 못했습니다.',
    },
    MODEL_OUTPUT_CONTRACT_INVALID: {
      label: '답변 검증 실패',
      description: 'AI 답변이 필수 검증 규칙을 통과하지 못해 저장하지 않았습니다.',
    },
    MODEL_OUTPUT_MISSING: {
      label: '답변 결과 없음',
      description: 'AI 처리에서 검증할 답변 결과가 생성되지 않았습니다.',
    },
    MODEL_REFUSED: {
      label: '답변 제한',
      description: '안전 및 정책 경계에 따라 AI가 해당 요청에 답변하지 않았습니다.',
    },
    ASK_PERMISSION_REQUIRED: {
      label: '질문 권한 필요',
      description: '이 질문을 처리하려면 현재 계정의 접근 권한을 다시 확인해야 합니다.',
    },
    ASK_POLICY_DENIED: {
      label: '조직 정책으로 차단',
      description: '조직의 AI 사용 정책이 해당 질문 처리를 허용하지 않았습니다.',
    },
    ASK_POLICY_HANDOFF: {
      label: '전문 절차 인계 필요',
      description: '조직 정책에 따라 이 질문은 승인된 전문 절차에서 이어서 처리해야 합니다.',
    },
    PROMPT_INJECTION_BLOCKED: {
      label: '안전하지 않은 지시 차단',
      description: '근거나 정책을 우회하려는 지시가 감지되어 질문 처리를 중단했습니다.',
    },
    MUTATION_REQUIRES_GOVERNED_WORKFLOW: {
      label: '업무 변경 검토 필요',
      description: '데이터를 변경하는 요청은 담당 업무 화면의 검토·확정 절차에서 진행해야 합니다.',
    },
    APPROVAL_EXPERT_PERMISSION_REQUIRED: {
      label: '결재 전문 권한 필요',
      description: '결재 전문 에이전트를 사용하려면 추가 접근 권한이 필요합니다.',
    },
    PRIVILEGED_DATA_HANDOFF: {
      label: '보호 데이터 인계 필요',
      description: '보호된 데이터가 포함되어 승인된 전문 절차로 인계해야 합니다.',
    },
    AGENT_REGISTRY_CONFIGURATION_REQUIRED: {
      label: '에이전트 설정 필요',
      description: '질문을 처리할 에이전트 설정이 준비되지 않았습니다.',
    },
    CONTEXT_BROKER_CONFIGURATION_REQUIRED: {
      label: '근거 연결 설정 필요',
      description: '질문의 근거를 검색할 연결 설정이 준비되지 않았습니다.',
    },
    CONTEXT_SOURCE_UNAVAILABLE: {
      label: '근거 소스 일시 장애',
      description: '선택한 근거 소스에 연결할 수 없어 답변을 완료하지 못했습니다.',
    },
    NO_GROUNDED_SOURCE: {
      label: '확인 가능한 근거 없음',
      description: '현재 권한과 검색 범위에서 답변에 사용할 근거를 찾지 못했습니다.',
    },
    EVIDENCE_INSUFFICIENT: {
      label: '근거 부족으로 답변 보류',
      description: '찾은 근거만으로는 안전하게 답변할 수 없어 결과를 보류했습니다.',
    },
    MODEL_CITATION_OUT_OF_SCOPE: {
      label: '인용 범위 검증 실패',
      description: '답변의 인용이 허용된 근거 범위를 벗어나 결과를 저장하지 않았습니다.',
    },
    MODEL_ANSWER_WITHOUT_CITATION: {
      label: '인용 누락으로 답변 보류',
      description: '답변에 필수 인용 근거가 없어 결과를 저장하지 않았습니다.',
    },
    MODEL_ANSWER_WITHOUT_CONFIDENCE: {
      label: '신뢰도 검증 실패',
      description: '답변에 필수 신뢰도 정보가 없어 결과를 저장하지 않았습니다.',
    },
    MODEL_ANSWER_WITH_ABSTENTION: {
      label: '답변 형식 검증 실패',
      description: '답변과 보류 상태가 함께 반환되어 안전 검증을 통과하지 못했습니다.',
    },
    MODEL_ABSTENTION_WITH_ANSWER_EVIDENCE: {
      label: '보류 근거 검증 실패',
      description: '보류된 결과에 답변용 근거가 포함되어 안전 검증을 통과하지 못했습니다.',
    },
    MODEL_ABSTENTION_REASON_REQUIRED: {
      label: '보류 사유 누락',
      description: '답변을 보류한 이유가 없어 안전 검증을 통과하지 못했습니다.',
    },
    ASK_RUNTIME_FAILED: {
      label: '질문 처리 실패',
      description: '질문 처리 중 오류가 발생했습니다. 입력과 원본 업무는 변경되지 않았습니다.',
    },
    ASK_STREAM_FAILED: {
      label: '실시간 답변 연결 실패',
      description: '실시간 답변 연결이 중단되어 결과를 완료하지 못했습니다.',
    },
    ASK_STREAM_TIMEOUT: {
      label: '실시간 답변 시간 초과',
      description: '제한 시간 안에 실시간 답변을 완료하지 못했습니다.',
    },
    AGENT_REGISTRY_UNAVAILABLE: {
      label: '에이전트 정보 일시 장애',
      description: '에이전트 설정을 확인할 수 없어 질문을 처리하지 못했습니다.',
    },
    AGENT_STORE_UNAVAILABLE: {
      label: '대화 저장소 일시 장애',
      description: '실행·대화 저장소에 연결할 수 없어 질문을 완료하지 못했습니다.',
    },
    SELECTED_WORK_STALE: {
      label: '최신 업무 확인 필요',
      description: '선택한 업무가 변경되어 최신 상태를 다시 확인해야 합니다.',
    },
    SELECTED_WORK_UNAVAILABLE: {
      label: '선택 업무 확인 불가',
      description: '선택한 업무 정보를 현재 불러올 수 없습니다. 원본 업무에서 상태를 확인하세요.',
    },
    SELECTED_WORK_AUTHORIZATION_REQUIRED: {
      label: '접근 권한 확인 필요',
      description: '선택한 업무를 조회할 수 있도록 현재 접근 권한을 다시 확인해야 합니다.',
    },
    SELECTED_WORK_FORBIDDEN: {
      label: '접근 권한 없음',
      description: '현재 계정으로 선택한 업무를 조회할 수 없습니다.',
    },
    SELECTED_WORK_NOT_FOUND: {
      label: '선택 업무를 찾을 수 없음',
      description: '선택한 업무가 삭제되었거나 더 이상 현재 범위에 없습니다.',
    },
    SELECTED_WORK_INVALID_SOURCE: {
      label: '업무 연결 재확인 필요',
      description: '저장된 업무 연결이 유효하지 않아 원본 업무를 다시 선택해야 합니다.',
    },
    SELECTED_WORK_RESTRICTED: {
      label: '제한된 업무',
      description: '조직 정책에 따라 선택한 업무의 AI 처리가 제한되었습니다.',
    },
    SELECTED_WORK_UNSUPPORTED: {
      label: '지원하지 않는 업무',
      description: '이 업무 유형은 현재 선택 업무 답변에서 지원되지 않습니다.',
    },
  },
  en: {
    ANSWER_GROUNDED: {
      label: 'Evidence verified',
      description: 'The answer was completed from the evidence saved with this conversation.',
    },
    ANSWER_GROUNDED_FALLBACK: {
      label: 'Answered with limited evidence',
      description: 'A fallback answer was saved from the evidence that could be verified.',
    },
    ANSWER_ABSTAINED: {
      label: 'Answer withheld',
      description: 'The verified evidence was not sufficient to answer safely.',
    },
    READ_ONLY_GROUNDED_ANSWER: {
      label: 'Read-only evidence answer',
      description: 'This read-only answer uses only evidence verified within your current access.',
    },
    COMPLETED: {
      label: 'Answer completed',
      description: 'Answer processing completed and was saved.',
    },
    MODEL_PROVIDER_UNAVAILABLE: {
      label: 'AI processing unavailable',
      description: 'The AI model connection was unavailable, so the answer could not be completed.',
    },
    MODEL_ROUTE_CONFIGURATION_REQUIRED: {
      label: 'AI route configuration needed',
      description: 'No available AI model route is configured for this request.',
    },
    MODEL_OUTPUT_CONTRACT_INVALID: {
      label: 'Answer validation failed',
      description: 'The AI output did not pass the required validation contract and was not saved.',
    },
    MODEL_OUTPUT_MISSING: {
      label: 'No answer result',
      description: 'AI processing did not produce an answer that could be validated.',
    },
    MODEL_REFUSED: {
      label: 'Answer restricted',
      description: 'The AI did not answer this request because of safety or policy boundaries.',
    },
    ASK_PERMISSION_REQUIRED: {
      label: 'Question access needed',
      description:
        'Your current access must be checked again before this question can be processed.',
    },
    ASK_POLICY_DENIED: {
      label: 'Blocked by organization policy',
      description: 'Your organization policy does not allow this question to be processed.',
    },
    ASK_POLICY_HANDOFF: {
      label: 'Specialist handoff needed',
      description:
        'Organization policy requires this question to continue in an approved specialist workflow.',
    },
    PROMPT_INJECTION_BLOCKED: {
      label: 'Unsafe instruction blocked',
      description:
        'Processing stopped because an instruction attempted to bypass evidence or policy controls.',
    },
    MUTATION_REQUIRES_GOVERNED_WORKFLOW: {
      label: 'Work change review needed',
      description:
        'Requests that change data must continue through review and confirmation in the owning app.',
    },
    APPROVAL_EXPERT_PERMISSION_REQUIRED: {
      label: 'Approval expert access needed',
      description: 'Additional access is required to use the approval expert agent.',
    },
    PRIVILEGED_DATA_HANDOFF: {
      label: 'Protected-data handoff needed',
      description: 'Protected data requires a handoff through an approved specialist workflow.',
    },
    AGENT_REGISTRY_CONFIGURATION_REQUIRED: {
      label: 'Agent configuration needed',
      description: 'An agent has not been configured to process this question.',
    },
    CONTEXT_BROKER_CONFIGURATION_REQUIRED: {
      label: 'Evidence connection needed',
      description: 'The evidence connection required for this question has not been configured.',
    },
    CONTEXT_SOURCE_UNAVAILABLE: {
      label: 'Evidence source unavailable',
      description:
        'The selected evidence source could not be reached, so the answer was not completed.',
    },
    NO_GROUNDED_SOURCE: {
      label: 'No verified evidence found',
      description: 'No evidence was found within your current access and search scope.',
    },
    EVIDENCE_INSUFFICIENT: {
      label: 'Answer withheld for insufficient evidence',
      description: 'The evidence found was not sufficient to answer safely.',
    },
    MODEL_CITATION_OUT_OF_SCOPE: {
      label: 'Citation scope validation failed',
      description: 'The answer cited evidence outside the allowed scope and was not saved.',
    },
    MODEL_ANSWER_WITHOUT_CITATION: {
      label: 'Answer withheld for missing citations',
      description: 'The answer did not include its required evidence citations and was not saved.',
    },
    MODEL_ANSWER_WITHOUT_CONFIDENCE: {
      label: 'Confidence validation failed',
      description: 'The answer did not include required confidence information and was not saved.',
    },
    MODEL_ANSWER_WITH_ABSTENTION: {
      label: 'Answer format validation failed',
      description:
        'The response included both an answer and an abstention state and failed safety validation.',
    },
    MODEL_ABSTENTION_WITH_ANSWER_EVIDENCE: {
      label: 'Abstention evidence validation failed',
      description: 'The withheld response included answer evidence and failed safety validation.',
    },
    MODEL_ABSTENTION_REASON_REQUIRED: {
      label: 'Abstention reason missing',
      description: 'The response did not explain why it was withheld and failed safety validation.',
    },
    ASK_RUNTIME_FAILED: {
      label: 'Question processing failed',
      description: 'An error interrupted processing. Your input and source work were not changed.',
    },
    ASK_STREAM_FAILED: {
      label: 'Live answer connection failed',
      description: 'The live answer connection ended before the result could be completed.',
    },
    ASK_STREAM_TIMEOUT: {
      label: 'Live answer timed out',
      description: 'The live answer did not complete within the allowed time.',
    },
    AGENT_REGISTRY_UNAVAILABLE: {
      label: 'Agent configuration unavailable',
      description:
        'The agent configuration could not be checked, so the question was not processed.',
    },
    AGENT_STORE_UNAVAILABLE: {
      label: 'Conversation store unavailable',
      description:
        'The run and conversation store could not be reached, so the question was not completed.',
    },
    SELECTED_WORK_STALE: {
      label: 'Latest work check needed',
      description: 'The selected work changed and its latest state must be checked again.',
    },
    SELECTED_WORK_UNAVAILABLE: {
      label: 'Selected work unavailable',
      description: 'The selected work cannot be loaded now. Check its state in the source app.',
    },
    SELECTED_WORK_AUTHORIZATION_REQUIRED: {
      label: 'Access check needed',
      description:
        'Your current access must be checked again before the selected work can be read.',
    },
    SELECTED_WORK_FORBIDDEN: {
      label: 'Access unavailable',
      description: 'The current account cannot read the selected work.',
    },
    SELECTED_WORK_NOT_FOUND: {
      label: 'Selected work not found',
      description: 'The selected work was deleted or is no longer in your current scope.',
    },
    SELECTED_WORK_INVALID_SOURCE: {
      label: 'Work link needs review',
      description: 'The saved work link is no longer valid. Select the source work again.',
    },
    SELECTED_WORK_RESTRICTED: {
      label: 'Work restricted',
      description: 'Organization policy restricted AI processing for the selected work.',
    },
    SELECTED_WORK_UNSUPPORTED: {
      label: 'Work type unsupported',
      description: 'This work type is not currently supported for selected-work answers.',
    },
  },
};

export function conversationAnswerStatus(
  status: string | null,
  locale: 'ko' | 'en'
): ConversationAnswerStatusPresentation | null {
  return status ? (ANSWER_STATUS_COPY[locale][status] ?? null) : null;
}

export function conversationAnswerSummary(
  summary: string | null | undefined,
  status: string | null,
  locale: 'ko' | 'en'
): string | null {
  const value = summary?.trim();
  if (!value) return null;
  const presentation = conversationAnswerStatus(status, locale);
  if (value !== status) return value;
  if (presentation) return presentation.description;
  if (/^[A-Z][A-Z0-9_]{2,}$/u.test(value)) {
    return locale === 'ko'
      ? '저장된 처리 상태의 상세 설명을 현재 화면에서 확인할 수 없습니다.'
      : 'A description for the saved processing state is not available in this view.';
  }
  return value;
}
