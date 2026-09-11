# 00. 전자결재 현행 감사·글로벌 벤치마크·목표 IA

- 기준일: 2026-09-10
- 감사 대상: 최신 frontend/backend 코드, 생성 OpenAPI, Approval E2E, 실제 로컬 브라우저
- frontend 기준 revision: `23fef2265ca542b06927a31322646bfb8abd82d7`
- backend 기준 revision: `93ac630785dc72b99fba13a01858e4c8e4845202`
- 문서 성격: Design AI와 구현 검수자를 위한 사실 기준

## 1. 판정

전자결재는 정적 대시보드 단계가 아니다. 현재 구현에는 개인 홈, 접히는 결재함 하위 큐,
목록·상세 split view, claim·단건/배치 결정, 새 기안·부분 초안, 내 기안·보완·회수, 처리 완료,
위임, Form·Workflow·Policy·Operations·Signature 관리자 Surface가 존재한다. 권한 재검증,
expected version, 고위험 step-up, maker-checker, 감사 이력도 실제 계약으로 연결돼 있다.

따라서 이번 Design AI 작업의 목적은 다음 세 가지다.

1. 이미 구현된 기능의 정보 위계·밀도·상호작용을 세련되게 재구성한다.
2. 실제로 부족한 사용자 여정을 화면·상태·행동 수준에서 설계한다.
3. 새 API·인프라·운영 증적 없이는 제공할 수 없는 기능을 별도 계약 증분으로 분리한다.

디자인만으로 `ALL/COUNT/PERCENT`, 동적 후보 해석, 첨부 보안, 법적 전자서명, retention,
대량 검색·저장보기를 완료했다고 표시하면 실패다.

## 2. 제공 프롬프트의 기술 가정 교정

사용자가 제공한 Next.js/Tailwind/Zustand 프롬프트는 원하는 경험을 설명하는 참고다. 실제 DWP
정본은 다음과 같다.

| 항목      | 실제 기준                             | Design AI·후속 구현 원칙                                         |
| --------- | ------------------------------------- | ---------------------------------------------------------------- |
| 앱        | React 19 + Vite/Nx                    | 별도 Next.js App Router 디렉터리를 만들지 않음                   |
| 라우팅    | React Router 7                        | 기존 `/approvals/**` route contract를 유지                       |
| UI        | MUI 7 + `@dwp-frontend/design-system` | Tailwind 복제나 임의 UI kit를 도입하지 않음                      |
| 아이콘    | Lucide React                          | 기존 아이콘·tooltip·접근 이름을 재사용                           |
| 서버 상태 | TanStack Query                        | 권위 재검증·failureCount·cache scope를 보존                      |
| 선택 상태 | URL query + 지역 React state          | 화면 간 공유가 입증될 때만 Zustand를 선택; 도입 자체가 목표 아님 |
| 권한      | Product Surface + owner-service PEP   | 버튼 숨김만으로 권한을 구현했다고 보지 않음                      |
| API       | Spring Boot `dwp-approval-server`     | OpenAPI·idempotency·version·audit 계약과 함께 확장               |

## 3. 실제 정보 구조

### 사용자 Surface

| 경로                             | 현재 역할                                         |
| -------------------------------- | ------------------------------------------------- |
| `/approvals/home`                | 개인 결재 시작점, 우선 심의·내 기안·정책/SLA 신호 |
| `/approvals/inbox`               | 검토 대기 split-pane action center                |
| `/approvals/completed`           | 내가 실제 처리한 결정 증적                        |
| `/approvals/requests/new`        | 게시 양식 기반 새 기안·초안 저장·상신             |
| `/approvals/requests/drafts`     | 임시 저장 재개                                    |
| `/approvals/requests/submitted`  | 내가 올린 결재 진행 추적·회수                     |
| `/approvals/requests/needs-info` | 보완 요청 응답                                    |
| `/approvals/requests/archive`    | 완료·반려·회수된 요청 보관                        |
| `/approvals/delegations`         | 본인 위임·대결 생성·조회·철회                     |

### 관리자 Surface

| 경로                          | 현재 역할                                       |
| ----------------------------- | ----------------------------------------------- |
| `/approvals/admin/overview`   | 게시·초안·활성 요청·지연·전달 실패와 assurance  |
| `/approvals/admin/workflows`  | 순차 `ANY` Workflow 초안·편집·검토·게시         |
| `/approvals/admin/forms`      | 계층 카테고리·양식·필드·기본 결재선·게시        |
| `/approvals/admin/policies`   | Routing·SoD·SLA 정책 변경안·버전·독립 게시      |
| `/approvals/admin/operations` | SLA 위반·통합 전달·감사 가능한 재처리           |
| `/approvals/admin/signatures` | 외부 전자서명 Provider 준비 상태, 실행은 비활성 |

### 결재함 하위 메뉴의 확정 위치

`전체 대기`, `긴급 결재`, `오늘 마감`, `고위험`은 홈 위젯도, 본문 왼쪽의 영구 서브패널도
아니다. 사이드바의 `결재함` 항목을 누르면 그 아래에서 펼쳐지고 다시 누르면 접힌다. 현재
선택·건수·키보드 focus를 유지하고 선택 시 우측 본문만 갱신한다.

## 4. 실제 API 범위

현재 public Gateway에는 전자결재 관련 37개 path template, 42개 method/path operation이 있으며
핵심은 다음과 같다.

### 사용자 API

- `GET /api/approvals/v1/home`
- `GET /api/approvals/v1/tasks?view=INBOX|COMPLETED`
- `GET /api/approvals/v1/tasks/{taskId}`
- `POST /api/approvals/v1/tasks/{taskId}/claim`
- `POST /api/approvals/v1/tasks/{taskId}/decisions`
- `GET/POST /api/approvals/v1/requests`
- `GET /api/approvals/v1/requests/{requestId}`
- `GET /api/approvals/v1/requests/{requestId}/detail`
- `PUT /api/approvals/v1/requests/{requestId}/draft`
- `POST /api/approvals/v1/requests/{requestId}/submit`
- `POST /api/approvals/v1/requests/{requestId}/information-response`
- `POST /api/approvals/v1/requests/{requestId}/withdraw`
- 게시 Workflow·Form 목록/Template 조회
- 위임 목록·후보 검색·생성·철회

### 관리자 API

- overview, workflows/list/detail/create/update/publish
- form categories/list/create/update
- forms/list/detail/create/update/publish
- policies/list/version/update/publish
- operations/list/integration-delivery retry
- signature provider readiness 조회

### 현재 API가 증명하지 않는 것

- 첨부 업로드·malware scan·preview·보존
- 독립 collaboration thread, 멘션, 참조/회람/협조선
- server cursor 기반 대량 검색·개인 saved view
- `ALL`, `COUNT`, `PERCENT`, 병렬·혼합 단계 runtime
- 동적 조직/금액/직책 후보 resolver snapshot
- Workflow/Form 게시본에서 차기 draft 분기·diff·retire·restore
- 정책 simulator와 실제 영향 대상 dry-run
- 운영자 대량 reassign/cancel/reconciliation workbench
- legal hold·retention·WORM·감사 export
- 법적 전자서명 실행·signed webhook·certificate evidence

## 5. 실제 브라우저 감사

### 개인 홈

실제 화면은 DWP 글로벌 헤더·전자결재 사이드바 아래에 짧은 인사, 전문가 연결, 새 결재,
개인화, 오늘의 결재 브리핑, 4개 판단 지표, 우선 심의 큐, 신속 실행, 내 기안 추적,
의사결정 내비게이터, 단계별 흐름, 최근 활동을 제공한다. 개인화 조회 실패 시 기본 구성을
보이되 편집을 닫고 명시적 재시도를 제공하는 fail-closed 상태도 실제로 확인했다.

개선 방향은 홈을 결재함으로 바꾸는 것이 아니라 첫 화면의 판단 순서, 세로 길이, 핵심 1~2개
행동, 숫자의 범위·신선도를 더 명료하게 만드는 것이다.

### 결재함

사이드바 `결재함` 아래 4개 큐가 펼쳐지고, 본문에는 검색·최대 20건 배치 선택·결재 목록·우측
상세가 있다. 선택된 Task의 정책/위험 신호, 단계, 구조화 payload, 불변 timeline과 결정
행동을 한 화면에서 제공한다. 권위가 확인되지 않으면 상세와 결정 행동을 닫는 상태를 실제로
확인했다.

현재 상세는 판단 데이터와 timeline에는 강하지만 문서형 긴 본문, 첨부 preview, 독립 댓글
대화, 참조/협조자 표현은 계약이 없다. 결정 사유 `comment`를 협업 댓글 기능처럼 확장해서는
안 된다.

### 새 기안과 내 요청

게시 양식 선택, 제목·요약·우선순위, 동적 필드, 기본 결재선 preview, 불완전 초안 저장과
엄격한 상신 검증이 구현돼 있다. Draft deep link, DWAI·ON handoff, request detail drawer,
보완 응답·회수·timeline도 존재한다.

개선 후보는 선택→작성→검증의 단계 인지, 긴 양식 navigation, 저장 상태, field error summary,
상신 전 변경 영향이다. 첨부·참조·협조는 새 계약 전까지 활성 컨트롤로 만들지 않는다.

### 관리자

- Overview는 역할·assurance·운영 신호를 제공하며 API 실패를 명시적으로 보여 준다.
- Workflow는 목록·상태·단계·후보 역할·SLA·검토/게시를 제공하지만 범용 canvas 엔진은 아니다.
- Forms는 지표, 계층 카테고리, 검색 목록, Inspector, field builder, 기본 Workflow, 게시
  readiness까지 비교적 완성도가 높다.
- Policies는 현재/제안 rule·버전·maker-checker를 제공하나 simulation/impact preview는 없다.
- Operations는 위반 task와 integration delivery에 집중한다. 종합 복구 관제 화면은 아니다.
- Signatures는 외부 Gate를 정직하게 표시하는 read-only 준비 화면이다.

## 6. 구현·개선·계약 분류

| 영역                                   | 판정                             | 디자인 지시                                                        |
| -------------------------------------- | -------------------------------- | ------------------------------------------------------------------ |
| 홈 정보 위계·밀도·행동                 | `REDESIGN_ONLY`                  | 현재 API와 route만으로 개선 가능                                   |
| 사이드바 결재함 접기/펼치기            | `EXISTING`                       | 위치와 동작을 보존                                                 |
| inbox split view·4개 큐                | `EXISTING`                       | 시각·키보드·모바일 흐름 고도화                                     |
| client 검색·단건 decision fan-out 배치 | `EXISTING`                       | 현재 목록 snapshot·최대 20건·항목별 결과를 명시                    |
| server cursor 검색·bulk command        | `CONTRACT_FIRST`                 | query scope·idempotency·결과 원장 필요                             |
| 상세 payload·단계·timeline·결정        | `EXISTING`                       | 증거 우선 위계로 재구성                                            |
| AI 요약                                | `REDESIGN_ONLY/CONTRACT_FIRST`   | 현재 risk/policy 요약은 가능; 생성 AI이면 출처·시각·실패 계약 필요 |
| 초안·상신·보완·회수                    | `EXISTING`                       | 단계성·오류 복구·긴 양식 개선                                      |
| 개인화 layout                          | `EXISTING`                       | 조회 실패/409/권한 회수 보존                                       |
| 개인 saved view·대량 cursor search     | `CONTRACT_FIRST`                 | server schema·scope·version 필요                                   |
| 첨부·preview                           | `CONTRACT_FIRST + EXTERNAL_GATE` | object storage/KMS/scan/retention 필요                             |
| 댓글·멘션·참조·협조                    | `CONTRACT_FIRST`                 | 별도 data/audit/notification contract 필요                         |
| 순차 ANY Workflow                      | `EXISTING`                       | 현재 제공 범위만 활성화                                            |
| ALL/COUNT/PERCENT·병렬·동적 후보       | `CONTRACT_FIRST`                 | runtime ledger·snapshot·recovery 선행                              |
| Form/Workflow 다음 revision            | `CONTRACT_FIRST`                 | immutable published revision branch/diff 필요                      |
| Policy simulation/impact               | `CONTRACT_FIRST`                 | deterministic preview·scope count·evidence 필요                    |
| 운영 재처리 단건                       | `EXISTING`                       | 고위험 확인·step-up·감사 보존                                      |
| 대량 DLQ/reassign/reconciliation       | `CONTRACT_FIRST`                 | lease/idempotency/result ledger 필요                               |
| 법적 전자서명                          | `EXTERNAL_GATE`                  | provider/KMS/webhook/certificate 전에는 read-only                  |

## 7. 글로벌 제품 비교

### SAP S/4HANA Flexible Workflow·My Inbox

공식 SAP 문서는 My Inbox에서 approve/reject, claim, suspend, forward, log를 제공하고,
Workflow 관리에서 시작/단계 조건, recipient, deadline, exception, simulation과 activation을
구분한다. DWP는 `작업 큐 + 문맥 상세 + 실행 로그`, deadline과 예외 처리, 활성화 전 검증을
수용한다. 다만 SAP의 모든 설정 폭을 현재 R1 화면에 복제하지 않고, 실제 지원하는 순차 ANY와
maker-checker만 활성화한다.

- [SAP Flexible Workflow](https://help.sap.com/docs/SAP_S4HANA_CLOUD/0e602d466b99490187fcbb30d1dc897c/10e7e36908184328aab7d5007d9ecb13.html)
- [SAP My Inbox](https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/8308e6d301d54584a33cd04a9861bc52/f510145761df5e38e10000000a44147b.html)

### Microsoft Approvals·Power Automate

Microsoft는 first response, everyone, custom response, sequential 유형과 Teams/Outlook/action
center의 문맥 내 응답을 제공한다. DWP는 결정 유형의 명료성, 단계 순서, 알림에서 원본
action center로 이어지는 짧은 경로를 수용한다. 하지만 DWP runtime이 지원하지 않는
everyone/custom response를 단순 선택 옵션으로 노출하지 않는다.

- [Power Automate approvals](https://learn.microsoft.com/en-us/power-automate/get-started-approvals)
- [Preset approval stages](https://learn.microsoft.com/en-us/power-automate/guidance/business-approvals-templates/configure-preset-approvals)

### ServiceNow Approval Hub·Workflow Studio

ServiceNow는 My Tasks의 open/completed, in-context details, attachments, activity, batch action,
외부 source link와 Workflow Studio의 due date·rule을 결합한다. DWP는 목록-상세, 완료 읽기
전용, 근거/활동 분리, 부분 실패를 수용한다. 외부 source와 내부 approval engine을 동시에
소유해 충돌시키는 구조, API 없이 보이는 attachment/activity는 피한다.

- [ServiceNow approval experience](https://www.servicenow.com/docs/r/employee-service-management/employee-experience-foundation/ec-to-dos-use-approval-hub.html)
- [ServiceNow My To-dos](https://www.servicenow.com/docs/r/employee-service-management/employee-experience-foundation/ec-to-dos-use.html)
- [ServiceNow Ask for Approval](https://www.servicenow.com/docs/r/build-workflows/workflow-studio/ask-approval-flow-designer.html)

### Workday Business Process Framework

Workday는 business process definition, security policy, organizational hierarchy를 한 실행
모델로 결속하고 approval 외 integration, document review, questionnaire를 같은 프로세스
단계에서 다룬다. DWP는 역할·조직 기반 후보와 versioned workflow를 수용하되, 사람 이름을
화면에서 선택했다고 runtime 후보 snapshot이 만들어진 것처럼 표현하지 않는다.

- [Workday Business Process Framework](https://www.workday.com/content/dam/web/en-us/documents/datasheets/workday-business-process-framework.pdf)

### Coupa Approval Chains

Coupa는 approval chain의 type, condition, priority와 approve/reject/hold, delegate, reason,
position을 명시한다. DWP는 정책 우선순위, 결정 사유, 단계 위치와 위임 증적을 수용한다.
구매 도메인 전용 필드나 hold를 범용 전자결재 기능으로 복제하지 않는다.

- [Coupa Approval Chain Import](https://compass.coupa.com/en-us/products/product-documentation/integration-technical-documentation/coupa-core-flat-files-%28csv%29/flat-file-%28csv%29-import/approval-chain-import)
- [Coupa Approvals API](https://compass.coupa.com/en-us/products/product-documentation/integration-technical-documentation/the-coupa-core-api/resources/transactional-resources/approvals-api-%28approvals%29)

### 접근성

WCAG 2.2의 reflow, focus order/visible/not obscured, target size, error prevention, status messages를
최소 기준으로 삼는다. 금융·권한·법적 영향을 주는 결정은 제출 전 대상·결과·사유를 다시
확인하며, 상태 변화는 focus를 강제로 빼앗지 않고 `status`/`alert` 의미로 전달한다.

- [W3C WCAG 2.2 Understanding](https://www.w3.org/WAI/WCAG22/Understanding/)
- [W3C WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/)

## 8. Adopt / Avoid / Evolve

| 구분   | 결정                                                                                   |
| ------ | -------------------------------------------------------------------------------------- |
| Adopt  | 하나의 inbox, 문맥 상세, 명료한 due/risk, claim, reasoned decision, completed evidence |
| Adopt  | Form·Workflow·Policy 자산 분리, version, validation, maker-checker publish             |
| Adopt  | 모바일의 한 작업면, detail/activity tabs, 필수 반려 사유, batch 결과 항목별 표시       |
| Avoid  | 카드 수프, 큰 환영 hero, 장식 차트, 가짜 AI score, 항상 움직이는 live feed             |
| Avoid  | 홈 안에 또 다른 사이드바, 모든 필터를 영구 메뉴화, 사용자·관리 메뉴 혼합               |
| Avoid  | 권한 없는 CTA를 disabled로만 남기기, 503을 0건으로 표시, stale 데이터로 결정 허용      |
| Avoid  | 하나의 generic workflow canvas로 모든 도메인을 처리한다고 과장                         |
| Evolve | risk/policy signal을 출처·시각·판단 영향이 드러나는 evidence brief로 발전              |
| Evolve | batch를 빠른 일괄 승인보다 사전 재검증·제외 사유·항목별 결과가 보이는 도구로 발전      |
| Evolve | 관리자 숫자를 예외→영향→조치→감사로 이어지는 운영 흐름으로 발전                        |

## 9. 목표 IA

### 사용자

```text
전자결재 홈
결재함
  전체 대기
  긴급 결재
  오늘 마감
  고위험
내 처리 완료함
새 결재 작성
임시 저장
내가 올린 결재
보완할 결재
완료 보관함
결재 위임
```

하위 큐는 `결재함`의 disclosure다. 홈 카드나 별도 고정 rail이 아니다. 검색·saved view는
결재함 본문 도구다. 상세, batch result, preflight, attachment/comment는 영구 메뉴가 아니다.

### 관리자

```text
관리 홈
프로세스 관리
양식 관리
정책 관리
운영·SLA
전자서명 연계
```

Form builder는 양식 관리의 편집 작업면, Workflow builder는 프로세스 관리의 편집 작업면,
Policy simulation은 정책 관리의 후속 계약이다. 이를 각각 최상위 메뉴로 늘리지 않는다.

## 10. 화면 우선순위

| 우선순위 | 화면  | 이유                                                            |
| -------- | ----- | --------------------------------------------------------------- |
| D1       | 01~04 | 가장 빈번한 판단·결정 경로이며 사용자가 직접 문제를 지적한 영역 |
| D1       | 05~08 | 기안 성공률, 입력 보존, 회수·보완의 핵심 업무 경로              |
| D2       | 09~10 | 증적 재탐색과 부재 시 업무 연속성                               |
| D2       | 11~14 | 관리 자산의 설계·게시 품질과 SoD                                |
| D3       | 15~16 | 새 API/운영 증거 비중이 커 계약 설계와 병행 필요                |

## 11. 공통 시각 원칙

- 기존 DWP shell과 공통 PageCanvas, design-system control을 유지한다.
- 전체 화면을 좁은 중앙 카드에 가두지 않고 fluid workspace와 안정된 열 너비를 사용한다.
- 홈은 짧은 시작점, inbox는 밀도 높은 반복 처리 도구, admin은 비교 가능한 운영 도구다.
- 표면 색은 canvas/sidebar/surface와 primary/success/warning/error를 균형 있게 사용한다.
- 카드 radius는 8px 이하. 섹션 전체를 부유 카드로 만들거나 카드 안 카드를 만들지 않는다.
- 숫자에는 범위와 기준 시각을, 위험에는 원인과 다음 행동을 함께 둔다.
- 생성 AI가 아닌 서버 risk score를 `AI 판단`으로 이름 붙이지 않는다.
- 긴 한글·영문·ID·금액·날짜가 320px와 200% 확대에서 겹치지 않게 한다.
- 아이콘 버튼은 Lucide와 tooltip/accessible name을 사용한다.

## 12. 모든 화면의 상태 계약

| 상태         | 반드시 지킬 의미                                         |
| ------------ | -------------------------------------------------------- |
| Loading      | 이전 민감 상세·행동을 그대로 남기지 않음                 |
| Empty        | 권위 조회 성공 후 실제 0건                               |
| Search empty | 원본 전체 0건과 구분, 필터 해제 제공                     |
| Partial      | 성공 영역을 유지하고 실패 영역·누락 가능성을 별도 표시   |
| Offline/503  | stale 시각과 읽기 가능 범위를 표시, mutation 닫기        |
| 403/revoked  | 민감 payload·금액·사람·CTA 제거, 안전한 복귀 제공        |
| 409/stale    | 사용자의 입력을 보존하고 최신 버전 비교 후 명시적 재시도 |
| Submitted    | 접수와 최종 결정·원업무 반영 완료를 구분                 |
| Long content | 줄임만 하지 말고 읽기·확장·문서 navigation 제공          |

## 13. Design AI 금지 사항

1. DWP 밖의 새 브랜드, 앱 셸, 로그인, 전역 검색, 알림, 사용자 메뉴를 만든다.
2. 홈 본문에 결재함 하위 메뉴를 다시 만든다.
3. 관리자 메뉴를 개인 결재 메뉴에 합친다.
4. 존재하지 않는 route/API를 현재 제공 기능으로 표시한다.
5. risk score를 자동 승인 추천이나 정확도 퍼센트로 바꾼다.
6. 권한 회수 뒤 캐시된 본문·첨부·결정 버튼을 흐리게만 남긴다.
7. 반려·철회·게시·재처리 같은 고영향 행동을 한 클릭으로 끝낸다.
8. 모바일에 데스크톱 3열을 축소하거나 하단 action을 키보드/오류 위에 겹친다.
9. 200% 확대에서 가로 page overflow를 만든다.
10. 디자인 fixture를 운영 데이터나 구현 완료 증거로 설명한다.
