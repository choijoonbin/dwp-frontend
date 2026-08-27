# DWP-R1-ADM-009 Widget Ecosystem Governance

- 상태: `in-development`
- Release 판단: `미승인·미출시`
- Owner 후보: DWP Product Experience / Platform Control Plane / App Platform
- 적용 Surface: Personal Home, Tenant Admin, Provider Control
- 선행 계약: `DWP-R1-CORE-002`, `DWP-R1-CORE-007`, `DWP-R0-ADM-002`
- 기준일: 2026-08-27

## 목적

Home 편집의 `홈에 항목 추가`를 단순 숨김 항목 복원에서 유효 Catalog 탐색으로 확장하고,
앱 팀이 공급하는 실행 가능한 Widget과 사용자가 만드는 데이터 없는 설정 Preset을 분리한다.
Provider 공급, Tenant 거버넌스, End-user 개인화·공유가 같은 권한·버전·감사 계약에서 동작하도록
3개 관리 평면을 정의한다.

## 현재 구현과 목표의 경계

| 범위             | 현재 상태                                                                    | 이 Package의 판단                                                            |
| ---------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Home Add Dialog  | Flag On은 전체 Library·Search·Filter·상태, Off는 숨긴 항목 복원 전용 경로    | Error·정책 잠금·사용 불가의 실제 Server Source는 후속                        |
| Widget 공급      | Frontend에 5개 Definition이 정적으로 등록됨                                  | 동적 Provider Definition 공급·버전 Lifecycle은 후속 Backend 범위             |
| 개인 Home        | 순서·표시·크기, 복수 Home, Revision, 전체 Home Template API가 존재           | 기존 기능을 보존하고 Widget Instance ID를 별도 도입                          |
| Widget 설정      | 4개 기존 Widget의 Source·Field·Filter가 Frontend에 고정됨                    | Provider Manifest와 서버 검증 Config Schema로 이동 필요                      |
| Template         | 현재 `HomeTemplate`은 Home 전체 Layout이며 관리자 게시 모델                  | 단일 Widget 공유 객체는 `Widget Preset`, 전체 구성은 `Home Blueprint`로 구분 |
| Tenant Admin     | Home Composition 안에 읽기 전용 Build Catalog·실제 Blueprint API 화면을 추가 | 실제 Widget 정책 Mutation은 Backend 이후에만 활성화                          |
| Provider Control | Product Contract 안에 정적 Build Contract 개발 Preview를 추가                | 인증 증거와 Definition 등록·배포·회수 Lifecycle은 아직 없음                  |
| Internal Trust   | Exact Route·Dual-proof·JCS fence, 66개 회귀, V206/V207 중앙 계약 수렴        | Production verifier·replay·ledger 미구성으로 실제 요청은 503 fail closed     |

Phase 0 정적 Lifecycle은 `BLOCKED` Definition을 기존 표시·신규 추가·복원에서 모두 제외하고,
`DEPRECATED` Definition은 이미 표시 중인 항목만 유지하며 신규 추가·복원·기본 보충을 차단한다. 이
Frontend fail-closed 정책은 동적 Provider Lifecycle이나 Server 권한원이 구현됐다는 뜻이 아니다.

Tenant·Provider의 모바일 목록→상세 전환은 선택 후 상세 제목으로 포커스·viewport를 이동하며, Home
Experience Preview는 wide `1920×312`·desktop `1440×326`·tablet `1024×396`·mobile `390×340`의
선언 비율과 논리 Canvas를 실제 Frame·배경 crop·콘텐츠에 동일하게 적용한다. Library Flag Off에서는
추가 가능한 Catalog를 약속하지 않고 `숨긴 항목 복원`과 빈 상태의 접근 가능한 비활성 사유만 제공한다.

현재 Frontend-only Vertical Slice와 미래 Provider/Backend Lifecycle을 같은 완료 상태로 표현하지
않는다. 문서·화면이 존재해도 Provider Definition 게시, Tenant 정책 저장, 사용자 Preset 공유가
구현·검증되지 않았다면 출시 완료가 아니다.

Receiver-first trust fence는 generic provisioning token·browser authority header·경로 정규화 우회와
비단사 JSON hash, 다중 Trust adapter, command/seal claim-body 불일치를 downstream 전에 차단한다. 다만 이는
수신 측 선행 경계만 구현한 것이다. Gateway exact 404 외부 차단은 완료됐다. 그러나 Production
ES256/JWKS·durable replay·Registry ledger·TLS/mTLS와 21개 payload branch의 exact `oneOf`·domain ownership
validator가 연결되기 전까지 실제 Internal 요청은 의도적으로 `503 TRUST_UNAVAILABLE`이며 Package의
`미승인·미출시` 판단은 유지한다.

현재 Source의 Catalog는 기존 5개 Native Widget 계약을 한곳에 모은 정적 Seed다. 동적 Provider
Registry, 다중 Instance, Tenant Allow/Disable, Preset 생성·공유가 구현됐다는 의미가 아니다.
현재 v5 Frontend·Backend 정규화는 누락된 기존 Widget을 기본 표시로 보충하므로 `ADD`는 순수 모델과
호환 경로만 검증됐다. 실제 Journey 증거는 주로 `ADDED/RESTORE`이며 Instance v6 전에는 같은
Definition의 신규·복수 배치를 지원한다고 표현하지 않는다.

## 제품 결정

1. 앱 팀은 `Widget Definition`을 공급하고 사용자는 허용된 설정으로 `Widget Preset`을 만든다.
2. 사용자가 Home에 배치한 실제 객체는 `Widget Instance`이며 Definition Key와 Instance ID를
   분리한다.
3. 실행 우선순위는 `Provider 안전 정책 → Tenant 정책 → 사용자 Preference`다.
4. Audience Targeting, UI 숨김과 Catalog 노출은 보안 권한이 아니다. 모든 조회·Action은 현재
   열람자의 Tenant·User·원천 데이터 ACL로 서버에서 재인가한다.
5. Preset에는 Layout·Binding 표현·허용 설정만 저장하고 실제 데이터, 사용자 ID, Token,
   Credential, 임의 HTML·JavaScript·URL을 저장하지 않는다.
6. 1차는 중앙 Renderer와 선언형 Widget만 지원한다. Sandboxed Code Widget은 별도 보안·성능
   Gate가 마련된 후 검토한다.
7. Template 적용은 기본적으로 개인 사본을 만들며, 원본 변경을 조용히 전파하지 않는다.

## 산출물

- [근거 및 비판적 검토](00-%EA%B7%BC%EA%B1%B0%20%EB%B0%8F%20%EB%B9%84%ED%8C%90%EC%A0%81%20%EA%B2%80%ED%86%A0.md)
- [기획 및 아키텍처](01-%EA%B8%B0%ED%9A%8D%20%EB%B0%8F%20%EC%95%84%ED%82%A4%ED%85%8D%EC%B2%98.md)
- [화면 설계서](02-%ED%99%94%EB%A9%B4%20%EC%84%A4%EA%B3%84%EC%84%9C.md)
- [데이터 및 API 계약](03-%EB%8D%B0%EC%9D%B4%ED%84%B0%20%EB%B0%8F%20API%20%EA%B3%84%EC%95%BD.md)
- [개발 착수 및 추적](04-%EA%B0%9C%EB%B0%9C%20%EC%B0%A9%EC%88%98%20%EB%B0%8F%20%EC%B6%94%EC%A0%81.md)
- [수용 테스트](05-%EC%88%98%EC%9A%A9%20%ED%85%8C%EC%8A%A4%ED%8A%B8.md)
- [Phase 1A Control-plane Shadow 실행 설계](06-Phase1A%20Control-plane%20Shadow%20%EC%8B%A4%ED%96%89%20%EC%84%A4%EA%B3%84.md)
- [5종 Manifest Golden Fixture](fixtures/widget-manifests.v1.golden.json)
- [Manifest v1 Schema](fixtures/widget-manifest.v1.schema.json) · [Negative](fixtures/widget-manifest.v1.negative.json)
- [Binding Catalog Golden](fixtures/widget-binding-catalog.v1.golden.json) · [Schema](fixtures/widget-binding-catalog.v1.schema.json)
- [Tenant Policy 5종 Golden](fixtures/widget-tenant-policy-seeds.v1.golden.json) · [Schema](fixtures/widget-tenant-policy-seeds.v1.schema.json)
- [Bootstrap Prerequisite Golden](fixtures/widget-bootstrap-prerequisite.v1.golden.json) · [Schema](fixtures/widget-bootstrap-prerequisite.v1.schema.json) · [Negative](fixtures/widget-bootstrap-prerequisite.v1.negative.json)
- [Bootstrap CI Pinned JWKS](fixtures/widget-bootstrap-ci-jwks.v1.json) · [Shadow Dashboard](operations/widget-shadow-dashboard.v1.json) · [Alert Set](operations/widget-shadow-alerts.v1.json) · [Alert Schema](operations/widget-shadow-alerts.v1.schema.json) · [Alert Negative](operations/widget-shadow-alerts.v1.negative.json) · [Alert Verifier](operations/verify-shadow-alert-contract.mjs)
- [Rollout Evidence Schema](fixtures/widget-rollout-evidence.v1.schema.json) · [고정 Query Set](fixtures/widget-rollout-query-set.v1.golden.json)
- [Rollout Operation Schema](fixtures/widget-rollout-operation.v1.schema.json) · [Golden](fixtures/widget-rollout-operation.v1.golden.json) · [Negative](fixtures/widget-rollout-operation.v1.negative.json) · [Verifier](fixtures/verify-rollout-operation-contract.mjs)
- [Registry Event v1 Schema](fixtures/widget-registry-event.v1.schema.json) · [Positive/Negative](fixtures/widget-registry-event.v1.examples.json)
- [Tenant Impact v1 Schema](fixtures/widget-tenant-impact.v1.schema.json) · [Golden](fixtures/widget-tenant-impact.v1.golden.json) · [Negative](fixtures/widget-tenant-impact.v1.negative.json) · [Verifier](fixtures/verify-tenant-impact-contract.mjs)
- [Revision Authority v1 Golden](fixtures/widget-revision-authority.v1.golden.json) · [Negative](fixtures/widget-revision-authority.v1.negative.json) · [Verifier](fixtures/verify-revision-authority-contract.mjs)
- [Registry Command v1 Schema](fixtures/widget-registry-command.v1.schema.json) · [Golden](fixtures/widget-registry-command.v1.golden.json) · [Negative](fixtures/widget-registry-command.v1.negative.json) · [Verifier](fixtures/verify-registry-command-contract.mjs)
- [Command Completion v1 Schema](fixtures/widget-command-completion.v1.schema.json) · [Golden](fixtures/widget-command-completion.v1.golden.json) · [Negative](fixtures/widget-command-completion.v1.negative.json) · [Verifier](fixtures/verify-command-completion-contract.mjs)
- [통합 Golden Gate](fixtures/verify-golden.mjs)와 각 `verify-*.mjs` 독립 검증기

## 출시 전환 조건

- [x] Frontend Catalog Vertical Slice의 대표 Journey와 Flag On·Off 회귀 검증 완료
- [ ] Definition·Version·Tenant Policy·Preset Backend 계약 승인
- [ ] Provider, Tenant, User 권한과 분리 승인 검증
- [ ] Security·Privacy·Accessibility·Performance Review 완료
- [ ] Migration·Kill Switch·Revocation·Rollback Drill 완료
- [ ] Pilot Tenant와 운영 Owner, 지원·감사 책임자 지정
