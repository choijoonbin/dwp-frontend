# 18. 디자인 산출물 수용 원장

- 최초 검수일: 2026-09-11 · 요구사항 재대조: 2026-09-14
- 원본: [Google Stitch 프로젝트](https://stitch.withgoogle.com/projects/13391261371843159731)
- 검수 범위: APR-01~16 사용자·관리자 desktop/mobile/예외 상태 프레임
- 현재 판정: `REOPENED / IMPLEMENTATION IN PROGRESS`
- 정정: 2026-09-11 검증은 아래에 기록된 기존 계약 기반 구현 범위만 증명한다. 디자인의
  모든 기능과 상태, 원본 대비 시각 일치를 증명하지 않으므로 APR-01~16 전체 완료 근거로
  사용할 수 없다. API가 없다는 이유만으로 필요한 내부 신규 기능을 제외하지 않는다.
- 재개 범위와 항목별 완료 기준: [19-full-requirements-recovery.md](19-full-requirements-recovery.md).

## 1. 최종 수용 판정

| APR | 화면                    | 판정        | 구현 시 반드시 적용할 보정                                                                                                                                             |
| --- | ----------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01  | 개인 홈                 | 수용        | 홈은 briefing·우선 작업·내 기안 흐름에 집중한다. 결재함 4개 큐 메뉴를 본문에 중복하지 않는다.                                                                          |
| 02  | 결재함 Action Center    | 수용        | `결재함` 아래 접이식 하위 메뉴와 `/approvals/inbox?queue=...`를 정본으로 사용한다. 목록·상세 선택은 페이지 이동 없이 보존한다.                                         |
| 03  | 결재 상세·결정          | 조건부 수용 | 실제 payload·route·SLA·audit만 사용한다. 법적 전자서명, AWS IAM, SIEM/WORM 등 디자인이 생성한 근거 없는 표시는 제거한다.                                               |
| 04  | 모바일 처리·배치        | 수용        | 목록→상세→결정→복귀의 선택·scroll·focus를 보존하고, 배치는 항목별 최신 권한·version을 재검증한다.                                                                      |
| 05  | 양식 선택·기안          | 조건부 수용 | 현재 게시 양식과 지원 field type만 사용한다. attachment·malware scan·sanitization은 계약 전 활성화하지 않는다.                                                         |
| 06  | 상신 전 검증            | 조건부 수용 | 현재 validation·결재선 요약을 우선한다. 증빙·참조·외부 검증은 source API가 있을 때만 표시한다.                                                                         |
| 07  | 초안·충돌 복구          | 수용        | V17 결과 기록·수정 이력·복원·휴지통과 단일 autosave를 실제 개발한다. 결과불명은 동일 명령 key와 현재 권한으로 확인하며 중복 저장하지 않는다.                           |
| 08  | 내 기안·보완 요청       | 수용        | 요청 상태별 실제 next action과 schema-complete 보완 흐름만 연다. 내부 topic·breaker·endpoint 설명은 사용자 화면에서 제거한다.                                          |
| 09  | 처리 완료·보관          | 조건부 수용 | 내 결정 완료와 내 요청 보관을 분리한다. 고급 검색·export·legal hold·download는 별도 계약 전 활성화하지 않는다.                                                         |
| 10  | 결재 위임·대결          | 수용        | 위임 기간·scope·대표행위 evidence를 보존한다. 수임자는 위임을 철회할 수 없고 위임을 영구 권한처럼 표현하지 않는다.                                                     |
| 11  | 관리자 홈               | 조건부 수용 | 정상 1440 프레임은 기존 overview와 제출된 mobile/state board를 조합해 구현한다. 가짜 100%·효율·health 수치를 만들지 않는다.                                            |
| 12  | 양식 카탈로그·버전      | 수용        | Designer·Publisher·Auditor 권한을 분리하고 published revision을 직접 편집하지 않는다.                                                                                  |
| 13  | 양식 빌더·미리보기      | 수용        | 동일 typed AST의 계산·조건·반복 행과 immutable schema hash를 구현한다. USER는 게시 버전에 결속된 실제 권한 조회와 쓰기 시점 검증으로 연결한다.                         |
| 14  | Workflow Routing Studio | 조건부 수용 | 동일 typed AST로 순차·병렬 DAG와 `ANY/ALL/COUNT/PERCENT` 편집을 구현한다. 후보의 실제 현재 권위·공개 simulation·보완 회차 연결 전 runtime 활성 완료로 표시하지 않는다. |
| 15  | 정책·SoD·SLA            | 조건부 수용 | current와 proposed, save와 publish를 분리하고 maker self-publish를 차단한다. impact simulation과 자동 escalation은 `CONTRACT_FIRST`다.                                 |
| 16  | 운영·복구·서명 준비     | 조건부 수용 | 실제 breached/delivery/readiness 값만 사용한다. bulk retry·reassign·dead-letter·legal hold·purge·WORM은 `CONTRACT_FIRST`, 법적 전자서명은 `EXTERNAL_GATE`다.           |

APR-03·05·06·07·09·11·13·14·15·16의 조건은 재디자인 요청 사유가 아니다. 화면 구조는
충분히 구현 가능하다. 근거 없는 예시 수치는 복제하지 않지만, 필요한 내부 기능은 새 계약과
저장 모델을 추가해 구현한다. 비활성 표시는 안전한 개발 중 상태일 뿐 완료나 범위 제외가 아니다.

## 2. 화면과 메뉴 경계

- 새 메뉴를 무조건 추가하지 않는다. 현재 route inventory가 우선이다.
- APR-03은 결재함 우측 상세, APR-04는 APR-02·03의 모바일 변형, APR-06은 기안 작성 단계,
  APR-13은 양식 관리 내부 builder다.
- APR-01 개인 홈과 APR-11 관리자 홈은 서로 다른 Product Surface다.
- 결재함 하위 메뉴는 `전체 대기`, `긴급 결재`, `오늘 마감`, `고위험`이며 부모 `결재함`은
  재클릭으로 접고 펼칠 수 있어야 한다.
- Operations와 Signatures는 각자의 기존 관리자 route를 유지한다.

## 3. 구현 권위 순서

디자인과 코드가 다르면 다음 순서로 판정한다.

1. owner-service 상태 전이와 DB 제약
2. owner PEP·Product Surface capability
3. Backend/Gateway OpenAPI와 generated frontend type
4. DWP Design System·공용 shell·i18n 계약
5. 이 원장의 수용된 정보 구조와 상호작용
6. Stitch의 장식·예시 데이터·설명 문구

Stitch는 시각 원본이지만 권한·API·운영 readiness의 권위 원본은 아니다. 디자인 예시를 위해
생성된 회사명, 사용자명, 금액, 위험 점수, 성공률, uptime, provider 상태를 제품 사실로
하드코딩하지 않는다.

## 4. 2026-09-11 기존 계약 기반 검증 이력

- APR-01~04: 개인 홈, 사이드바의 접이식 결재함 4개 큐, 한 화면 list-detail action center,
  항목별 재검증 batch와 모바일 drill-in·focus 복귀를 구현했다.
- APR-05~10: 게시 양식 기반 기안, 상신 전 검증, 부분 초안·409 복구, 내 기안·보완 답변,
  완료 증적·보관, 기간·범위 기반 위임을 구현했다.
- APR-11~16: 관리자 overview, 양식 catalog/version/builder, 순차 workflow, policy·SoD·SLA,
  운영 재처리와 전자서명 readiness의 fail-closed 화면을 구현했다.
- Owner service: Approval 33 suites·242 tests가 실패·오류·skip 0으로 통과했고, V15/V16 및
  Platform V231이 빈 PostgreSQL에서 checksum 일치·실패 migration 0으로 적용됐다.
- Frontend: 전체 Vitest 572 files·4,613 tests, non-incremental TypeScript, ESLint, i18n,
  display dictionary, architecture, source-size, OpenAPI sync/check와 production build가 통과했다.
- Product isolation: `dwp-approvals`와 `dwp-dwaion` 독립 빌드가 모두 통과했다. 전자결재 초기
  bundle은 raw 866.4/900 KiB, gzip 266.3/280 KiB, 5/5 requests 이내다.
- Browser: 전자결재 5개 E2E spec의 Chromium+mobile 170/170이 단일 최종 실행에서 통과했다.
  1920·1440·1280·390·320, 200% text, dark, forced colors, keyboard, 403·409·503을 포함한다.
- Runtime: devctl fresh `up full`에서 9개 owner service, Agent, Gateway, Frontend가 모두 ready며
  `/approvals/home`, `/approvals/inbox`, `/mail/home`은 HTTP 200이다.

다른 제품의 shared-worktree 변경은 보존했으며 부분 commit이나 타 제품 의미 변경으로
전자결재 구현을 섞지 않았다.

## 5. 재개된 신규 기능과 외부 운영 조건

아래 내부 기능은 미완료 개발 항목이다. 지원하지 않는 기능을 가짜 활성 상태로 표시하지
않되, 계약·저장 모델·권한·회귀 검증을 추가해 구현한다. 원본의 예시 문구와 실제 외부
운영 승인은 구분한다.

- attachment ingestion·malware scan·content sanitization
- parallel/quorum workflow와 routing/policy simulation
- background autosave·revision diff·draft delete
- admin bulk retry·reassign·dead-letter replay·reconciliation
- legal hold·retention purge·WORM export
- 실제 전자서명 ceremony와 provider production readiness

자동 저장·수정 이력·초안 휴지통/복원·서버 검색은 V17 및 전용 frontend 구현과 실제 회귀를 완료했다.
카테고리 탐색·모바일 편집·검증 정합·운영 정보 계층도 재개했다. 나머지 내부 항목은
요구사항 원장에 미완료로 유지한다. 실제 공급자 credential, 법적 승인, 운영 인프라 증적은
코드 구현만으로 완료 처리할 수 없으며 별도 외부 조건으로 보존한다.

## 6. 2026-09-14 실행 검증 중간 지점

- 원본 APR-01 홈과 APR-02~04 선택/예외: 최신 분리 spec 실행 58건 중 56 통과. 나머지 2건은
  claim 후 GET mock이 이전 상태를 반환한 fixture 결함을 수정하고 2/2 재실행 통과했다.
  동일 snapshot 전체 재실행은 별도로 남아 있다.
- V17: 격리 전체 Approval 41 suites/348 tests, 독립 권한·위임 회귀 49건 통과.
- APR-05~10: bounded browser 66건 및 위임 후속 8건 통과. 명령 key 추가 연결은 unit 17건,
  실제 Chromium/mobile 4건 통과. USER 후보 picker의 추가 연결과 최신 전체 검증은 진행 중이다.
- Typed 양식 UI: 관리자/typed/HIGH browser 72건, 전용 unit 133건 통과.
  실제 계산·조건·반복 행·복제·canvas/inspector·모바일을 포함한다.
- Typed/USER core: 이전 격리 전체 49 suites/431 tests 통과. 최신 실제 4개 명령 연결은 별도
  검증 중이며 해당 수치를 그 연결이나 V18 전체 runtime의 완료 근거로 재사용하지 않는다.
- V20 DocTools: 격리 전체 43 suites/377 tests 통과. 실제 신규 API 15개와 DTO를 export했다.
  v8 정본 연결 후 owner PEP runtime 18건, frontend 댓글·인쇄·반출 연결 검증은 남아 있다.
- Root API: 댓글/파일 해시·만료·정책·버전 및 USER 후보 경계 44건 통과.
  HIGH 문서 게시 descriptor와 기존 HCM 명령 회귀 6건 통과.
- USER Auth 등록은 기존 V49 제약조건 위반을 실제 빈 DB에서 재현해 canonical ACTION 키로
  수정했다. 전체 Auth 마이그레이션·업그레이드·disabled 보존·권한 자동 부여 없음 10건 통과.
- V18 실제 기존 명령 연결의 격리 13 suites/181 tests 통과. 최신 조건 분기·취소·Auth 후보
  source·simulation·SLA 알림 전달은 추가 검증/개발 중이다. 공급자 부재를 내부 완료로 세지 않는다.

위 수치는 각 명시된 snapshot의 중간 검증이다. 전체 APR-01~16 완료나 운영 기동 완료를
뜻하지 않는다. 최신 통합 정본·실제 fresh boot·전체 실행 Gate·원본 시각 대조까지 재회수한다.
