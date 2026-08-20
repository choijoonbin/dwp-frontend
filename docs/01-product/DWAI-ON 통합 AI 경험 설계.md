# DWAI·ON 통합 AI 경험 설계

> 결정일: 2026-08-19  
> 상태: P0~P3 애플리케이션 구조 전환 완료 · 외부 모델·원천 시스템 연동 Gate 분리
> 제품 오너: DWP AI Platform

## 결론

`DWAI·ON`은 DWP의 단일 AI 브랜드이자 사용자에게 보이는 AI 동료다. 기존
`DWP 묻기`는 별도의 AI 제품이 아니며, DWAI·ON의 근거·출처·감사 증적을 자세히
다루는 전체 화면 작업공간으로 정의한다.

| 표면             | 공식 명칭            | 책임                                                             |
| ---------------- | -------------------- | ---------------------------------------------------------------- |
| 우측 하단 진입점 | DWAI·ON              | 빠른 질문, 화면을 벗어나지 않는 도움, 가이드·담당자·앱 상태 연결 |
| 독립 제품 앱     | DWAI·ON              | 제품 홈, 대화, 에이전트 탐색, 근거 검증, 위임된 Tenant 운영      |
| 대화 작업 화면   | 새 대화              | 긴 답변, 권한 범위 출처, 정책 판정, 감사 증적, 복잡한 후속 작업  |
| 내부 런타임      | Governed Ask Runtime | 인증, 정책, 근거 수집, 모델 라우팅, 인용 검증, 감사 기록         |

내부 호환 계약인 `dwp-ask`, `APP.ASK`, `DWP_ASSISTANT`, `/api/agent/v1/ask`는
유지한다. 이 값은 제품명이 아니라 배포·권한·API 식별자다.

## 외부 검증

| 공식 사례                                                                                                                             | 확인된 패턴                                                        | DWP 적용                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------- |
| [Atlassian Rovo Chat](https://support.atlassian.com/rovo/docs/accessing-chat/)                                                        | 업무 화면 우측 하단에서 열고 대화 이력을 다시 이어감               | 전역 플로팅 진입과 전체 워크스페이스 확장                       |
| [Rovo Chat actions](https://support.atlassian.com/rovo/docs/chat-actions/)                                                            | 사용자 권한을 지키며 검색·사람·업무 스킬을 대화에서 실행           | 권한이 있는 지원 도구만 노출하고 변경은 승인 흐름으로 인계      |
| [Google Workspace Gemini side panel](https://support.google.com/a/users/answer/15146419)                                              | 앱을 떠나지 않고 현재 업무 맥락을 보조                             | 홈을 밀지 않는 오버레이와 화면 맥락형 추천 질문                 |
| [Microsoft 365 Copilot sources](https://support.microsoft.com/en-us/Microsoft-365-Copilot/control-review-sources-copilot-chat)        | 인라인 인용과 전체 출처 목록을 함께 제공                           | 패널에는 출처 수를, 워크스페이스에는 인용·증적을 제공           |
| [ServiceNow Now Assist premium chat](https://www.servicenow.com/docs/r/intelligent-experiences/now-assist-panel-premium.html)         | 플로팅 창, 90% 확장, 새 대화, 이력, 상황별 추천을 한 경험으로 연결 | 새 질문·전체 화면 확장·상황별 도구를 한 패널에 통합             |
| [Intercom Messenger update](https://www.intercom.com/help/en/articles/9319961-updates-to-the-messenger)                               | AI, 자동화, 사람 연결을 하나의 대화 흐름으로 전환                  | AI 답변, 이용 가이드, 담당자 연결을 별도 제품처럼 분리하지 않음 |
| [Notion Enterprise Search](https://www.notion.com/help/enterprise-search)                                                             | 사용자가 검색 범위를 이해하고 출처를 다시 열 수 있음               | 자동 권한 범위와 실제 인용 출처를 우측 검증 패널에 분리         |
| [Google Workspace Gemini sources](https://support.google.com/a/users/answer/16813283)                                                 | 활성 소스와 응답에 기여한 소스를 구분하고 검증을 안내              | 검색 가능 범위와 이번 실행의 검증된 인용을 혼동하지 않음        |
| [Microsoft 365 Copilot Chat overview](https://learn.microsoft.com/en-us/copilot/overview)                                             | 빠른 채팅, 에이전트, 지속 가능한 작업 결과를 계층화                | 플로팅 질문과 근거 중심 전체 화면을 하나의 AI 정체성으로 연결   |
| [Microsoft Copilot Studio security and governance](https://learn.microsoft.com/en-us/microsoft-copilot-studio/guidance/sec-gov-intro) | 환경·데이터·커넥터·감사를 독립된 관리 책임으로 분리                | 운영 메뉴와 권한을 단일 관리자 토글이 아닌 업무별 리소스로 분리 |
| [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework)                                                                  | AI 위험을 Govern·Map·Measure·Manage 수명주기로 지속 관리           | 정책, 평가, 운영 관측과 감사 증적을 제품 Control Plane에 포함   |
| [OWASP Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/)                                                 | 도구 권한·기능·자율성을 최소화하고 고영향 동작은 사람 승인을 요구  | 읽기 전용 Preview와 담당 앱의 명시적 최종 실행을 분리           |
| [Microsoft Copilot Studio evaluation](https://learn.microsoft.com/en-us/microsoft-copilot-studio/analytics-agent-evaluation-intro)    | 반복 가능한 평가 세트, 실행 이력과 결과 비교로 변경 회귀를 확인    | 암호화 평가 세트, 실행 이력, 직전 실행 대비 사례별 회귀를 제공  |
| [Microsoft evaluation results](https://learn.microsoft.com/en-us/microsoft-copilot-studio/analytics-agent-evaluation-results)         | 실행별 통과율과 세부 결과를 검토하고 품질 변화를 추적              | 통과율 증감과 개선·회귀 사례를 같은 운영 화면에서 검토          |

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

- 정식 제품 홈은 `/dwaion/home`이다. `/dwaion/new`, `/dwaion/conversations`,
  `/dwaion/agents`, `/dwaion/admin/*`를 동일한 독립 제품 셸 아래 둔다.
- `/dwaion`은 제품 홈으로 이동한다. `q`, `agent`, `conversation`이 있는 기존 주소는
  각각 새 대화 또는 정식 대화 URL로 변환하며 쿼리 문자열을 보존한다.
- `/ask`는 기존 북마크, 알림, 활동 이력의 호환을 위해 유지하며 쿼리 문자열을 보존한 채
  `/dwaion/home` 또는 `/dwaion/new`로 리다이렉트한다.
- 신규 내비게이션, 앱 카탈로그, 검색 결과, Space 앱 바인딩은 정식 `/dwaion/*` URL만 생성한다.
- `/api/agent/v1/ask`, `APP.ASK`, `DWP_ASSISTANT`는 외부 URL이 아닌 내부 호환 계약이므로
  변경하지 않는다.

## 구현 경계

- `components/dwaion-assistant/*`: 모든 제품에서 재사용하는 전역 플로팅 진입점, 패널,
  지원 도구와 현재 화면 맥락 계약. 독립 DWAI·ON 제품 구현을 import하지 않는다.
- `features/dwaion/dwaion-home.tsx`: 실제 업무 큐, 대화, Runtime Registry와 Action Catalog를
  조합한 개인화 제품 홈
- `features/dwaion/dwaion-conversations.tsx`: 사용자 소유 대화 검색·재개·삭제와 표준 상태 처리
- `features/dwaion/dwaion-agents.tsx`: 게시 상태와 앱 권한을 모두 만족하는 에이전트 탐색
- `features/dwaion/dwaion-admin.tsx`: 대화 본문 없이 Tenant 집계 운영 지표와 버전형 보존 정책 관리
- `features/dwaion/dwaion-admin-{agents,sources,actions,safety,evaluation,audit}.tsx`:
  에이전트 게시, 데이터 원천, 도구 권한, 안전 정책, 반복 평가, append-only 감사의 분리된
  운영 화면
- `features/dwaion/dwaion-evaluation-{history,comparison}.tsx|ts`: 평가 실행 이력,
  직전 실행 대비 통과율·사례별 회귀, 메트릭 전용 증적 내보내기
- `features/dwaion/dwaion-navigation.ts`: 권한 메타데이터를 포함한 제품 Manifest와 내비게이션 원장
- `features/dwaion/dwaion-contract.ts`: 내부 에이전트 키와 전체 화면 라우트 계약
- `features/dwaion/dwaion-workspace*.tsx`: 대화 이력, 시작 모드, 질문 실행, 답변, 출처와 검증 패널
- `features/dwaion/dwaion-action-shelf.tsx`: 권한별 서버 액션 카탈로그, Preview와 담당 앱 인계
- `routes/dwaion-routes.tsx`, `layouts/dwaion-layout.tsx`: 자식 라우트 가드와 독립 제품 셸
- `apps/dwp-dwaion`: 독립 배포·번들·아키텍처 검증 대상

## 기능 단계 구현 결과

| 우선순위 | 구현 결과                                                                                           |
| -------- | --------------------------------------------------------------------------------------------------- |
| P0       | 인증 후 전역 런처, 화면 맥락형 추천, 실제 SSE 단계 진행, 사용자 중단, 인용 미리보기, `/dwaion` 승계 |
| P1       | 테넌트·사용자 범위 Conversation, 후속 질문, 최근 대화 조회·삭제, 소스 범위 선택, 답변 피드백        |
| P2       | 서버 소유 액션 카탈로그, 권한별 노출, 읽기 전용 Plan Preview, 명시적 확인 후 담당 앱 인계           |
| P3       | 독립 제품 Manifest·셸·번들, 사용자 홈·대화·에이전트, 위임 운영 메뉴와 레거시 URL 호환               |

## 제품 셸 로드맵 완료 기준

| 단계 | 완료된 계약                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------ |
| P0   | Product Manifest, 공통 권한 판정기, 자식 라우트 가드, Manifest·권한·제품 경계 아키텍처 테스트    |
| P1-A | DWAI·ON 독립 홈, 새 대화, 내 대화, 전문 에이전트, 업무 실행 및 연결, 세분화된 운영 Control Plane |
| P1-B | 업무·활동·서비스·커뮤니케이션의 표준 제품 홈과 사용자/운영 메뉴, 제품별 소스 소유권              |
| P2   | Workplace·알림·Space 홈 보완, 서비스·커뮤니케이션·Space 운영 메뉴의 제품 내부 이전               |
| P3   | Provider 지원 세션용 Tenant 내비게이션 오버레이, Catalog 전용 셸, 레거시 앱 셸과 예외 코드 제거  |

각 제품의 운영 메뉴는 Tenant 역할 이름을 직접 검사하지 않는다. Manifest가 선언한
`resourceKey + permissionCode`를 공통 판정기와 자식 라우트 가드가 동일하게 평가한다.
Provider 지원 세션은 명시적인 Support Scope가 있는 메뉴와 라우트만 열며, Tenant 권한을
지원자에게 합성하지 않는다.

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
- Tenant 관리자에게 DWAI·ON 운영 권한을 자동 상속하지 않는다. 에이전트 작성·게시,
  데이터/액션/안전 정책, 평가, 감사 책임은 각각 `ADMIN.DWAION_*` 리소스로 분리한다.
  레거시 종합 운영 역할도 승인·MFA·시간 제한을 거쳐야 하며, 일상 운영에는 세분화된
  역할을 사용한다.
- 운영 현황은 실행 수, 정책 판정, 답변 상태, 지연, Token, 피드백과 보존 정책의 Tenant
  집계만 제공한다. 질문, 답변, 대화 제목과 사용자 식별 정보는 조회하거나 복호화하지 않는다.
- 평가 실행은 같은 Tenant·평가 세트에서 한 번만 허용한다. 실행 임대가 만료된 중단 작업은
  실패로 회수하고 임대를 잃은 이전 실행 결과는 거부한다. 원문 질문·답변을 복제하지 않는
  결과 메트릭만 이력과 CSV 증적에 남긴다.
- 평가 이력·상세 조회의 `VIEW`와 증적 내보내기의 `EXPORT`를 분리한다. 스프레드시트에서
  수식으로 해석될 수 있는 내보내기 셀은 무력화한다.
- OpenTelemetry GenAI 규격은 전용 저장소로 이전 중이고 Schema URL이 확정되지 않았으므로,
  현재는 안정된 `X-Correlation-ID` 계약을 유지하고 안정 버전 공개 후 명시적으로 버전을 고정한다.

## 구현 검증

- 2026-08-20: Frontend 전체 lint, typecheck, production build와 bundle budget 통과
- 2026-08-20: `/dwaion/home`, 대화, 에이전트, 운영 현황, 보존 정책을 실제 SKAX 데이터로 확인
- 2026-08-20: `joonbin@sk.com` 위임 운영 메뉴 노출, `hyunwoo.park@sk.com` 메뉴 비노출 및
  운영 URL `/403` 차단 확인
- 2026-08-20: 390px 모바일에서 가로 overflow와 버튼·링크 텍스트 잘림 없음 확인
- 2026-08-20: 평가 실행 이력·상세·직전 실행 회귀 비교, `VIEW`와 `EXPORT` 분리,
  동시 실행 차단과 메트릭 전용 CSV 수식 주입 방어 검증

## 운영 연동 Gate

다음 항목은 코드 미완성이 아니라 고객 환경과 관리형 인프라가 있어야 활성화되는 운영
Gate다. 로컬 화면에서 성공 상태를 꾸미지 않는다.

1. 승인된 OpenAI 모델 Snapshot과 Secret Manager 기반 자격증명
2. Work·Mail·Calendar·Approval 원천 API의 서비스 신원과 실제 사용자 ACL
3. Tenant별 대화 보존 기간, Legal Hold, KMS 키 회전 정책
4. 액션별 담당 앱 Draft 수신 계약과 승인 후 실행 Timeline
5. 운영 품질 평가셋, Citation 정확도·Abstention·권한 누출 Red-team Gate
