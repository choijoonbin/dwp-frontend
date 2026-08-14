# DWP-R1-HR-001 Role-aware DWP HCM

> 상태: `in-development`
>
> 기준일: 2026-08-14
>
> Owner: People Product, People Platform, Security

## 목적

구성원, 실제 Line Manager, 위임받은 HR 도메인 관리자에게 하나의 DWP HCM 제품 Shell을
제공하되 데이터와 명령 권한은 업무별로 분리한다. DWP는 직원 경험과 승인 가능한 업무
흐름을 소유하고, 고객 Payroll·Benefits·Learning System of Record의 민감 원장은 참조와
연계 계약으로 유지한다.

## 현재 구현 범위

| 영역     | Local Baseline                                                                 | 고객 출시 Gate                         |
| -------- | ------------------------------------------------------------------------------ | -------------------------------------- |
| 개인 HR  | 프로필, 근태 기록·예외·제출, 휴가 조회·신청·철회, Benefits·Pay·Talent, HR 도움 | 고객 HRIS 필드·보존·마스킹 계약        |
| Manager  | 실제 보고 관계 기반 팀 근태·휴가 Queue, 승인·반려, 향후 팀 부재                | 대결·다단계 승인·노무 정책             |
| HR 운영  | TIME·ABSENCE·BENEFITS·PAY·TALENT 독립 권한과 운영 상태                         | 국가별 정책, 운영 규모·SoD 승인        |
| 데이터   | `ppl_*` Core HR 참조 + `tme_*`, `abs_*`, `bnf_*`, `pay_*`, `tal_*` 분리        | 고객 Source Mapping·Reconciliation SLA |
| 거버넌스 | Tenant FK, Version, 중복 방지, 철회 근거, 공통 Service Request, Audit Outbox   | SIEM·KMS·문서 저장소·Payroll Connector |

Reference Seed는 `dataOrigin=REFERENCE`로 명시한다. 실제 고객 데이터처럼 표시하거나
출시 증거로 간주하지 않는다.

## 산출물

- [기획 정의](01-기획%20정의.md)
- [화면 설계서](02-화면%20설계서.md)
- [디자인 정의](03-디자인%20정의.md)
- [데이터 설계](04-데이터%20설계.md)
- [API 권한 계약](05-API%20권한%20계약.md)
- [AI Agent 계약](06-AI%20Agent%20계약.md)
- [수용 테스트](07-수용%20테스트.md)

## 관련 결정

- `R1 DWP HCM Product Shell 및 Role-Aware Experience ADR.md`
- `R0 멀티테넌트 Workforce Projection 및 HRIS 연계 ADR.md`
- `R1 Effective Organization Graph 및 People Directory ADR.md`
- `R1 Multi-Surface Personal Home Composer ADR.md`
