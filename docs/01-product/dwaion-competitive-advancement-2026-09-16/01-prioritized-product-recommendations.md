# 우선순위와 메뉴 결정

## 1. 우선순위 원칙

기능 수를 늘리는 대신 다음 조건을 만족하는 항목만 고도화 대상으로 선택한다.

1. 사용자가 실제 업무 결과를 더 정확하고 안전하게 얻는다.
2. 기업 관리자가 모델·데이터·Agent의 배포 위험을 통제할 수 있다.
3. DWAI·ON의 제안→검토→실행→영수증 차별점을 강화한다.
4. 기존 DWP 앱의 메일·일정·결재·문서 기능을 중복 구현하지 않는다.
5. 운영 API와 권한 계약 없이 시각적 버튼만 만들지 않는다.

## 2. P0: 대표 AI 앱이 되기 위한 필수 고도화

### P0-R0. 현행 사용자 경로와 핵심 여정 복구

새 기능보다 먼저 세 가지를 닫는다.

1. `new`, `conversations`, `conversation-detail`, `activity`, `agents` PAGE route를 공식 product surface에 승격하고 Backend bundle, Frontend 생성 source, route guard, direct/deep-link 권한 test를 일치시킨다.
2. 수락된 제안에서 proposal ID, action key, action inputs, evidence reference를 one-time opaque handoff 또는 서버 조회로 action review에 전달한다. URL과 browser history에 업무 원문을 넣지 않는다.
3. ACL 공유가 생기기 전까지 대화의 `공유`를 `링크 복사`로 정정한다. target app 인계 성공과 실제 업무 완료도 별도 상태로 표시한다.

완료 조건은 개발 환경에서 화면이 열리는 것이 아니다. 110/111 계열 권한 bundle과 rollout fail-closed 환경에서 권한 있는 사용자는 접근하고, 권한 없는 사용자·교차 tenant·철회된 source는 차단되며, 제안에서 만든 preview가 실제 최신 권한과 source를 다시 검증해야 한다.

### P0-U1. 보안형 파일·멀티모달 질문

`새 대화`에 PDF, Word, Excel/CSV, 이미지 첨부를 추가한다. 업로드 전 크기·형식·악성 파일·민감도·보존 정책을 검사하고, 처리 후 페이지·표·시트·셀 단위 인용을 답변에 연결한다.

DWAI·ON식 고도화는 파일을 읽는 데서 끝나지 않는다. 파일 근거로 행동을 제안할 때 원본 파일 접근권한과 최신성을 다시 확인하고, 보존 만료·삭제 요청이 대화와 산출물까지 추적되어야 한다.

### P0-U2. Deep Research 장기 실행

`새 대화` 안에 `질문 / 검색 / 깊은 조사` 모드를 둔다. 깊은 조사는 연구 목표, 허용 소스, 시간·비용 한도, 산출물 형식을 먼저 확인한다. 실행 중에는 계획, 확인된 소스, 제외된 소스, 부분 실패, 남은 단계와 예상 범위를 보여주고 일시중지·취소·범위 수정이 가능해야 한다.

최종 결과는 `산출물`의 불변 버전으로 저장하고, 실행 전체는 `AI 실행 이력`에서 이어 본다. 별도 상위 메뉴를 만들지 않는다.

### P0-U3. 내구성 있는 루틴과 장기 실행

현재 dry-run 중심 `내 AI 루틴`을 실제 scheduler와 event trigger로 확장한다. 실행 lease, 중복 방지, 재시도, 중단, 보상, quiet hours, 예산, 알림, 만료를 계약으로 둔다.

루틴 결과는 자동 변경보다 `AI 제안함`으로 전달하는 것을 기본값으로 한다. 저위험이고 명시적으로 승인된 행동만 제한적으로 자동 실행하며, 매 실행마다 실제 원본 결과와 영수증을 남긴다.

### P0-A1. 모델 및 라우팅

관리자 상위 메뉴 `/dwaion/admin/models`를 추가한다. 공급자·모델 registry, 데이터 등급, 처리 지역, 사용 목적, primary/fallback, 비용·지연 한도, budget, health, circuit breaker, 정책 시뮬레이션, version publish와 rollback을 한 책임으로 묶는다.

사용자에게 원시 모델명을 기본 선택하게 하지 않는다. 관리 정책이 업무 유형, 데이터 민감도, modality, 품질·비용·지연 목표에 따라 route를 결정하고, 필요한 전문 사용자에게만 제한된 override를 제공한다.

### P0-A2. Agent 출시 수명주기

기존 `관리자 > 에이전트`를 Builder, Versions, Evaluation, Rollout 탭으로 확장한다.

- prompt·model route·source·tool binding을 버전으로 관리
- sandbox에서 fixture와 adversarial case 시험
- 평가와 Gate 통과 후 maker-checker 승인
- 개발→pilot→일부 조직→전체 조직 canary
- 현재·이전 버전 비교, rollback, 즉시 중단
- 배포 이력과 영향을 사용자 실행·영수증에 연결

### P0-A3. Connector와 Action/Tool 운영

기존 `데이터 원천`에 Connector 등록, OAuth/secret reference, ACL sync, freshness, latency, 오류, drift, reindex, revoke를 추가한다. 기존 `업무 실행 및 연결` 관리자 표면에는 MCP/tool/action schema, risk class, dry-run, approval chain, version과 disable을 추가한다.

등록됨, 인증됨, 최근 검증 성공, 현재 정상 호출 가능 상태를 각각 분리한다.

### P0-A4. 지속 평가와 사고 대응

기존 `평가`에 dataset import, dataset/model/prompt/policy/tool 버전 pinning, side-by-side 비교, production sampling, feedback linkage를 추가한다. 측정 항목은 인용 정확성, 근거 부족 시 보류, 권한 누출, prompt injection, 유해 행동, 편향, 비용, 지연, 업무 완료율이다.

기존 `운영 현황`과 `Gate`에 incident queue, 영향 범위, Agent/tool/model/connector별 kill switch, 실행 격리, replay·recovery, 복구 승인과 timeline을 추가한다. 사고 대응은 독립 메뉴보다 운영 첫 화면의 즉시 행동이어야 한다.

## 3. P1: 핵심 수명주기를 완성하는 고도화

### P1-U1. 팀 산출물과 검토

`산출물`에 `내 산출물 / 팀 작업공간 / 검토 요청` 탭을 추가한다. 사용자·그룹 역할, source permission revalidation, 공동 편집 충돌, review·approval, 공유 만료, revoke, DLP exception을 제공한다.

새 `프로젝트` 상위 메뉴를 만들지 않는다. 팀 작업이 충분히 커져 독립적인 여러 resource를 소유하게 될 때만 재검토한다.

### P1-U2. 개인 memory 설명 가능성

`개인 AI 제어`에서 memory 항목별 생성 근거, 적용 범위, 민감도, 만료, 수정, 삭제 상태를 제공한다. Connector 원본, 파생 index, backup, export에 대한 삭제 진행과 완료 영수증을 분리한다.

### P1-U3. 위임형 Agent Studio

일반 사용자 전체가 아니라 권한 있는 maker가 `전문 에이전트`에서 새 Agent 초안을 만들고 관리자 검토에 제출할 수 있게 한다. 자연어 역할 정의, 허용 source/tool, 시작 질문, test case, 예상 한계를 작성하고 직접 배포는 허용하지 않는다.

### P1-U4. 조직 지식 검색과 feedback loop

Work·Mail·Calendar 외 승인된 문서·메시지·회의록 corpus를 semantic+keyword retrieval로 연결한다. source permission, ACL sync, freshness와 삭제를 매 질의에 적용하고, 검색 범위와 실제 사용한 source를 분리해 보여준다.

싫어요에는 선택형 사유, 짧은 의견, 문제가 된 인용을 받을 수 있게 하고 evaluation case로 승격할 때 원문 최소화·사용자 동의·민감정보 제거를 적용한다.

### P1-A1. 업무 가치 분석

`운영 현황`을 token과 호출량 중심에서 다음 지표로 확장한다.

- 제안 수락 후 실제 업무 완료율
- 절감된 수동 단계와 cycle time
- 재작업·rollback·정책 차단 비율
- 출처 미확인·답변 보류 비율
- Agent·조직·업무 유형별 비용 대비 완료 결과
- 사용자 feedback과 반복 실패 원인

개인 생산성 순위나 대화 원문을 제공하지 않는다.

### P1-A2. 감사·보존 완결

Audit export에 무결성 증거, WORM 저장 정책, legal hold/eDiscovery 연계, data residency, 삭제·backup 파기 영수증을 추가한다. 관리자는 개인 대화 원문이 아니라 명령·정책·권한·결과 metadata를 조회한다.

## 4. 메뉴 변경안

### 사용자 메뉴

상위 메뉴는 그대로 유지한다.

| 기존 메뉴     | 고도화                                                          |
| ------------- | --------------------------------------------------------------- |
| 새 대화       | 질문·검색·깊은 조사 모드, 파일 첨부, source coverage            |
| AI 실행 이력  | 장기 실행 진행, pause/resume/cancel, retry·compensation·receipt |
| AI 제안함     | routine·event·research에서 생성된 제안, 만료와 영향             |
| 전문 에이전트 | maker 권한이 있을 때 Agent 초안 제출                            |
| 내 AI 루틴    | scheduler·event trigger·budget·notification·receipt             |
| 개인 AI 제어  | memory provenance·scope·expiry·deletion receipt                 |
| 산출물        | 내 산출물·팀 작업공간·검토 요청                                 |

### 관리자 메뉴

`모델 및 라우팅`만 상위 메뉴로 추가한다.

| 메뉴              | 고도화                                                      |
| ----------------- | ----------------------------------------------------------- |
| 운영 현황         | incident queue, 업무 가치, 비용·품질·위험 threshold         |
| 에이전트          | Builder·Versions·Evaluation·Rollout                         |
| 데이터 원천       | Connector lifecycle·ACL sync·freshness·drift                |
| 업무 실행 및 연결 | MCP/tool/action registry·sandbox·risk·version               |
| 모델 및 라우팅    | 신규: provider/model registry·policy·health·budget·rollback |
| 안전              | versioned policy·simulation·red-team·rollback               |
| 평가              | import·동등 조건 비교·production sampling·feedback          |
| 운영 Gate         | deployment gate·kill switch·recovery approval               |
| 감사              | integrity·legal hold·eDiscovery·destruction receipt         |

## 5. 제외할 기능

- Word·Drive·Teams를 다시 만드는 범용 편집·메일·회의 제품
- 모든 사용자에게 제공하는 원시 모델·temperature·parameter 선택기
- 검증되지 않은 공개 Agent marketplace
- 초기 핵심으로 삼는 광범위한 자율 브라우저·컴퓨터 제어
- 웨이크워드와 상시 녹음
- chain-of-thought 원문 노출
- Work·Calendar와 별개인 AI 전용 할 일·일정 원장
- 개인 감시로 해석될 수 있는 생산성 점수·순위
- 실제 업무 결과와 연결되지 않은 메시지·token vanity dashboard
- AI 대표성을 이미지·영상 생성 기능으로 증명하려는 접근

## 6. 추가 제품 의견

### 신뢰 정보를 공통 언어로 통일한다

모든 화면에서 `확인됨 / 부분 확인 / 오래됨 / 차단됨 / 확인 불가`를 같은 의미로 사용한다. “AI 정확도 98%” 같은 근거 없는 단일 점수보다 source coverage, freshness, permission check와 abstention 이유를 보여준다.

### 테스트 종류를 완료 보고에 함께 적는다

fixture E2E, API 통합 test, 실제 provider smoke test, production probe를 같은 `테스트 통과`로 묶지 않는다. 완료 보고에는 어느 환경에서 어느 신원·provider·Connector·worker를 실제로 통과했는지 적는다.

### 행동 전후를 같은 영수증으로 연결한다

제안 ID, plan hash, policy version, 승인, domain command UUID, 원본 결과, 보상 결과, 평가 feedback을 하나의 trace로 연결한다. 사용자가 `완료`를 눌렀을 때 무엇이 실제로 바뀌었는지 즉시 확인할 수 있어야 한다.

### 운영 화면은 관찰보다 대응을 우선한다

위험 배지와 차트를 늘리기보다 영향 확인, 중단, 담당자 지정, 복구 검증, 재개 승인을 핵심 행동으로 둔다.

### 차별점을 제품 문구에 명시한다

DWAI·ON의 대표 문구는 “무엇이든 대신하는 AI”가 아니라 **“근거를 확인하고, 권한 안에서, 실제 업무 완료를 증명하는 AI”**가 적합하다.
