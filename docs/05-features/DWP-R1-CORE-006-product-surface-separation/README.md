# DWP-R1-CORE-006 Product Surface Separation

- Owner: Shared Experience Platform
- Co-owner: Identity & Access, Approvals, HCM
- 상태: `implementation complete (DRAFT / default-off)`
- Gate: `G3 technical implementation complete / technical evidence complete / activation approval pending`
- Roadmap: R1 Common Experience Foundation
- Pilot: Approvals `W1a`, HCM `W1b`
- Technical Canary: Communications·Services `W0.5`
- 기준일: 2026-08-25

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
Technical Canary, Approvals W1a와 HCM W1b Runtime, 11개 제품 Manifest·Shell·Flag 및
Rollout·Rollback 안전장치를 구현했다. Work Header에는 세부 관리 Surface 대신 단일 `앱 관리`
진입점만 표시하고, Work와 Management Sidebar는 현재 Plane의 메뉴만 투영한다. 회사 관리 센터는
Tenant Governance, 정확한 앱 접근 책임과 Preset 수명주기 오케스트레이션만 소유한다. 중앙 직접
할당 Allowlist는 `APP_OWNER`, `APP_ACCESS_MANAGER`, `APP_ACCESS_APPROVER`,
`APP_ACCESS_REVIEWER` 네 책임으로 고정한다. `APP_CONFIG_ADMIN`과 제품 전문 Role·Exact
Capability의 실제 기능 실행은 각 앱 Workbench에 남기며 회사 센터가 제품 Action을 대신 실행하지
않는다.

Rollout 상태별 사용자 경험과 인가 경계는 다음과 같이 고정한다.

| 상태  | Shell과 내비게이션                                            | 인가                         | 신규 `앱 관리` CTA | W2/W3 DRAFT Route |
| ----- | ------------------------------------------------------------- | ---------------------------- | ------------------ | ----------------- |
| `000` | 전환 전 기존 UI                                               | 기존 정책                    | 숨김               | 미등록            |
| `100` | Shadow 평가 + 기존 Compatibility UI                           | 기존 정책, 차이만 관찰       | 숨김               | 미등록            |
| `110` | 기존 업무·관리 합산 Compatibility UI                          | Exact Capability Enforcement | 숨김               | Fail Closed       |
| `111` | Work/Management 분리 UI + Work Header의 단일 `앱 관리` 진입점 | Exact Capability Enforcement | 권한자에게만 표시  | Fail Closed       |

따라서 default-off Tenant 또는 `110`에서는 기존 합산 UI가 계속 보일 수 있으며 이는 분리 UI 누락이
아니다. `110`의 합산 메뉴도 각 PAGE의 직접 결정과 대상 Scope로 투영하며, 대상에 기본값 없는 복수
Scope만 있으면 출발 화면의 Scope를 제거한 뒤 대상 Scope 선택 화면으로 이동한다. 거부·만료·불완전
Authority 항목은 노출하지 않는다. W2/W3의 Frontend DRAFT Route는 `110`과 `111` 모두에서 다음
승인 Backend Bundle에 같은 Route·Capability 계약이 들어오기 전까지 사용할 수 없다.

권한 Bundle v1~v3은 기존 바이트와 Checksum을 보존한 채 모두 `DRAFT`이고 Active Pointer는 없다.
11개 Rollout 제품 목록은 별도 Checksummed Inventory로 분리했으며 모든 Feature Flag는 기본 Off다.
HCM은 owner-service PEP, Target Population, 실 Team·Operations API, SoD와 1회용 Step-up까지 v3
계약에 결속했다. 제품 관리자 Preset은 통제면 책임의 제한적 2인 Bootstrap과 제품 전문 권한의
3단계 `요청 → 승인 → 활성화`를 분리한다. 본 문서와 Surface ADR은 실제
Product·Security·Privacy 승인 전 `Accepted`로 표시하지 않는다.

W1a 운영 활성화 전에는 ADR·169개 메뉴표와 ADR `PS-01`~`PS-11` Decision Register를 실제
Owner가 승인한다. W2/W3의 73개 Frontend DRAFT Page 계약도 제품별 Exact Capability가 다음
불변 Bundle에 승인되기 전에는 활성화하지 않는다. 핵심 승인 Package는 다음과 같다.

1. Bound `EffectiveProductSurfaceContext`·Direct Evaluation·Capability Registry
2. Responsibility AND Capability 기본값과 기존 Permission-only 관리자 Migration
3. Tenant Admin Legacy Oversight의 Capability·Route·API·Field·Scope Allowlist와 Sunset
4. Product Root, Scope Selection, Composite Decision Revision·Trusted Context·다중 Tab Invalidation
5. Exact Action과 Legacy `MANAGE` Compatibility Delta
6. HCM Org Design·Export, Target Population, Support Exclusive Mode
7. Tenant-only JIT, Scope-bound SoD와 Step-up Freshness Policy
8. Named Reviewer Assigned Work와 UX Telemetry·Privacy 계약

각 항목의 제안 기본값, 구현과 Test 증거는 고정되어 있다. Owner 승인 후 별도의 제품 방향 재설계
없이 DRAFT v2를 승격할 수 있다.

## 구현 순서

```text
W0 공통 계약 [기술 완료]
  → W0.5 Communications·Services Technical Canary [기술 완료, 외부 활성화 승인 대기]
  → W1a Approvals Pilot [기술 완료, 외부 활성화 승인 대기]
  → W1b HCM Pilot [기술 완료, 외부 활성화 승인 대기]
  → W2/W3 전체 제품 [Manifest·Shell·DRAFT Route·default-off Flag 완료, Bundle 승인 대기]
```

기술 구현이 준비되어도 Production 승격과 관찰은 Approvals → HCM → W2/W3 순서를 지킨다.
Approvals에서 공통 Shell·Guard·Deep Link·Telemetry를 먼저 검증하고, HCM에서 관계 기반 Team,
Target Population, 다중 Scope와 Support Read-only를 통과한 뒤 제품별 DRAFT Route를 다음 승인
Bundle로 승격한다. 승인 Bundle에 없는 제품은 Enforcement가 켜지는 `110` 또는 `111`에서
Gateway가 503으로 Fail Closed하며 UI Flag만으로 우회할 수 없다.
