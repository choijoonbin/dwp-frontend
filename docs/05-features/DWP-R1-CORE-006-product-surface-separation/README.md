# DWP-R1-CORE-006 Product Surface Separation

- Owner: Shared Experience Platform
- Co-owner: Identity & Access, Approvals, HCM
- 상태: `design`
- Gate: `G2 complete / G3 approval pending`
- Roadmap: R1 Common Experience Foundation
- Pilot: Approvals `W1a`, HCM `W1b`
- Technical Canary: Communications·Services `W0.5`
- 기준일: 2026-08-21

## 산출물

- [기획 정의](01-기획%20정의.md)
- [화면 설계서](02-화면%20설계서.md)
- [디자인 정의](03-디자인%20정의.md)
- [데이터 설계](04-데이터%20설계.md)
- [API 권한 계약](05-API%20권한%20계약.md)
- [AI Agent 계약](06-AI%20Agent%20계약.md)
- [수용 테스트](07-수용%20테스트.md)
- [Pilot 구현 설계](08-Pilot%20구현%20설계.md)
- [Pilot 권한 Fixture](09-Pilot%20권한%20Fixture.md)
- [Pilot 권한 Registry Seed](10-Pilot%20권한%20Registry%20Seed.md)
- [공통 ADR](../../03-architecture/R1%20제품%20업무·관리%20Surface%20분리%20및%20관리%20Context%20ADR.md)
- [전체 메뉴 분류표](../../03-architecture/R1%20제품%20Surface%20전체%20메뉴%20분류표.md)

## 현재 판정

공통 IA, Route·Shell·Navigation 계약, Effective Product Surface Context, 권한 실패 상태,
Approvals/HCM Pilot, Test Matrix와 Rollout·Rollback 기준은 개발 Issue로 분해할 수 있는 수준으로
완료했다. 아직 코드는 변경하지 않았고 본 문서와 ADR은 사용자 승인 전 `Accepted`로 표시하지
않는다.

G3 착수 전에는 ADR·169개 메뉴표와 ADR `PS-01`~`PS-11` Decision Register를 승인한다. 핵심
승인 Package는 다음과 같다.

1. Bound `EffectiveProductSurfaceContext`·Direct Evaluation·Capability Registry
2. Responsibility AND Capability 기본값과 기존 Permission-only 관리자 Migration
3. Tenant Admin Legacy Oversight의 Capability·Route·API·Field·Scope Allowlist와 Sunset
4. Product Root, Scope Selection, Composite Decision Revision·Trusted Context·다중 Tab Invalidation
5. Exact Action과 Legacy `MANAGE` Compatibility Delta
6. HCM Org Design·Export, Target Population, Support Exclusive Mode
7. Tenant-only JIT, Scope-bound SoD와 Step-up Freshness Policy
8. Named Reviewer Assigned Work와 UX Telemetry·Privacy 계약

각 항목의 제안 기본값과 Test는 이미 고정되어 있다. Owner 승인 후 별도의 제품 방향 재설계 없이
구현을 시작할 수 있다.

## 구현 순서

```text
W0 공통 계약
  → W0.5 Communications·Services Technical Canary
  → W1a Approvals Pilot
  → W1b HCM Pilot
  → W2/W3 전체 제품 Migration
```

Approvals와 HCM을 동시에 구현하지 않는다. Approvals에서 공통 Shell·Guard·Deep Link·Telemetry를
먼저 검증하고, HCM에서 관계 기반 Team, Target Population, 다중 Scope와 Support Read-only까지
통과한 뒤 솔루션 공통 계약으로 선언한다.
