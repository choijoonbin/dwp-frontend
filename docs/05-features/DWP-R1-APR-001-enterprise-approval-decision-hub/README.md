# DWP-R1-APR-001 Enterprise Approval Decision Hub

- 상태: `implemented-baseline`
- Owner: Product Platform / Workflow & Governance
- Roadmap Release: R1 Foundation, R2 Signature Extension
- Architecture: `../../03-architecture/R1 Enterprise Approval Decision Hub ADR.md`
- Research: `../../02-research/DWP 전자결재 글로벌 벤치마크 및 제품 방향 2026-08-14.md`

## 목표

HRIS·직원 서비스·구매·권한·Agent 실행 등 여러 업무 앱의 의사결정을 하나의 결재함,
일관된 Workflow와 변경 불가 증적으로 연결한다. 내부 결재는 DWP가 직접 소유하고 법적
전자서명은 전문 Provider를 연결한다.

## 산출물

- [01-기획 정의.md](01-기획%20정의.md)
- [02-화면 설계서.md](02-화면%20설계서.md)
- [03-디자인 정의.md](03-디자인%20정의.md)
- [04-데이터 설계.md](04-데이터%20설계.md)
- [05-API 권한 계약.md](05-API%20권한%20계약.md)
- [06-AI Agent 계약.md](06-AI%20Agent%20계약.md)
- [07-수용 테스트.md](07-수용%20테스트.md)
- [08-양식 카탈로그와 결재선 운영 설계.md](08-양식%20카탈로그와%20결재선%20운영%20설계.md)

## Build·Connect 결정

| 범위                                  | 결정                                   |
| ------------------------------------- | -------------------------------------- |
| 통합 결재함, 내부 Workflow, 결정 원장 | Build                                  |
| HRIS·Services·Access·ERP 원업무 반영  | Connect                                |
| 계약·외부 당사자 전자서명             | Docusign·Adobe Sign Adapter 후보       |
| 장기 실행 Timer·Retry                 | 검증된 Durable Workflow Engine Adapter |
| AI 요약·초안                          | DWP Governed Agent Runtime             |

## 2026-08-19 구현 기준선

- 개인 홈의 `전자결재` 앱에서 `/approvals/home`으로 진입하며, 결재 현황·우선 결재함·
  단계 흐름·내 요청·정책 인사이트를 개인화 가능한 위젯으로 제공한다.
- 사용자 메뉴와 설계자·게시 책임자·운영자 메뉴는 같은 Product Shell 안에서 권한별로
  분리되며 직접 URL과 API도 같은 권한 계약을 적용한다.
- 계층형 카테고리와 검색이 있는 양식 카탈로그에서 게시된 Form을 선택하고, 양식마다
  연결된 기본 결재선의 단계·후보 역할·SLA를 확인한 뒤 한영 동적 양식을 작성한다.
- 게시된 Workflow·Form Version으로 초안 생성·재조회·
  편집·상신·회수·정보 요청과 답변·다단계 진행 상태를 처리한다.
- 서버가 필수값, 날짜·숫자 유형, 선택값 Allowlist와 알 수 없는 Field를 검증한다.
- 현재 게시 가능한 단계 정족수는 역할 후보 중 한 명이 결정하는 `ANY`다. `ALL`,
  `COUNT`, `PERCENT`는 후보 Snapshot·정족수 원장이 구현되기 전에는 UI와 API에서
  활성화하지 않는다.
- API 호출은 공통 `sys_api_history`에 Route Template, 상태, 지연, Trace·Correlation을
  기록하고 결정·설계 Command는 Audit Outbox로 연결한다.
- 로컬 환경은 Auth에 활성화된 SKAX 앱 사용자 21명에게 DB 기반 요청·결재함·Timeline·
  위임 Seed를 제공한다. 읽기 요청에서 Mock 거래를 생성하지 않으며 운영 Flyway에는
  로컬 업무 Seed가 포함되지 않는다.

세부 구현·검증 상태는 [07-수용 테스트.md](07-수용%20테스트.md)를 기준으로 한다.

## G2 종료 전 필수 결정

- Workflow Engine 운영·라이선스 Spike
- 한국식 전결·대결·후결의 고객 정책과 위험 등급
- Object Storage·KMS·Malware Scan·WORM Topology
- 법적 전자서명 Provider와 지역별 규제 검토
- Pilot 대상 업무 4종과 실제 처리시간 Baseline

`implemented-baseline`은 로컬 R1 기준선이 동작한다는 뜻이며 Production Release를
의미하지 않는다. 아래 Gate와 수용 테스트의 미완료 항목을 통과해야 `released`로 전환한다.
