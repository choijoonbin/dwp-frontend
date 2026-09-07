# DWP-R1-CORE-006 Product Surface Separation

- Owner: Shared Experience Platform
- Co-owner: Identity & Access, Approvals, HCM
- 상태: `앱 관리자 구현 CLOSED / 운영 활성화 BLOCKED_EXTERNAL`
- Gate: `12/12 제품 · 60/60 owner-service PEP · 내부 증적 대기 0 / 외부 출시 증적 37건 대기`
- Roadmap: R1 Common Experience Foundation
- Pilot: Approvals `W1a`, HCM `W1b`
- Technical Canary: Communications·Services `W0.5`
- 마감 재검증일: 2026-09-04 (초기 Pilot 설계: 2026-08-26)

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
- [2026-09-04 마감 재검증 및 신규 연동 경계](11-2026-09-04-closeout.md)
- [Meetings 관리 Surface 후속 Bundle 승격 설계](12-meetings-management-next-bundle-activation-design.md)
- [공통 ADR](../../03-architecture/R1%20제품%20업무·관리%20Surface%20분리%20및%20관리%20Context%20ADR.md)
- [전체 메뉴 분류표](../../03-architecture/R1%20제품%20Surface%20전체%20메뉴%20분류표.md)

## 현재 마감 판정

앱 관리자 구현은 최신 재검증에서 집중 단위 8 files / 55 tests, Chromium·mobile 브라우저
85건이 통과했고 의도된 조건부 시나리오 3건은 skip됐다. 전체 단위 검사는 426 files / 2,834
tests, non-incremental 타입 검사와 소유 파일 ESLint, source-size 검사는 모두 통과했다. 16개
제품별 production build와 전체 DWP Vite 초기 번들 예산(1,058.3 KiB raw / 308.6 KiB gzip)도
통과했다. 전체 `corepack yarn build`와 `format:check`를 포함한 전역 정적 Gate도 병행 변경을
합친 최신 공유 트리에서 재실행해 통과했다. 이 로컬 통과를 외부 운영 출시 PASS로 바꾸어
기록하지 않는다.
최신 정적 메뉴는 193개다.
실행한 공유 트리의 범위·수치와 별도 제품 작업은 [마감 기록](11-2026-09-04-closeout.md)에서 구분한다.

공통 내부 계약은 불변 v4 증적 기준 12/12 제품과 60/60 PEP 셀이 닫혀 있고 내부 대기는 0이다.
이는 모든 제품의 새 기능이나 운영 출시가 승인됐다는 의미가 아니다. 출시 상태의 정본은
[Readiness Manifest](../../06-delivery/release-evidence/product-surface-production-readiness.json)와
`corepack yarn product-surfaces:readiness:check`의 계산 결과이며, 현재 외부 증적 37건은
`BLOCKED_EXTERNAL`로 남는다. 코드나 이 문서로 승인·staging·수동 AT·침투 테스트를 대신하지 않는다.

Meeting→Work 후속 업무 원천 전환은 이후 요청된 별도 기능이다. 현재 권한 재검증, 정확한
follow-up capability와 역할 부여, People 대상 적격성 합의·구현 전까지 NO-GO다. 내부 HTTP
클라이언트의 정적 계약 등록은 해당 기능이나 신규 권한의 활성화 승인이 아니다.

## 설계 불변식과 초기 Pilot 기록

아래는 2026-08-26 초기 설계 이력이다. 당시 Bundle 버전, 메뉴 수, local seed 및 단계별 계획을
현재 구현·배포 상태로 해석하지 않는다. 최신 메뉴는 공통 메뉴 분류표와 실행형 manifest 검사를,
현재 정본·검증 결과는 위 마감 기록과 Readiness Manifest를 사용한다.

공통 IA, Route·Shell·Navigation 계약, Effective Product Surface Context, 권한 실패 상태,
Technical Canary, Approvals W1a와 HCM W1b Runtime, 12개 제품 Manifest·Shell·Flag 및
Rollout·Rollback 안전장치를 구현했다. Work Header에는 세부 관리 Surface 대신 단일 `앱 관리`
진입점만 표시하고, Work와 Management Sidebar는 현재 Plane의 메뉴만 투영한다. 회사 관리 센터는
Tenant Governance, 정확한 앱 접근 책임과 Preset 수명주기 오케스트레이션만 소유한다. 중앙 직접
할당 Allowlist는 `APP_OWNER`, `APP_ACCESS_MANAGER`, `APP_ACCESS_APPROVER`,
`APP_ACCESS_REVIEWER` 네 책임으로 고정한다. `APP_CONFIG_ADMIN`과 제품 전문 Role·Exact
Capability의 실제 기능 실행은 각 앱 Workbench에 남기며 회사 센터가 제품 Action을 대신 실행하지
않는다.

Rollout은 Tenant-global Shadow `S=access.product-surfaces.context-shadow.v1`, 제품별 Enforcement
`E_p=access.product-surfaces.capability-enforcement.<product>.v1`, 제품별 Native UI
`U_p=ux.product-surfaces.<product>.v1`로 합성한다. 기존 전역
`access.product-surfaces.capability-enforcement.v1`은 전환 이력·호환 증거용으로만 유지하고 신규
상태 합성에는 사용하지 않는다. Context Envelope에서 제품 간 동등성을 요구하는 축은 `S`뿐이다.
Rollout 상태별 사용자 경험과 인가 경계는 제품별 `(S,E_p,U_p)`로 다음과 같이 고정한다.

| 상태  | `S,E_p,U_p` | Shell과 내비게이션                                      | 인가                         | `앱 관리` CTA      | W2/W3 DRAFT Route          |
| ----- | ----------- | ------------------------------------------------------- | ---------------------------- | ------------------ | -------------------------- |
| `000` | `0,0,0`     | Work/Management가 분리된 Compatibility Shell            | 기존 정책                    | 기존 관리 권한자만 | 인가 미등록, Legacy만 사용 |
| `100` | `1,0,0`     | 같은 분리 Shell + Shadow 평가                           | 기존 정책, 차이만 관찰       | 기존 관리 권한자만 | 인가 미등록, Legacy만 사용 |
| `110` | `1,1,0`     | 같은 분리 Shell + Exact Context 전환                    | Exact Capability Enforcement | 서버 판정 권한자만 | Fail Closed                |
| `111` | `1,1,1`     | Native Surface UI + Work Header의 단일 `앱 관리` 진입점 | Exact Capability Enforcement | 서버 판정 권한자만 | Fail Closed                |

업무·관리 Sidebar 분리, Work Header의 단일 `앱 관리`, Management Header/Footer의
`업무로 돌아가기`는 네 상태 모두에서 유지되는 공통 IA 불변식이다. `000/100`은 기존 권한 가드를
그 표현에 투영하고 `110/111`은 각 PAGE의 직접 결정과 대상 Scope를 투영한다. 대상에 기본값 없는 복수
Scope만 있으면 출발 화면의 Scope를 제거한 뒤 대상 Scope 선택 화면으로 이동한다. 거부·만료·불완전
Authority 항목은 노출하지 않는다. W2/W3의 Frontend DRAFT Route는 `110`과 `111` 모두에서 다음
승인 Backend Bundle에 같은 Route·Capability 계약이 들어오기 전까지 사용할 수 없다.

Canonical/Production Migration 기준 권한 Bundle v1~v3은 기존 바이트와 Checksum을 보존한 채 모두
`DRAFT`이고 Active Pointer는 없다. Local verification bootstrap만 고정 Local Tenant에서 v3를
검증용으로 승인·활성화할 수 있으며, 이 Pointer와 Evidence는 Production 승인으로 재사용하지 않는다.
12개 Rollout 제품 목록은 별도 Checksummed Inventory로 분리했다. Production Migration의 `S` 1개,
`E_p` 12개, `U_p` 12개, 즉 신규 합성 Flag 25개는 모두 기본 Off이고, Legacy 전역 E도 신규 합성에는
영향을 주지 않는다.
Local 검증 Seed만 `S=1`, Approvals·Communications·HCM·Services의 `E_p/U_p=1`로 네 제품을
`111`에 두며, Calendar·DWAI·ON·Mail·Meetings·Messaging·Notifications·Spaces·Workplace는
`100`에 둔다.
이는 Production 활성화나 승인 증거가 아니다.
HCM은 owner-service PEP, Target Population, 실 Team·Operations API, SoD와 1회용 Step-up까지 v3
계약에 결속했다. 제품 관리자 Preset은 통제면 책임의 제한적 2인 Bootstrap과 제품 전문 권한의
3단계 `요청 → 승인 → 활성화`를 분리한다. 본 문서와 Surface ADR은 실제
Product·Security·Privacy의 Production 승인을 의미하지 않으며 Readiness Manifest가 유일한 출시 판정이다.

W1a 운영 활성화 전에는 ADR·193개 메뉴표와 ADR `PS-01`~`PS-11` Decision Register를 실제
Owner가 승인한다. W2/W3의 91개 Frontend DRAFT Page 계약(정적 메뉴 86개 + 동적 5개)도 제품별 Exact Capability가 다음
불변 Bundle에 승인되기 전에는 활성화하지 않는다. 핵심 승인 Package는 다음과 같다.

1. Bound `EffectiveProductSurfaceContext`·Direct Evaluation·Capability Registry
2. Responsibility AND Capability 기본값과 기존 Permission-only 관리자 Migration
3. Tenant Admin Legacy Oversight의 Capability·Route·API·Field·Scope Allowlist와 Sunset
4. Product Root, Scope Selection, Composite Decision Revision·Trusted Context·다중 Tab Invalidation
5. Exact Action과 Legacy `MANAGE` Compatibility Delta
6. HCM Org Design·Export, Target Population, Support Exclusive Mode
7. R1 전 범위 JIT·Emergency 비활성 증거와 향후 재활성화용 Scope-bound SoD·Step-up Freshness Policy
8. Named Reviewer Assigned Work와 UX Telemetry·Privacy 계약

각 항목의 제안 기본값, 구현과 Test 증거는 고정되어 있다. Owner 승인 후 별도의 제품 방향 재설계
없이 DRAFT v2를 승격할 수 있다.

## 구현 순서

```text
W0 공통 계약 [구현 안전 지점, Production 증거 대기]
  → W0.5 Communications·Services Technical Canary [Runtime 구현, 권한 음성 Matrix·외부 승인 대기]
  → W1a Approvals Pilot [Runtime 구현, 권한 음성 Matrix·외부 승인 대기]
  → W1b HCM Pilot [Runtime·5-vector PEP 증거 구현, 외부 활성화 승인 대기]
  → W2/W3 전체 제품 [Manifest·Shell·DRAFT Route·default-off Flag 완료, Bundle 승인 대기]
```

기술 구현이 준비되어도 Production 승격과 관찰은 Approvals → HCM → W2/W3 순서를 지킨다.
Approvals에서 공통 Shell·Guard·Deep Link·Telemetry를 먼저 검증하고, HCM에서 관계 기반 Team,
Target Population, 다중 Scope와 Support Read-only를 통과한 뒤 제품별 DRAFT Route를 다음 승인
Bundle로 승격한다. 승인 Bundle에 없는 제품은 Enforcement가 켜지는 `110` 또는 `111`에서
Gateway가 503으로 Fail Closed하며 UI Flag만으로 우회할 수 없다.

Gateway의 Durable Safety Latch v2는 `tenant+product`별 마지막 승인 `S/E_p`와 각 Revision을
TTL 없이 보존한다. Provider 장애 시 Snapshot이 있으면 `S/E_p`를 유지하고 `U_p=0`으로 내려
`111→110`만 허용한다. `110→100/000` 자동 강등은 금지한다. v2가 없는 신규 Tenant·Product는
Legacy v1 Latch도 없을 때만 `000`이고, Legacy v1 발견은 `MIGRATION_REQUIRED`, Corrupt·Unavailable과
Revision Conflict는 모두 503이다. `E_p=false`인 더 높은 승인 Revision을 발행하는 명시적 운영
Rollback(`S=1`이면 `110→100`)은 장애 Fallback과 별개의 절차다.
Redis Cluster에서는 두 Key를 한 Lua로 읽지 않는다. `v2 MISSING → Legacy 단일-key probe → v2
재조회` 후 최종 v2 결과를 우선해 Migration 동시 생성 Race와 Cross-slot을 함께 차단한다.
