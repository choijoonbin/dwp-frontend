# DWAI·ON 통합 AI 경험 설계

> 결정일: 2026-08-19  
> 상태: P0~P2 내부 구현 완료 · 운영 연동 Gate 분리  
> 제품 오너: DWP AI Platform

## 결론

`DWAI·ON`은 DWP의 단일 AI 브랜드이자 사용자에게 보이는 AI 동료다. 기존
`DWP 묻기`는 별도의 AI 제품이 아니며, DWAI·ON의 근거·출처·감사 증적을 자세히
다루는 전체 화면 작업공간으로 정의한다.

| 표면             | 공식 명칭            | 책임                                                             |
| ---------------- | -------------------- | ---------------------------------------------------------------- |
| 우측 하단 진입점 | DWAI·ON              | 빠른 질문, 화면을 벗어나지 않는 도움, 가이드·담당자·앱 상태 연결 |
| 전체 화면 앱     | DWAI·ON 워크스페이스 | 긴 답변, 권한 범위 출처, 정책 판정, 감사 증적, 복잡한 후속 작업  |
| 내부 런타임      | Governed Ask Runtime | 인증, 정책, 근거 수집, 모델 라우팅, 인용 검증, 감사 기록         |

내부 호환 계약인 `dwp-ask`, `APP.ASK`, `DWP_ASSISTANT`, `/api/agent/v1/ask`는
유지한다. 이 값은 제품명이 아니라 배포·권한·API 식별자다.

## 외부 검증

| 공식 사례                                                                                                                      | 확인된 패턴                                                        | DWP 적용                                                        |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------- |
| [Atlassian Rovo Chat](https://support.atlassian.com/rovo/docs/accessing-chat/)                                                 | 업무 화면 우측 하단에서 열고 대화 이력을 다시 이어감               | 전역 플로팅 진입과 전체 워크스페이스 확장                       |
| [Rovo Chat actions](https://support.atlassian.com/rovo/docs/chat-actions/)                                                     | 사용자 권한을 지키며 검색·사람·업무 스킬을 대화에서 실행           | 권한이 있는 지원 도구만 노출하고 변경은 승인 흐름으로 인계      |
| [Google Workspace Gemini side panel](https://support.google.com/a/users/answer/15146419)                                       | 앱을 떠나지 않고 현재 업무 맥락을 보조                             | 홈을 밀지 않는 오버레이와 화면 맥락형 추천 질문                 |
| [Microsoft 365 Copilot sources](https://support.microsoft.com/en-us/Microsoft-365-Copilot/control-review-sources-copilot-chat) | 인라인 인용과 전체 출처 목록을 함께 제공                           | 패널에는 출처 수를, 워크스페이스에는 인용·증적을 제공           |
| [ServiceNow Now Assist premium chat](https://www.servicenow.com/docs/r/intelligent-experiences/now-assist-panel-premium.html)  | 플로팅 창, 90% 확장, 새 대화, 이력, 상황별 추천을 한 경험으로 연결 | 새 질문·전체 화면 확장·상황별 도구를 한 패널에 통합             |
| [Intercom Messenger update](https://www.intercom.com/help/en/articles/9319961-updates-to-the-messenger)                        | AI, 자동화, 사람 연결을 하나의 대화 흐름으로 전환                  | AI 답변, 이용 가이드, 담당자 연결을 별도 제품처럼 분리하지 않음 |
| [Notion Enterprise Search](https://www.notion.com/help/enterprise-search)                                                      | 사용자가 검색 범위를 이해하고 출처를 다시 열 수 있음               | 자동 권한 범위와 실제 인용 출처를 우측 검증 패널에 분리         |
| [Google Workspace Gemini sources](https://support.google.com/a/users/answer/16813283)                                          | 활성 소스와 응답에 기여한 소스를 구분하고 검증을 안내              | 검색 가능 범위와 이번 실행의 검증된 인용을 혼동하지 않음        |
| [Microsoft 365 Copilot Chat overview](https://learn.microsoft.com/en-us/copilot/overview)                                      | 빠른 채팅, 에이전트, 지속 가능한 작업 결과를 계층화                | 플로팅 질문과 근거 중심 전체 화면을 하나의 AI 정체성으로 연결   |

## UX 계약

- 플로팅 버튼은 홈 레이아웃을 밀지 않는 오버레이이며 테넌트 배경과 무관하게 식별된다.
- 패널은 데스크톱 `420 x 620px`을 기준으로 하고 모바일에서는 12px 안전 여백을 지킨다.
- 빈 상태에서는 콘텐츠 높이에 맞춰 작게 시작하고 답변·지원 상세가 늘어나면 최대 높이까지 위로 확장한다.
- 헤더에 캐릭터, `AI` 표기, 새 질문, 전체 화면 확장, 닫기 동작을 제공한다.
- 첫 화면은 개인화된 인사, 추천 질문, 이용 가이드·담당자·앱 상태 도구를 제공한다.
- 질문은 실제 Governed Ask Runtime을 호출하고 로딩, 답변 보류, 설정 필요, 오류를 숨기지 않는다.
- 패널에는 간결한 답변, 인용 미리보기와 피드백을 제공하고 전체 출처·정책·감사 증적은
  워크스페이스에서 확인한다.
- 서비스 상태를 추정해 `정상`으로 표시하지 않는다. 실제 앱 카탈로그의 연결 상태 화면으로 이동한다.
- 모션은 대기·응답 상태를 전달하는 용도로만 사용하며 Reduced Motion 설정을 따른다.
- 전체 화면은 질문 입력만 있는 빈 대시보드가 아니라 업무 모드, 실제 최근 업무, 검색 범위,
  답변, 출처 및 검증 증적을 하나의 작업 흐름으로 제공한다.
- 전체 화면의 우측 검증 패널은 검색 가능한 범위와 이번 실행에서 실제 사용된 출처를
  구분한다. 소스 선택은 서버 검색 계약에 반영되며 대화 맥락은 같은 Conversation 안에서만
  전달한다. 매 후속 질문은 현재 세션 권한과 원본 ACL을 다시 검증한다.

## 라우팅 계약

- 정식 사용자 URL은 `/dwaion`이다. 브랜드와 제품 목적이 드러나고 향후 질의 외 기능을
  담을 수 있어 동사형 `/ask`보다 안정적인 제품 경계다.
- `/ask`는 기존 북마크, 알림, 활동 이력의 호환을 위해 유지하며 쿼리 문자열을 보존한 채
  `/dwaion`으로 리다이렉트한다.
- 신규 내비게이션, 앱 카탈로그, 검색 결과, Space 앱 바인딩은 `/dwaion`만 생성한다.
- `/api/agent/v1/ask`, `APP.ASK`, `DWP_ASSISTANT`는 외부 URL이 아닌 내부 호환 계약이므로
  변경하지 않는다.

## 구현 경계

- `features/dwaion/dwaion-launcher.tsx`: 플로팅 진입점, 캐릭터 모션, 패널 위치·크기 제어
- `features/dwaion/dwaion-global-host.tsx`: 인증·권한·라우트에 따른 전역 플로팅 진입점
- `features/dwaion/dwaion-panel.tsx`: 질문·대화 상태와 워크스페이스 승계를 조율하는 컨테이너
- `features/dwaion/dwaion-panel-{header,result,composer}.tsx`: 헤더, 근거·피드백 응답, 입력·중단 제어
- `features/dwaion/dwaion-support-tools.tsx`: 이용 가이드, 담당자, 앱 연결 상태 지원 도구
- `features/dwaion/dwaion-contract.ts`: 내부 에이전트 키와 전체 화면 라우트 계약
- `features/dwaion/dwaion-workspace*.tsx`: 대화 이력, 시작 모드, 질문 실행, 답변, 출처와 검증 패널
- `features/dwaion/dwaion-action-shelf.tsx`: 권한별 서버 액션 카탈로그, Preview와 담당 앱 인계
- `/dwaion`: 정식 전체 화면 URL. `/ask`는 호환 리다이렉트로만 유지

## P0~P2 구현 결과

| 우선순위 | 구현 결과                                                                                           |
| -------- | --------------------------------------------------------------------------------------------------- |
| P0       | 인증 후 전역 런처, 화면 맥락형 추천, 실제 SSE 단계 진행, 사용자 중단, 인용 미리보기, `/dwaion` 승계 |
| P1       | 테넌트·사용자 범위 Conversation, 후속 질문, 최근 대화 조회·삭제, 소스 범위 선택, 답변 피드백        |
| P2       | 서버 소유 액션 카탈로그, 권한별 노출, 읽기 전용 Plan Preview, 명시적 확인 후 담당 앱 인계           |

### 데이터와 보안

- `ai_conversations`, `ai_conversation_messages`, `ai_answer_feedback`는 전용 `dwp_agent`
  데이터베이스에 저장한다.
- 제목, 질문, 답변, 인용과 선택적 피드백 의견은 AES-256-GCM으로 암호화한다.
- 모든 Conversation API는 `tenantId + userId` 소유 범위를 강제하며 다른 사용자의 존재를
  노출하지 않는다.
- 대화는 90일 후 조회에서 즉시 제외되고 목록 접근 시 만료 레코드가 물리 삭제된다.
- 대화 이력은 후속 질문 해석에만 제한적으로 사용하며 사실 근거로 취급하지 않는다.
- 액션 Preview는 `mutationAllowed=false`이고, 실제 저장·전송·제출은 담당 앱에서 다시
  권한과 입력을 검증한 뒤 사용자가 수행한다.

## 운영 연동 Gate

다음 항목은 코드 미완성이 아니라 고객 환경과 관리형 인프라가 있어야 활성화되는 운영
Gate다. 로컬 화면에서 성공 상태를 꾸미지 않는다.

1. 승인된 OpenAI 모델 Snapshot과 Secret Manager 기반 자격증명
2. Work·Mail·Calendar·Approval 원천 API의 서비스 신원과 실제 사용자 ACL
3. Tenant별 대화 보존 기간, Legal Hold, KMS 키 회전 정책
4. 액션별 담당 앱 Draft 수신 계약과 승인 후 실행 Timeline
5. 운영 품질 평가셋, Citation 정확도·Abstention·권한 누출 Red-team Gate
