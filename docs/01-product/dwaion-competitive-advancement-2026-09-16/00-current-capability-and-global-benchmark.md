# 현행 기능과 글로벌 3개 제품 비교

## 1. 비교 대상과 방법

“글로벌 탑3”는 검증하기 어려운 시장점유율 순위가 아니다. DWAI·ON이 경쟁해야 하는 서로 다른 기업용 AI 구조를 대표하는 다음 세 제품을 선정했다.

1. **ChatGPT Enterprise**: 독립형 AI 업무 진입점, Company Knowledge, Deep Research, Projects와 Workspace Agents의 기준
2. **Microsoft 365 Copilot**: Microsoft Graph와 생산성 앱에 결합된 업무 문맥, Agent 배포, Purview 거버넌스와 가치 측정의 기준
3. **Google Gemini Enterprise**: 권한 인식 기업 검색, 광범위한 Connector, Agent Platform의 배포·거버넌스·평가 기준

Glean은 기업 검색·Assistant·Actions·Agent 측면에서 DWAI·ON과 매우 유사한 비교 후보다. 정확히 세 제품만 비교하기 위해 Gemini Enterprise와 겹치는 수평형 기업 검색 유형을 한 자리로 묶었다. 이는 Glean의 시장 순위를 평가한 것이 아니다.

## 2. 현재 메뉴와 실제 책임

정본은 `apps/dwp/src/features/dwaion/dwaion-navigation.ts`, `dwaion-product-manifest.ts`, `apps/dwp/src/routes/dwaion-routes.tsx`다.

### 사용자 표면

| 경로                        | 현재 책임                                                           | 판정                                   |
| --------------------------- | ------------------------------------------------------------------- | -------------------------------------- |
| `/dwaion/home`              | 질문 시작, 업무 신호, 우선 업무, 최근 대화                          | 구현                                   |
| `/dwaion/new`               | 텍스트·검토형 음성 질문, 허용 소스 선택, 근거 답변                  | UI 구현, 공식 PAGE 권한 계약 누락      |
| `/dwaion/conversations`     | 개인 대화 탐색·상세·이름 변경·삭제·보존 경계                        | UI 구현, 목록·상세 PAGE 권한 계약 누락 |
| `/dwaion/activity`          | AI 실행 목록·상세·정책·소스·증거 확인                               | UI 구현, 공식 PAGE 권한 계약 누락      |
| `/dwaion/proposals`         | AI 제안 목록, 근거, 분석 동의, 수락·미루기·해제                     | 구현                                   |
| `/dwaion/agents`            | 허용된 전문 Agent 탐색과 대화 진입                                  | UI 구현, 공식 PAGE 권한 계약 누락      |
| `/dwaion/actions`           | 허용 행동 탐색, 입력 계획 검토, 원본 앱 인계                        | 부분: 원본 앱 완료 영수증 없음         |
| `/dwaion/routines`          | 명시 동의 루틴 정의·수정·중지·보관·dry-run                          | 부분                                   |
| `/dwaion/personal-controls` | 소스 preference, 명시적 memory, 보존·삭제 요청                      | 부분                                   |
| `/dwaion/artifacts`         | 개인 산출물, autosave, 불변 버전, preflight, 개인 게시, export 요청 | 부분                                   |

### 관리자 표면

| 경로                       | 현재 책임                                        | 판정                 |
| -------------------------- | ------------------------------------------------ | -------------------- |
| `/dwaion/admin/overview`   | 테넌트 운영 집계와 readiness 드릴다운            | 구현, 운영 연결 별도 |
| `/dwaion/admin/agents`     | Agent registry·revision·binding·검토·활성화·중지 | 부분                 |
| `/dwaion/admin/sources`    | 근거 소스 정책과 상태                            | 부분                 |
| `/dwaion/admin/actions`    | 행동 정책, 위험도, 실행 방식, 권한 경계          | 부분                 |
| `/dwaion/admin/safety`     | 안전 정책과 모델 route·budget 설정               | 부분                 |
| `/dwaion/admin/evaluation` | 평가 set·case·run·history·export                 | 부분                 |
| `/dwaion/admin/gates`      | 운영 준비 Gate, 증거, maker-checker 승인         | 부분                 |
| `/dwaion/admin/audit`      | 감사 조회·export와 retention 정책                | 부분                 |

관리자 기능을 운영 역량 12개 축으로 다시 나누면 **권한/PEP만 end-to-end 구현**, 모델 라우팅·Agent/tool·Connector·privacy/retention·prompt/policy·safety·observability·evaluation·cost·rollout/audit 10개 축은 부분, DWAI·ON 전용 incident/kill switch는 부재다. 관리 화면이 빈 mock은 아니지만 “AI control plane 완성”으로 판정할 수 없다.

### 현행 릴리스 차단 항목

#### PAGE 권한 계약 불일치

프론트는 메뉴에서 누락된 PAGE를 DRAFT route로 합성한다. `product-route-contracts.generated.test.ts`도 `route.dwaion.work.activity.page`가 공식 source에는 없고 DRAFT에만 있음을 명시적으로 검증한다. Backend `contracts/product-authorization/product-surfaces-v1.json`의 `dwaion.work`에는 `home.page`과 `proposals.page`만 공식 PAGE로 등록되어 있다.

공식 레지스트리에 없는 키는 다음과 같다.

- `route.dwaion.work.new.page`
- `route.dwaion.work.conversations.page`
- `route.dwaion.work.conversation-detail.page`
- `route.dwaion.work.activity.page`
- `route.dwaion.work.agents.page`

따라서 화면 코드 존재를 사용자 배포 완료로 볼 수 없다. 다섯 PAGE를 공식 product surface 계약에 승격하고 권한 bundle·생성 파일·route guard·deep link test를 함께 갱신해야 한다.

#### 제안→행동 검토 문맥 단절

`dwaion-proposal-decision-panel.tsx`는 수락된 제안에 `actionKey`가 있어도 `/dwaion/actions`로만 이동한다. proposal ID, action key, action inputs, evidence를 governed action review에 전달하지 않는다. 제안 결정 자체는 저장되지만 사용자가 기대하는 다음 단계의 행동 검토가 일반 catalog에서 다시 시작된다.

수정은 URL query에 민감한 입력을 넣지 않고, proposal ID를 이용한 서버 조회 또는 one-time opaque launch token으로 action draft를 복원해야 한다. action review는 proposal evidence와 최신 권한을 재검증하고 별도 preview를 만든다.

#### 공유 명칭과 실제 계약 불일치

대화 화면의 공유 동작은 현재 URL을 Web Share 또는 clipboard로 전달한다. 대화 저장소는 tenant·user owner scope이므로 다른 사용자는 링크를 받아도 대화 객체를 열 수 없다. ACL 공유가 구현되기 전까지 `공유`를 `링크 복사`로 표시하고, 팀 공유 완료로 집계하지 않아야 한다.

## 3. 코드에서 확인한 강점

### 근거를 행동과 분리한다

`dwaion-workspace-answer.tsx`와 대화 API는 답변, 인용, 출처 상태, 재시도와 feedback을 다룬다. `dwaion/actions`는 답변이 곧 실행 권한이라는 가정을 하지 않고 별도 계획 검토와 원본 앱 인계를 사용한다.

### AI 제안함이 명시적 수명주기를 갖는다

`dwaion-proposal-*`은 제안 이유·근거·우선순위·유효성, 사용자 분석 동의, 수락·미루기·해제를 분리한다. 이 구조는 AI가 먼저 발견한 업무를 자동 실행하지 않고 사용자가 통제하는 DWAI·ON의 대표 차별점이다.

### 운영 성공과 미확인을 구분한다

관리 화면은 실패한 조회를 0이나 정상으로 바꾸지 않고 `unavailable`, `partial`, `not initialized` 상태를 사용한다. 실행 이력도 AI 응답 완료와 원본 업무 완료를 구분한다.

### 사용자와 관리 표면의 권한을 분리한다

`dwaion-product-manifest.ts`는 개인 작업 표면과 리소스 범위 관리 표면을 별도 capability로 정의한다. 관리 권한이 있다는 이유만으로 개인 대화 원문 열람을 허용하는 구조가 아니다.

### 버전·사전검사·감사 기반이 있다

산출물의 불변 버전과 preflight, Agent revision, 평가 run, Gate evidence, 감사 export와 retention이 존재한다. 완전한 운영 수명주기는 아니지만 이후 고도화를 붙일 올바른 기반이다.

## 4. 코드에서 확인한 실제 공백

| 영역                  | 현행 근거                                                                                         | 판정                  | 필요한 계약                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------- |
| 대화 파일·이미지 입력 | `dwaion-workspace-composer.tsx`는 텍스트, 소스 chip, 음성 transcript를 제공                       | 미구현                | 악성 파일 검사, DLP, 보존, parsing, 페이지·시트·셀 인용                            |
| Deep Research         | 장기 연구 plan·source coverage·중간 산출물·pause/resume 계약 없음                                 | 미구현                | durable run, 진행·취소·수정, 출처 범위, 최종 보고서                                |
| 루틴 실예약           | dry-run과 사용자 consent 기반 CRUD는 존재                                                         | 부분                  | scheduler, trigger, lease, retry, compensation, notification, receipt              |
| 팀 산출물             | 개인 게시·개인 export 중심                                                                        | 부분                  | 팀 역할, 공유 대상 권한 재검증, review·approval, revoke, DLP                       |
| 산출물 source/DLP     | `dwaion-artifact-copy.ts`가 진위·최신성 verifier와 enterprise DLP 미연결을 명시                   | 부분                  | source verifier, DLP result, exception 승인, 배포 차단                             |
| Agent 배포            | registry·revision·활성화는 있으나 배포 이력 버튼이 비활성                                         | 부분                  | 환경별 release, canary, metric gate, rollback, kill switch                         |
| Connector 등록·상태   | `dwaion-admin-sources.tsx`의 신규 Connector와 health check가 비활성                               | 부분                  | 등록, secret reference, OAuth, ACL sync, freshness, drift, revoke                  |
| Action/Tool 수명주기  | 정책은 있으나 이력·schema export·새 tool 등록이 닫히지 않음                                       | 부분                  | MCP/tool schema, sandbox, risk, approval, version, disable                         |
| Safety 검증           | policy 편집은 있으나 history·schema export·dry-run simulation이 비활성                            | 부분                  | 정책 diff, scenario simulation, versioned publish, rollback                        |
| Evaluation            | set·case·run은 있으나 CSV import와 동등 조건 비교가 비활성                                        | 부분                  | dataset import, version pinning, side-by-side, production sample                   |
| Model 운영            | 일부 safety route/budget 설정은 있으나 독립 provider/model lifecycle과 실제 health 없음           | 부분                  | provider registry, residency, fallback, budget, circuit breaker                    |
| 사고 대응             | Gate와 운영 현황은 있으나 incident timeline·containment·recovery 계약이 없음                      | 미구현                | alert, impact, stop, replay, recovery approval, postmortem link                    |
| Audit 불변성          | list/export와 retention은 있으나 응답 자체가 WORM·tamper proof를 증명하지 않음을 UI가 명시        | 부분                  | integrity proof, legal hold, eDiscovery, destruction receipt                       |
| 제품 route 권한       | 5개 PAGE가 DRAFT frontend route에만 있고 공식 backend product surface에 없음                      | 미완료·릴리스 차단    | official promotion, bundle regeneration, fail-closed route/deep-link test          |
| 제안→행동 인계        | 수락 뒤 generic `/dwaion/actions` 이동                                                            | 미완료·핵심 여정 단절 | opaque context handoff, evidence binding, permission revalidation, preview receipt |
| 대화 탐색 범위        | 기본 최근 30건을 받아 frontend에서 검색·필터                                                      | 부분                  | server paging/search, stable cursor, 전체 범위와 현재 범위 구분                    |
| 실행 이력 탐색        | 기준 커밋은 최근 100건 단일 요청                                                                  | 부분                  | cursor paging, stable ordering, filters, resume-safe detail                        |
| 원본 앱 완료 증거     | 4개 action preview와 target handoff는 있으나 최종 domain receipt 없음                             | 부분                  | domain callback/receipt, failure·compensation, original deep link                  |
| 대화 공유             | URL 복사/Web Share만 존재하고 owner ACL 객체 없음                                                 | 미구현                | 당장은 `링크 복사`로 정정, 이후 membership·ACL·revoke·expiry                       |
| Feedback              | 좋아요·싫어요는 저장되나 API가 지원하는 사유·의견을 UI에서 받지 않음                              | 부분                  | reason code, comment, disputed citation, evaluation linkage                        |
| 검색 범위             | 일반 질문은 Work·Mail·Calendar 중심이며 document/message/meeting corpus와 semantic retrieval 없음 | 부분                  | approved corpora, semantic+keyword retrieval, ACL/freshness ledger                 |
| 전문 Agent 폭         | registry를 읽지만 사용자 화면은 현재 지원 key 두 개 중심                                          | 부분                  | 실제 source/tool/permission 경계가 완성된 specialist만 단계적으로 노출             |

## 5. 글로벌 기능 비교

| 역량                 | ChatGPT Enterprise                                    | Microsoft 365 Copilot                         | Gemini Enterprise                              | DWAI·ON 판단                                                 |
| -------------------- | ----------------------------------------------------- | --------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| 자연스러운 AI 진입점 | Chat, Projects, Company Knowledge, Deep Research      | Copilot Chat·Search와 Office·Teams 내장       | Assistant·Search·Canvas·Notebook·Agent Gallery | 대화 기반은 구현, 장기 연구·파일 입력 보강 필요              |
| 권한 인식 기업 지식  | connected apps와 source permission, citation          | Graph·M365·connector와 원본 권한              | permissions-aware multi-source search          | DWP 내부 근거는 강함, Connector 폭과 ACL sync 관측은 부족    |
| 멀티모달·데이터 분석 | 파일·이미지·음성·데이터 분석                          | Office 파일·이미지·음성·분석                  | 파일·이미지·카메라·구조/비구조 데이터          | 음성 전사 외 파일 계약 부재                                  |
| Agent·반복 업무      | Workspace Agents, schedule, tools, approval           | Agent Builder/Studio, flow, 중앙 registry     | Workflow Builder, triggers, MCP, multi-agent   | catalog·정책 기반은 있으나 실예약·builder·배포 수명주기 부족 |
| 협업                 | Shared Projects와 Agent 공유                          | Pages·Loop·Teams·Office 공동 작업             | Notebook·Skill·Workflow·Agent 공유             | 개인 산출물 기반만 있고 팀 review/share 미완성               |
| 관리자 거버넌스      | RBAC, app/action control, monitoring                  | Copilot controls, Purview, registry, approval | registry, identity, gateway, Model Armor       | 세분 권한·Gate 강함, 모델·Connector·배포 운영 공백           |
| 평가·개선            | analytics와 API Evals 생태계                          | test set·회귀 평가, adoption·ROI              | offline/online eval, feedback, observability   | 평가 run 기반은 있으나 비교·운영 sampling·feedback loop 부족 |
| 보안·컴플라이언스    | no-training default, retention, residency, compliance | DLP, label, audit, eDiscovery, legal hold     | IAM, VPC, ACL, Model Armor, audit              | PEP·감사 방향 강함, DLP·불변성·삭제 완료 증거 보강 필요      |
| 가치 측정            | usage·impact·workspace analytics                      | adoption·productivity·ROI                     | usage·search·agent·value analytics             | token·운영량에서 업무 완료·재작업 감소 지표로 확장 필요      |

## 6. 경쟁 우위를 키울 조합

DWAI·ON이 따라야 할 조합은 **ChatGPT의 사용 편의성, Microsoft의 업무 문맥, Google의 Agent 운영 체계**다. 그대로 복제할 필요는 없다.

DWAI·ON의 우위는 다음 연결을 더 완전하게 만드는 데 있다.

`업무 신호 → 근거 있는 AI 제안 → 사용자 검토 → Agent 계획 → 도메인 PEP 재검증 → 실제 업무 결과 → 실행 영수증 → 평가·감사`

- 제안은 이유·근거·영향·기한·만료를 가진다.
- 사용자는 수락·미루기·해제를 명시적으로 선택한다.
- 원본 앱은 실행 직전에 권한과 사전조건을 다시 검사한다.
- 실행 영수증은 plan hash, 정책 버전, 승인자, 원본 링크, 실제 변경 결과, 취소·보상을 연결한다.
- 근거 부족, Connector 장애, 부분 실패를 숨기지 않는다.
- 운영 feedback은 다음 Agent·정책·모델 배포 Gate로 되돌아간다.

## 7. 검증 증거의 한계

- Frontend의 DWAI·ON E2E는 UI·요청 계약·반응형·접근성 검증에 유용하지만 `page.route`, mock shell session과 fixture를 사용한다. 실제 tenant→Gateway→Agent→외부 provider 전 구간 운영 증거는 아니다.
- Agent API·store·PostgreSQL 테스트는 존재하지만, 기록된 외부 Azure provider 점검은 DNS 실패로 종료됐다. fixture 응답을 실제 모델 연결 성공으로 계산하지 않는다.
- 작업 트리에 Activity cursor pagination 개선이 있으나 기준 커밋에는 없다. 커밋·push·세 저장소 동기화 검증 전에는 완료 기능으로 집계하지 않는다.
- 코드와 계약이 있어도 실제 provider credential, Connector sync, KMS, export worker, scheduler, 알림 worker와 운영 데이터의 정상 작동은 별도 release Gate에서 확인해야 한다.

## 8. 공식 근거

### OpenAI

- [ChatGPT Enterprise](https://help.openai.com/en/articles/8265053-what-is-chatgpt-enterprise)
- [Company Knowledge](https://help.openai.com/en/articles/12628342)
- [Workspace Agents](https://openai.com/business/workspace-agents/)
- [OpenAI Frontier](https://openai.com/business/frontier/)
- [Enterprise RBAC](https://help.openai.com/en/articles/11750701-managing-feature-access-with-role-based-access-control-in-chatgpt)
- [Shared Projects](https://help.openai.com/en/articles/10169521-using-projects-in-chatgpt)
- [ChatGPT agent 관리 범위](https://help.openai.com/en/articles/11752874-chatgpt-agent)

### Microsoft

- [Microsoft 365 Copilot 앱](https://support.microsoft.com/en-us/microsoft-365-copilot/what-is-the-microsoft-365-copilot-app)
- [Copilot Search](https://learn.microsoft.com/en-us/copilot/microsoft-365/microsoft-365-copilot-search)
- [Agent 관리자 안내](https://learn.microsoft.com/en-us/microsoft-365/copilot/agent-essentials/m365-agents-admin-guide)
- [Copilot 보안·거버넌스](https://learn.microsoft.com/en-us/microsoft-365/copilot/copilot-controls/security-governance)
- [측정·보고](https://learn.microsoft.com/en-us/microsoft-365/copilot/copilot-controls/measurement-reporting)
- [Agent Tool Registry](https://learn.microsoft.com/en-us/microsoft-365/admin/manage/manage-tools-for-agent)

### Google

- [Gemini Enterprise 개요](https://docs.cloud.google.com/gemini/enterprise/docs)
- [Gemini Enterprise 핵심 개념](https://docs.cloud.google.com/gemini/enterprise/docs/concepts)
- [Workflow Builder](https://docs.cloud.google.com/gemini/enterprise/docs/workflow-builder/workflow-agents)
- [Agent Platform](https://docs.cloud.google.com/gemini-enterprise-agent-platform/agents)
- [Agent Governance](https://docs.cloud.google.com/gemini-enterprise-agent-platform/govern)
- [Agent Evaluation](https://docs.cloud.google.com/gemini-enterprise-agent-platform/optimize/evaluation/evaluate-agents)
- [Model Armor](https://docs.cloud.google.com/gemini-enterprise-agent-platform/govern/configure-model-armor)

### 비교 후보

- [Glean Enterprise AI Platform](https://www.glean.com/)
- [Glean Actions](https://docs.glean.com/agents/actions/introduction-to-actions)
- [Glean Search](https://docs.glean.com/administration/search/about)
