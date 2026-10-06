# 전체 코딩 착수 준비와 구현 완료의 경계

상태: **경계 정정 / 현재 G3 CLOSED**. 이 문서는 준비 완료 승인이나 Gate 예외가 아니다. 사용자 목표는 철저히 설계·검증된 다섯 모듈의 전체 개발을 시작하는 것이며, 개발 착수 전에 전체 업무 기능 구현을 이미 마칠 것을 요구하는 순환 조건을 만들지 않는다.

| 단계 | 그 단계에서 실제 필요한 것 | 이 단계로 앞당기지 않는 것 |
| --- | --- | --- |
| G0 공통 기반 | 현재 clean paired baseline, 분리 작업폴더·toolchain·실행/병합 소유권, 공통 보안·DB/Control 경계, 현재 코드 전체 검사·기존 pilot 회귀·공통 runtime smoke·실행 자원 검증 | 모듈의 모든 신규 업무 CRUD를 미리 구현 |
| G3 전체 코딩 준비 | 전체 업무 범위의 유지/통합/재설계/제외 판단, exact API/query/response/event·planned physical SQL·상태·실제 업무 내용·typed source/refetch·권한/SoD/개인정보·migration 예약·의존/파일 소유권, 구체 synthetic 입력/기대값·전체 test 배정, 공통 owner DTO/SPI 및 fail-closed adapter scaffold와 consumer compile, 독립 설계 검증 | 아직 구현하지 않은 전체 신규 API/SQL/여정을 이미 운영처럼 실행해 PASS 요구 |
| G4 모듈 구현·수용 | 모듈 owner가 전체 업무 코드·migration CREATE·운영 설정/관측/복구를 구현하고 actual API→row/artifact→event/receipt→query/refetch, 합성 설정 A/B·권한/tenant/중복/정정/취소·동시성/장애의 실제 실행을 검증 | 제안서의 구조 self-check나 기대값 산술을 실제 기능 PASS로 처리 |
| G5 디자인 인계·교체 | G4 완성된 모든 메뉴/화면/page/tab/dialog/drawer/wizard/report/document 및 모든 persona/state의 Design AI 프롬프트·파일 패키지 작성, 승인된 디자인 교체·접근성/회귀 | 디자인으로 데이터/상태/권한 결함을 해결했다고 처리 |
| G6 고객 운영 활성화 | 실제 고객 identity authority/bootstrap, 운영 데이터 adoption/cutover/UAT, 국가 법정팩 및 ERP/은행/세무/보험/타각 provider 계약·자격/보안/법무/급여 검증 | 실제 고객 자료·운영 책임자 승인·법정값을 G3의 신규 공통 내부 설계 대신 요청 |

## 반드시 G3에서 닫는 문제

- 업무 객체 ID를 trace UUID로 채우거나 input digest만 받고 실제 내용을 잃는 설계는 G4에서 알아서 해결할 문제가 아니다. exact typed 입력/column 또는 refetch 가능한 owner artifact, complete response/event source와 entity ID 공간을 지금 정의한다.
- Catalog와 assignment/application/result는 다른 객체이며 생성·전이·거절·취소·정정·비동기 완료 경로가 도달 가능해야 한다. worker callback은 등록된 owner 내부 행위이며 client가 성공을 임의 확정하는 endpoint가 아니다.
- 공유 owner 계약은 이름만 제시하지 않는다. DTO/schema/version, tenant/principal/purpose/duty/population/field/asOf 검증, refetch·에러·stale·replay 규칙, transport와 producer/consumer 파일·test 배정을 게시한다. 미구현 domain adapter는 명시적으로 fail closed하며 dummy payload/success receipt를 만들지 않는다.
- DWP principal과 HRM worker/employment 신원 연결의 계약 및 안전한 test authority를 정의한다. 실제 고객의 신원 원천/전환 운영 승인은 G6다. 이를 이유로 client worker UUID를 자기 신원으로 신뢰하지 않는다.
- 실제 점유한 migration 버전을 다시 예약하지 않는다. 역사 G2 SQL blob 보존과 현재 공통 추가 SQL inventory를 분리해 비충돌 successor 예약을 게시한다.
- 합성 fixture는 exact typed 요청과 실제 값/행/이벤트/상태/오류 기대값을 갖는다. 단계별 미실행 상태를 유지한다. G3의 독립 설계/fixture 검사와 G4의 실제 domain 실행은 서로 대체하지 않는다.
- SYS configuration/Insights 저장·role/purpose 및 공통 tenant batch/interface 경계를 준비한다. 신규 schema/bootstrap 설계와 shared routing/ACL 준비가 필요하지만 실제 모든 batch/connector 업무 실행은 owner 구현 후 검증한다.

## 현재 판정

HRM/PER/SYS·TIM remediation proposal은 historical 정본을 대체하지 않는다. exact successor의 전수 source/상태/테이블/권한/owner contract·allocation 통합과 독립 검증이 아직 OPEN이므로 G3를 열지 않는다. 현재 공통 코드 전체 suite 및 새 Control reference의 runtime/session 봉인도 별도 검증 중이다.

이 경계 정정은 현재 필요한 설계·공통 준비를 생략하거나 감사 지적을 G4로 미루는 예외가 아니다. 각 지적의 닫는 증거를 알맞은 단계에 배치하여 준비와 구현을 선후관계에 맞게 수행한다.
