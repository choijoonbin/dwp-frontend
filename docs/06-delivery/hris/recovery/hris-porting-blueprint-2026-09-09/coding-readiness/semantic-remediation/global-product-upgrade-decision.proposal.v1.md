# 글로벌 HRIS 대비 제품 고도화 판단 — 2026-09-14

상태: PRODUCT_REVIEW_INPUT_NOT_CANONICAL / G3_CLOSED. 기존 독립 감사나 source→target 등록을 대체하는 승인서는 아니다. SKKF 기능의 범용 필요성과 DWP 제품 판단을 구분한다.

## 최신 공식 제품 자료에서 확인한 것과 DWP 판단

Oracle의 현재 제품 설명은 Core HR·Talent·Workforce 영역을 연결하되 독립 SKU·단계별 도입을 허용하고, 설정형 workflow·localization·API 확장을 설명한다. 이는 **연결된 기반+선택 설치** 방향의 참고 근거다. 모든 vendor 기능을 모든 고객에게 의무 제공하거나 vendor 화면·DB를 복제하라는 근거는 아니다. [Oracle Human Resources](https://www.oracle.com/human-capital-management/human-resources/)

Talent 제품에는 목표·성과·지속적 check-in/feedback, 학습·스킬·내부 이동·승계·보상이 포함된다. 이를 DWP의 확장 범위로 삼는 것은 제품 판단이며 각 메뉴의 필요성을 자동 인증하지 않는다. [Oracle Talent Management](https://www.oracle.com/human-capital-management/talent-management/)

Workday는 중요한 의사결정의 인간 통제, 설명·대체 검토 절차, 사용자 AI 고지, 개발 및 배포 단계의 위험 점검을 명시한다. DWP AI는 초안·설명·요약·추천 보조로 제한하고 결정·지급·게시를 대신 확정하지 않는 방향으로 설계한다. [Workday Responsible AI Practices](https://www.workday.com/en-us/artificial-intelligence/responsible-ai-practices.html)

자료 확인일: 2026-09-14. 위 판단은 vendor 기능소개에 대한 제품적 해석이다. HR 법률·국가별 급여 적법성, 성능 또는 보안 인증이 아니다. Date-effectivity 문서의 이번 재조회는 timeout이므로 새 확인 증거로 계산하지 않는다.

## SKKF 행동의 엄선 기준

각 source 행동에는 다음 중 하나의 disposition과 target 업무 여정, 유지할 업무 의미, 없앨 입력·승인·조회 반복, 국가/회사 경계, 권한·데이터·예외 및 시험을 연결한다. `RESOLVED_G2_CONTRACT`나 source count 일치는 의미 검증 완료가 아니다.

| 처리 | 적용 판단 | 구현 책임 |
|---|---|---|
| 코어 유지·재설계 | 직원/고용·조직·변경 이력, 시간·휴가, 급여 계산·정정·명세, 목표·평가 및 ESS/MSS의 유효 업무 | 명시 typed 입력·실제 저장·효력/상태·권한·receipt/event·조회 여정 |
| 통합 | 같은 객체의 중복 검색/등록/수정/승인/증빙 화면, 기관·근무제별 유사 화면 | task 중심 workbench의 목록/상세/탭/문맥 행동. 단, 서로 다른 aggregate 생애주기나 권한을 하나로 혼합하지 않음 |
| 설정형 | 근무제·급여군·평가주기·대상자·승인·문서·조직 분류 | 효력 있는 버전 설정+검증/시뮬레이션/승인/게시. 하드코딩·임의 executable text 금지 |
| 국가팩 | 세금·보험·퇴직 및 국가 고유 휴가/신고 | signed country pack의 exact ABI/입출력/규칙. 샘플 결과와 실제 법정 검증 분리, real activation G6 |
| 선택 확장 | ATS/온보딩, benefits, HR service, contingent, WFP, skills/growth/learning/marketplace/succession/compensation, WFM/listening/analytics/AI | 현재 선택된 개발범위는 설계하되 capability 미설치 고객에게 화면·데이터 접근·실행 의존을 강제하지 않음 |
| 제외 | BENSK/ADDSK, 고객 전용 legacy 분기·기술 중복·의미 없는 내부 프로그램 단계 | source trace·제외 사유 보존. 신규 범용 benefits와 제외된 BENSK를 혼동하지 않음 |

## 각 모듈의 필수 업그레이드 기준

| 세션 | 최적화된 업무 구성 | 기존 나쁜 패턴의 개선 및 착수 전 확인 |
|---|---|---|
| HRM | People 360, 조직/고용/배정의 효력 이력, 변경 신청·발령, 계약/증명/퇴사·재입사, 인사 운영 | 기존 DWP 신원 chain 재사용 여부 검증; 복수 고용 선택/유효일자/퇴사 접근을 명시. person·worker·assignment UUID 혼용, 현재값 덮기·조회 중 임의 변경 금지. 입사·이동·퇴사·복귀의 typed event/owner 입출력 |
| PER | 목표·진행/대화·feedback·평가·조정·결과/이의 및 선택 talent | 평가주기/목표/배정/개별 결과/조정 객체 분리. 전사 일괄 상태로 개별 완료를 덮지 않음. 고정 대상자·policy·실제 이전값 owner refetch, evidence/consent/제한 대상 권한 |
| TIM | 근무계획·시간기록/해석·timecard·초과근무·휴가 계획/권리/신청·마감/급여 인계 | native 일정 작성→검증→승인→게시→정정; 실제 WORK/BREAK와 paidness·시간대/DST·per-worker rule/calendar. typed AST/단위/반올림, 불변 run 입력·재시작/부분취소·append-only 권리 원장, LOCKED timecard≠CLOSED period |
| PAY | 급여 기반/항목/규칙·직원 입력·정기/비정기/소급 run·결과/trace·승인/확정·지급/회계·명세·퇴직/YEA | digest-only 기반설정·run/결과 제거. money/currency/unit typed 계약, 실제 고정 입력·정정 차이, 지급 UNKNOWN reconciliation/중복 지급 차단. 퇴직/YEA를 generic 계산 endpoint 하나에 매핑했다는 이유로 완료 처리하지 않음 |
| SYS | DWP 앱 권한/access package·공통 설정·workflow/문서·batch/connector 운영·홈 구성 및 보호된 확장 | 별도 HRIS 권한 체계/앱별 scheduler 복제 금지. owner duty/population/fields/purpose/SoD; allowlisted typed job/adapter 및 secret ref. 익명 ingestion/issuer/insights 분리, migration 권한 없는 runtime-only 기동, 미설치 capability fail-closed |

HRIS 홈은 인사·근태·급여·성과의 허용된 핵심 값/상태/기한/다음 행동 widget이며 전체 메뉴 카탈로그가 아니다. 사이드바는 홈 및 7 workbench로 유지하고, 전체 엄선 메뉴는 workbench 탐색·task group·상세에 노출한다. 메뉴 visibility는 owner API 권한을 대체하지 않는다. UI 시각 디자인은 G4 기능 후 G5A의 전체 화면 Design AI 프롬프트·파일 패키지로 인계한다.

## 보편성·확장성의 실제 판정

- Core→Country Pack→Tenant Config→Signed Extension의 단방향 공개 경계. 고객별 core fork/회사명 조건문·cross-schema SQL join·공유 unrestricted DB account 금지.
- 필수와 선택은 화면뿐 아니라 install/admission·dependency·owner invocation·DB 권한·운영 배포까지 일치해야 한다. no-skill WFM에 PER를 강제하거나 analytics/AI에 listening을 강제하지 않는다.
- 배치·외부연계 설정은 테넌트 공통 관리자 영역. 업무 결과·실행/복구 권한은 해당 owner가 판정하며 지급·확정 재실행을 범용 retry와 혼동하지 않는다.
- 프로토콜·등록 enum·공개 schema와 안전한 크기/복잡도 bound는 제품 불변조건이다. 법정 수치·근무일/급여/평가 정책은 versioned optional 설정이며 둘을 혼동하여 모든 안전 한도까지 사용자 설정으로 만들지 않는다.
- source 메뉴별 통합/제외 결정을 actual child 행동까지 추적해야 한다. 기존 86가족/2,269부모/10,001자식 등록은 구조 증거이고, 전체 행동의 사업 의미가 검증됐다는 증거는 아니다.

## 아직 준비 완료가 아닌 이유

현재 독립 감사의 의미/source·업무 생애주기·BASE exact 계약 지적, DWP identity/owner 계약 재사용·게시, canonical successor와 migration 예약, 실제 공통 startup/producer/consumer 배선 및 최신 실행·capacity 증거가 미완료다. 이 문서를 작성하거나 최신 제품과 기능명을 맞추어도 G3는 열리지 않는다. 현재 정본 2,007개 의미 오류는 후속 설계의 정본 통합·전수 독립 검증 전까지 남아 있다.

현재 사용자가 추가로 결정해야 해결되는 착수 차단으로 분류하지 않는다. 내부 설계·구현·감사 해소를 마친 뒤 현재 authoritative live/published PASS에 근거해서만 모듈 전체 개발 준비 완료를 보고한다.
