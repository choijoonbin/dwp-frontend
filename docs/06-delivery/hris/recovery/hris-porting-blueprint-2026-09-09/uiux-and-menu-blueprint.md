# DWP HRIS 메뉴 및 UI/UX 청사진

이 문서의 상세 목록은 각 workbench 내부 task group과 기능 카탈로그이며 좌측 sidebar 항목 목록이 아니다. 실제 shell·sidebar·route 소유권 정본은 `coding-readiness/09-information-architecture-contract.md`, `hris-information-architecture-register.csv`, `hris-shell-navigation-register.csv`, `hris-workbench-task-group-register.csv`다. `/hr/home`은 SYS가 소유하는 widget-only composition이고 메뉴 카탈로그를 직접 펼치지 않는다.

## 1. 정보구조 원칙

### 제품명과 진입점

- 글로벌/한국어 제품명: `HRIS`
- 부제 예시: `People · Time · Pay`
- 기본 URL은 기존 bookmark와 권한 계약을 위해 `/hr` 유지
- 현재 `인사`, `DWP HCM` 노출 문자열은 단계적으로 `HRIS`로 변경
- 메뉴는 설치된 capability, 국가팩, 테넌트 설정, 사용자 권한, 대상 범위에 따라 projection

### 작업면

| 작업면 | 주 사용자 | 첫 질문 | 주 행동 |
|---|---|---|---|
| 개인 | 전 직원 | 오늘 내가 해야 할 HR 업무는 무엇인가 | 입력·신청·확인 |
| 팀 | 조직장/승인자 | 내 팀에서 판단이 필요한 것은 무엇인가 | 검토·승인·코칭 |
| 운영 | HR/근태/급여/성과 운영자 | 마감과 예외를 막는 것은 무엇인가 | 대량처리·해소·마감 |
| 설정 | HRIS 제품 관리자 | 다음 효력일에 어떤 규칙이 적용되는가 | 설계·시뮬레이션·게시 |
| DWP 관리자 | 보안/플랫폼/감사 | 누가 어떤 HRIS 능력과 데이터를 통제하는가 | 자격·권한·감사·확장 통제 |

이 작업면은 현행 DWP의 `hcm.personal`, `hcm.team`, `hcm.operations`, `hcm.management` 구조를 확장한다. 각 작업면과 메뉴는 UI의 `HRIS 앱 권한` 아래 access package가 부여한 capability 결과로 projection한다. 현재 기술 canonical은 `APP.HCM`, `APP.HRIS`는 compatibility alias다. SKKF의 수백 개 route를 모두 1차 navigation item으로 노출하지 않는다. 자주 쓰는 업무 여정은 메뉴로, 상세·팝업·step은 해당 업무 내부 route로 둔다.

## 2. 목표 메뉴 전체 목록

아래는 workbench 내부 task navigation과 기능 카탈로그다. 설치되지 않은 국가팩/모듈과 권한 없는 기능은 보이지 않으며, 이 표의 각 행을 sidebar에 그대로 노출하지 않는다.

### 2.1 개인 업무

| 1차 메뉴 | 2차/주요 기능 | SKKF 역량 대응 | DWP 현행 |
|---|---|---|---|
| HRIS 홈 | 할 일, 승인대기, 근태/휴가/급여 알림, 일정 | 포털/위젯/알림 | 홈 존재, 확장 |
| 내 프로필 | 기본정보, 연락처, 주소, 가족, 학력·경력·자격, 병역·보훈·장애, 계좌, 개인정보 동의 | HRM employee/person 상세 | 일부 존재, 확장 |
| 고용 및 문서 | 고용관계, 배치, 계약서, 발령이력, 서약, 전자문서 | 계약·발령·서약 | 신규/확장 |
| 내 근태 | 출퇴근, 근무표, 시간입력, 예외소명, 연장/휴일근무 신청, 월 현황 | TIM 개인 근태 | 기본 존재, 재구축 |
| 휴가 | 잔액, 발생/사용 내역, 신청/취소, 증빙, 팀 캘린더 | TIM 휴가 | 기본 존재, 원장 확장 |
| 급여 및 세무 | 급여명세, 지급계좌, 원천징수, 연말정산, 퇴직 추계/문서 | PAY/YEA/RET 개인 | 명세 참조 존재, 확장 |
| 목표 및 평가 | 목표수립, 자기평가, 다면평가, 피드백, 면담, 결과 | PER | 목표 기초 존재, 확장 |
| HR 요청 | 정보변경, 가족변경, 재직/경력증명, 퇴직/복직 등 신청과 상태 | HRM 변경요청/증명 | 서비스 기초 존재, 확장 |

### 2.2 팀 업무

| 1차 메뉴 | 2차/주요 기능 | 필요한 통제 |
|---|---|---|
| 팀 홈 | 인원, 신규입사/이동, 근태·휴가, 목표 진행, 판단 대기 | 팀/조직 scope |
| 팀원 | 팀 디렉터리, 배치·계약 종료, 자격/스킬, 변경 제안 | 필드그룹 마스킹 |
| 팀 근태 | 근무표, 누락·이상, 연장근무, 일/월 제출과 승인 | 본인 기록과 승인 분리 |
| 팀 휴가 | 팀 캘린더, 잔액 영향, 중복/인력 경고, 승인 | 민감 사유 최소 노출 |
| 인사 변경 | 이동·겸직·직무·근무지·계약 변경 요청 | impact preview, HR 승인 |
| 팀 성과 | 목표 승인, 평가, 다면 요청, 면담, 피드백 | 평가자/공개시점 정책 |
| 위임함 | 위임받은 승인, 만료, 충돌 | 명시적 위임 및 감사 |

관리자에게 급여 상세나 민감 개인정보를 직급만으로 자동 공개하지 않는다. 각 데이터 필드그룹과 목적, 대상집단을 별도 policy로 평가한다.

### 2.3 HR 운영 — 인사/조직

| 메뉴 | 주요 기능 |
|---|---|
| 운영 홈 | 예정 입퇴사, 미완료 발령/계약, 데이터 품질, SLA, 연계 오류 |
| 사람 | 인물 검색, 중복 후보, 개인정보, 가족/학력/경력/자격, 문서 |
| 고용관계·배치 | 입사, 재고용, 겸직, 주/부배치, 계약, 근무조건, 종료 |
| 발령 | 발령안, 대상자, 일괄 발령, 검증, 승인, 게시, 취소/정정 |
| 조직·포지션 | 법인/사업장/조직/직무/직급/포지션, as-of, 시나리오 |
| 계약·보상기준 | 근로/연봉 계약, 보상 basis, 대상과 만료, 전자서명 |
| 직원변경 요청 | 변경 요청 queue, 증빙, 차이 비교, 승인/반려, 적용 결과 |
| 증명·문서 | 증명서 발급/진위, 양식, 직인, 문서 batch, 보존 |
| 퇴직·복직 | 종료/퇴직/해고/복직 case, checklist, 연계 상태 |
| 데이터 품질 | 누락·충돌·유효일 중복·참조 오류, stewardship queue |

### 2.4 HR 운영 — 근태/휴가

| 메뉴 | 주요 기능 |
|---|---|
| 근태 Command Center | 기간 상태, 수집/해석/승인/마감 진행, blocker, SLA |
| 근무계획 | 근무제/교대, schedule 배정, 캘린더, 변경·시뮬레이션 |
| 타각 수집 | 원천별 수집, 중복/순서 오류, 격리, 재처리 |
| 근태 해석 | 규칙 버전, 해석 결과, 지각/조퇴/결근/연장/휴일, trace |
| 예외 처리 | 누락, 겹침, 한도초과, 소명, 일괄 정정 제안 |
| 일 마감 | 조직/대상 진행, blocker, 승인, close/reopen |
| 월 마감 | 집계, 급여 인계, freeze, 재개방, 재산정 영향 |
| 휴가 운영 | 신청 queue, 대량 등록, 잔액/거래, 증빙, 장기휴가 |
| 발생·소멸 실행 | accrual run, carryover, expiration, dry-run, 대사 |
| 근태·휴가 리포트 | 근로시간, 휴가, 예외, 법정 한도, 반출 |

### 2.5 HR 운영 — 급여/법정

| 메뉴 | 주요 기능 |
|---|---|
| 급여 Command Center | 기간 checklist, 입력 잠금, 계산/검증/승인/지급/전표 상태 |
| 급여 대상 | 대상자, 입퇴사/휴직, off-cycle, 제외/보류와 근거 |
| 급여 입력 | 고정/변동 항목, 근태 인계, 일괄 업로드, validation |
| 계산 실행 | preview, 계산 graph, worker별 상태, 실패 격리, 재실행 |
| 검증·대사 | 전월/예상 차이, 총액, 항목, 음수/이상치, 승인 checklist |
| 소급·정정 | retro event, 영향기간, 재계산, 차액, reversal/correction |
| 급여 결과 | worker/항목/조직/법인 결과, formula trace, 확정 snapshot |
| 지급 | 계좌 validation, payment instruction, 은행파일, 지급 대사 |
| 회계 | 계정/코스트센터 mapping, GL preview, posting, 대사/역분개 |
| 명세서 | 생성, 게시, 알림, 재발급, 조회 감사 |
| 세금·사회보험 | 신고 basis, 산출, 파일, 결과/오류, 정산 |
| 퇴직급여 | 추계, 대상, 계산, 지급/신고, 정정 |
| 연말정산 | 대상/자료수집/검증/계산/신고/결과/정정 case |
| 급여 리포트 | 법정/경영/운영 보고, 통제된 export |

### 2.6 HR 운영 — 성과

| 메뉴 | 주요 기능 |
|---|---|
| 성과 Command Center | 주기 단계, 참여율, 미완료, 보정 상태, 공개 준비 |
| 목표 주기 | 목표 template, 조직 cascade, 수립/승인/변경 |
| 평가 운영 | 평가군, 대상, 평가자, 일정, 단계, 예외 |
| 평가표·척도 | section/item/weight/scale, 버전, simulation |
| 다면·설문 | 후보/확정, 익명정책, 문항, 응답, 최소응답 기준 |
| 면담·피드백 | schedule, 양식, 기록, 공개/비공개 구분 |
| 보정 | 분포, 조직 비교, 제안, 근거, 승인, 변경 감사 |
| 결과 | 확정, 공개, 이의제기, export, 이력 |

### 2.7 HRIS 설정

| 설정 그룹 | 메뉴 |
|---|---|
| Enterprise | 법인/고용주, 사업단위, 사업장, 조직유형, 번호체계 |
| 기준정보 | 코드셋/값, 다국어, 사유, 통화/단위, 지역, 공휴일/캘린더 |
| 사람/고용 | 인물번호, 고용형태, 배치/발령유형, 계약유형, 필드 구성 |
| 근태 | 근무제, shift, 타각원천, 해석규칙, 연장/휴일, close policy |
| 휴가 | 유형, 자격, 발생/소멸/이월, 사용순서, 증빙, 한도 |
| 급여 | 급여그룹, 달력/기간, 항목/분류, 산식, balance, 반올림, 소급 |
| 법정 | jurisdiction, 세율, 보험, 퇴직, 연말정산 pack |
| 성과 | 주기, template, 평가군/평가자, 척도/배점, 보정/공개 |
| 워크플로 | 승인정책, 위임, SLA, 알림, 예외 escalation |
| 문서/커뮤니케이션 | 문서·인쇄·메일·알림 template, 직인/전자서명 |
| 연계 | connector, mapping, schedule, reconciliation, retry |
| 확장 | custom field, rule, webhook, 설치된 extension pack |
| 운영 | job 실행, exception, 설정 이력, health, usage |

### 2.8 DWP 관리자에 추가/연결할 메뉴

| 기존 관리자 영역 | 추가할 메뉴 | 이유 |
|---|---|---|
| Experience | HRIS 표시명·브랜딩·locale 기본값 | 전 제품 경험 소유 |
| Identity | HRIS persona/role bundle, target population, field access, SoD | 중앙 신원·권한 소유 |
| Platform | HRIS entitlement, country pack catalog, schema registry | 설치와 계약 소유 |
| Integrations | HRIS endpoint/secret/certificate, 허용 목적지 | 비밀과 연결 거버넌스 |
| Governance | HRIS audit bundle, 민감 export, retention/legal hold | 조사·컴플라이언스 소유 |
| 새 Extensibility | 확장팩 검토/서명/호환/중지/철회 | 고객 코드 격리 |

급여항목, 휴가발생식, 근무제처럼 HR 지식이 필요한 설정을 전사 super-admin 메뉴로 올리지 않는다. DWP 관리자는 누가 어떤 scope에서 설정할 수 있는지를 통제하고, HRIS 관리자는 업무 설정의 내용을 관리한다. 앱 권한 아래에는 `HRIS_EMPLOYEE`, `HRIS_LINE_MANAGER`, 인사/근태/휴가/급여/성과 운영, 설정 Designer/Publisher, Auditor 그룹을 제공해 필요한 그룹만 조합한다. 급여 Maker/Checker, 설정 Designer/Publisher, 운영자/Auditor는 직무분리하며 상세 계약은 `authorization-blueprint.md`를 따른다.

## 3. SKKF 메뉴를 DWP 메뉴로 재편하는 규칙

| SKKF 패턴 | DWP 처리 |
|---|---|
| 목록/등록/상세가 각각 route | 한 개 list-detail workflow와 mode로 통합 |
| 사용자와 관리자 화면의 중복 | 동일 domain model, persona별 action projection |
| 공통코드/메뉴/프로그램 중심 설정 | capability, policy, typed config 중심으로 전환 |
| 사별 화면 또는 route | tenant config/extension으로 격리 |
| popup/Excel 중심 batch | receipt 기반 async workflow와 결과 inspector |
| 별도 승인 구현 | DWP Approval case에 연결 |
| 별도 알림/메일/파일 | DWP 공통 서비스 사용 |
| 테이블 직접 수정형 설정 | draft/version/simulation/publish lifecycle |

## 4. 대표 화면 설계

### 4.1 HRIS 홈

하나의 상단 질문은 “지금 내가 처리해야 할 일은 무엇인가”다.

- 상단: 오늘/이번 기간의 3~5개 우선 action
- 본문: 내 근태, 휴가, 최근 급여, 목표 진행을 요약하되 클릭 시 업무로 이동
- 관리자에게는 같은 페이지를 억지로 확장하지 않고 팀 홈 링크와 pending count 제공
- 데이터 지연/일부 실패 시 마지막 갱신 시각과 재시도, 영향을 받은 영역을 명시

### 4.2 운영 목록

안정적인 3영역을 사용한다.

```text
┌────────────────────────────────────────────────────────────┐
│ 제목 · 기간/scope · 상태 · 핵심 행동                       │
├──────────────┬───────────────────────────────┬─────────────┤
│ 저장 필터     │ 운영 테이블                   │ Inspector   │
│ 예외/상태     │ 정렬·선택·대량행동             │ 상세/이력    │
└──────────────┴───────────────────────────────┴─────────────┘
```

- 필터와 열 상태를 URL 또는 saved view로 보존
- empty/loading/partial/error/stale/no-access 상태를 별도 설계
- 대량 행동 전 선택 scope와 영향 건수 고정
- Inspector는 결과, 근거, 변경 이력, 관련 승인과 event를 함께 표시

### 4.3 급여 Command Center

단순 dashboard가 아니라 통제된 실행 화면이다.

1. 기간과 급여그룹 선택
2. 입력 source와 cutoff 상태 확인
3. 대상/입력 validation
4. preview calculation 실행
5. 차이와 exception 해소
6. maker 제출, checker 승인
7. 결과 freeze/publish
8. payment/GL handoff와 reconciliation

각 단계는 `not started / running / attention / ready / approved / posted / reversed` 상태와 owner, 시작/완료시각, blocker를 갖는다. 재실행은 기존 run을 덮지 않고 새 attempt를 만든다.

### 4.4 근태 월마감

- 조직 tree와 대상집단별 준비율
- 미제출/미승인/타각누락/한도초과 blocker
- 해석 규칙 버전과 마지막 재계산 시각
- 마감 영향: 급여로 넘길 시간/수당 집계
- close 전 preview와 표본 확인
- reopen 시 사유, 승인, 영향을 받는 급여 run 표시

### 4.5 설정 Studio

```text
┌──────────────────────────────────────────────────────────┐
│ 설정명 · 상태(Draft) · 효력일 · 버전 · 대상 scope         │
├───────────────────────┬──────────────────────────────────┤
│ 구조/규칙 편집         │ 검증 · 시뮬레이션 · 변경 차이      │
│ 버전/상속              │ 영향 인원/금액/기간 · 오류         │
├───────────────────────┴──────────────────────────────────┤
│ 저장 → 검증 → 승인 요청 → 예약 게시                      │
└──────────────────────────────────────────────────────────┘
```

- 현재 유효 버전과 draft를 항상 나란히 비교
- 샘플 직원/기간 또는 익명 dataset으로 시뮬레이션
- 영향받는 인원/급여run/마감기간/연계 표시
- 즉시 게시보다 예약 효력일을 기본값으로 사용
- 이미 사용된 버전은 삭제하지 않고 retire

## 5. 위험도별 상호작용 정책

| 위험 | 예 | UX 요구 |
|---|---|---|
| 낮음 | 개인 연락처 초안 | inline validation, undo |
| 중간 | 팀 휴가 승인 | 잔액/인력 영향, 사유, 감사 |
| 높음 | 발령 게시, 근태 월마감 | scope lock, preview, 승인, recovery plan |
| 매우 높음 | 급여 확정·지급파일·법정신고 | step-up, maker-checker, immutable bundle, reversal only |

고위험 행동에는 다음 6개를 모두 보인다.

1. 대상 tenant/legal entity/pay group/기간
2. 사용한 데이터와 규칙의 freshness/version
3. 영향 건수와 금액
4. blocker/warning과 예외 승인
5. 승인자와 직무분리 상태
6. 실패 시 재시도·취소·역분개·복구 경로

## 6. 반응형·접근성 정책

- 직원 self-service와 승인 queue는 320/390px에서 완전 사용 가능
- 급여 설정/대량 마감은 desktop-first이나 모바일에서 상태·blocker·승인 여부는 안전하게 조회
- 테이블은 작은 화면에서 중요 필드 순 카드/행 요약과 inspector로 전환
- 색만으로 상태를 표시하지 않고 icon+text+ARIA 제공
- keyboard로 filter, table row, inspector, dialog, approval을 완료 가능
- 200% zoom, 긴 한국어/영어/숫자, 고대비, dark/light, reduced motion 검증
- 주민식별·계좌·급여는 화면 캡처/복사 방지 자체를 보안으로 간주하지 않고 권한·마스킹·감사를 기본으로 적용

## 7. 메뉴·화면 검증 시나리오

| Persona | 반드시 성공할 여정 | 반드시 실패할 여정 |
|---|---|---|
| 직원 | 본인 근태/휴가/명세 조회와 신청 | 타인 급여 URL 직접 접근 |
| 관리자 | scope 내 팀 승인 | 이전 조직/타 법인 데이터 검색 |
| HR 운영자 | 배치 변경안 제출 | 급여 민감필드 조회 권한 없는 접근 |
| 근태 운영자 | 월마감과 승인된 reopen | 확정기간 entry 직접 update |
| 급여 Maker | 계산·검증·제출 | 자기 run 최종 승인/지급 |
| 급여 Checker | 근거와 차이를 보고 승인 | 승인 전 은행파일 생성 |
| HRIS 설정자 | draft/시뮬레이션/승인요청 | 게시 버전 직접 수정 |
| 감사자 | 증적 조회 | 업무데이터 변경 |

## 8. 프로토타입 우선순위

개발 전에 다음 5개 화면을 실제 데이터 형태로 prototype하고 HR SME 사용성 검증을 권고한다.

1. HRIS 개인 홈
2. 직원 360° list-detail와 민감 필드 접근
3. 근태 월마감 Command Center
4. 급여 계산·검증 Command Center
5. 급여항목/근태규칙 설정 Studio

이 다섯 화면은 DWP 셸의 장점을 보존하면서 SKKF식 화면 복제를 피할 수 있는지, 권한·scope·효력일·대량처리·고위험 승인 패턴이 실제로 작동하는지를 가장 빨리 검증한다.
