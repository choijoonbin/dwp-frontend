# Controlled-export Auth 등록 진단 — 2026-09-14

결론: `ACTION.WORKFORCE_CONTROLLED_EXPORT`는 descriptor에 있으나 **Auth production catalog/template 등록 source가 누락되어 있다.** Registry-only owner publication successor는 내부 준비 OPEN이다. 반출 artifact의 외부 D-09/D-12 실행 차단, 사용자 default grant 부재, People eligibility 서명 차단은 별도의 의도된 안전 경계다.

보정·autogrant·guard 완화·SQL/BE/main/Gate/서버/commit 변경은 적용하지 않았다. 새 작성 범위는 이 JSON/MD 두 파일뿐이다. 현재 G3는 CLOSED이며 Approval task를 중단시키는 진단이 아니다.

## 정확한 source 경계

03:49:42 UTC 캡처 기준 integration은 `db0d2b5067e6fbee27ee58121c5a4406cab132b9`이고 index는 v1..6/latest6다. Main HEAD는 `449b2db05bada8851c376e1841830f0b68f8a346`; 현재 dirty 작업의 v7/v8/indexlatest8은 **캡처 자료이며 미승인·미통합**이다. Main 다른 task가 계속 변경해 줄 번호가 이동하므로 exactSHA/selector로 읽어야 한다.

Integration v1/v2 export descriptors0, v3..6 각5; main working v3..8 각5다. Create/cancel/retry EXPORT3, read/preview VIEW2이며 모든 bundle은 DRAFT다. Descriptor lifecycleACTIVE는 resource/권한/activation이 아니다. Auth peer14개 byte pairs는 일치했다. Static filename inventory는 integration114/main113 full Flyway versions이며 exact ACTION SQL matches0이다.

다른 task가 전달한 freshAuth114+SeedLoader1..8/해당 resource0rows/APP.HCM 있음은 **제가 native DB에서 재현하지 않았다.** 그 run의 sourceSHA·query/receipt가 제공되지 않아 위 두 static snapshot 중 하나로 숫자만 재결합하지 않는다.

## 등록 누락 및 안전 차단 근거

- [Canonical source6040..6135](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/contracts/product-authorization/product-surfaces-v1.yaml:6040), [v3 첫 descriptor](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/contracts/product-authorization/product-surfaces-v1.bundle-v3.json:1212)에 exact ACTION key가 있다.
- [V26 resource등록](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-auth-server/src/main/resources/db/migration/V26__add_workforce_application_authorization.sql:22), [V49 tenant templates36..71](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-auth-server/src/main/resources/db/migration/V49__harden_tenant_authorization_and_seed_skax_groups.sql:36)에는 없다. V54는 APP.HCM alias, V56은 hierarchy/SoD2tables 제거일 뿐 export등록/의도적 retire가 아니다. Integration/main production Auth Java+SQL exact key검색은0이다.
- [SeedLoader32..72](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-auth-server/src/main/java/com/dwp/services/auth/config/ProductAuthorizationSeedLoader.java:32)는 defaultoff/DRAFT import만 한다. [Descriptor INSERT145..209](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-auth-server/src/main/java/com/dwp/services/auth/repository/ProductAuthorizationContractRepository.java:145)는 resource/grant를 만들지 않으며 승인/활성CAS는 별도다.
- [Template provisioning237..269](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-auth-server/src/main/java/com/dwp/services/auth/provisioning/AuthTenantProvisioningService.java:237)는 ACTIVE template에만 의존해 missing key를 신규 tenant에서도 만들 수 없다. **ON CONFLICT enabledTRUE는 admin-disabled 재활성화 위험**이므로 새 ACTIVE template만 추가하는 보정은 충분히 안전하지 않다. Builtin grants349..389는 별도 permission templates에 의존한다.
- [Exact permission guard598](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-auth-server/src/main/java/com/dwp/services/auth/service/ProductAuthorizationAuthorityAdapter.java:598)는 missing permission을 deny한다. APP.HCMVIEW·다른 actionMANAGE를 EXPORT로 복제하면 안 된다.
- 실제 WorkforceExportController/Service는 있다. [Accepted ADR80..95](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/docs/architecture/workforce-access-and-export-governance.md:80), [Policy20..44](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-people-server/src/main/java/com/dwp/services/people/workforce/WorkforceExportPolicy.java:20), [disabled writer](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-people-server/src/main/java/com/dwp/services/people/workforce/DisabledWorkforceExportArtifactWriter.java:6)는 D-09/D-12와 미구성 KMS artifact 실행을 명시적으로 차단한다. **이는 Auth catalog를 외부 설정에 위임했다는 증거가 아니다.**
- Main 새 `existingCriticalPolicyMapsConfiguredAcrButPreservesThePeopleEligibilitySigningGuard`는 캡처212..235행에서 test-only catalog/explicit grants를 삽입하고도 People eligibility 때문에 signing unavailable/calls0을 assert한다. [Challenge guard231..246](/Users/a10697/Work/DWP/dwp-backend/dwp-auth-server/src/main/java/com/dwp/services/auth/service/ProductSurfaceStepUpChallengeService.java:231)는 유지해야 한다. 이 테스트를 여기서 실행하지 않았다.

JSON은87개 source의 exactSHA/HEAD blob/working-byte·줄 수를 보존한다. 핵심 integration SeedLoaderSHA는 `d065174040e4bd1777b61b332238291f563477f517af3a33f98edbefa968fa1b`, V49SHA는 `6ac326bf0b59bb32ce2eb7f9e80f204bc7e986fa9f78c1d1e81939c1886a7f8c`다. Main test 캡처SHA `770e64b238099ed2725dad5024ce7874d7b7d23c3859b64f4cb33323c0aa6518`는 현재 불변성/승인이 아니다.

## 최소 안전 successor 계획 — 미적용

Security/Auth/Control은 **내부 전문가·코드 owner 기술 검증**을 뜻한다. Common preparation은 이미 사용자가 허용한 범위이며 고객 자료·외부 책임자 승인이나 사용자의 새 선택을 요구하지 않는다.

1. Exact ACTION catalog의 owner/install/entitlement/tenant/관리 visibility 및 enabled/admin-disabled lifecycle를 준비한다. App-group/duty/package 또는 별도 ACTION resolver mapping은 후속 검증 조건이지 이 진단이 확정한 새 resolver bug가 아니다.
2. 내부 기술 검증과 **비충돌 owner allocation** 후 resource-only forward publication/기존·신규 tenant reconciliation을 설계한다. Existing disabled 보존·CAS·명시적 reenable 정책 없이 unconditional ACTIVE sync를 적용하지 않는다. 기존 migration 수정이나 임의 V211/V212/V213 선정은 금지한다.
3. Default roles/users/builtin permission templates에 EXPORT를 부여하지 않는다. APP.HCM grants cloning 금지. 목적·population·field·version·expiry·deny/SoD와 governed grant/revoke는 별도 exact owner계약이다.
4. DRAFT/approval/CAS, People eligibility/PEP, D-09/D-12/blockers/disabled writer를 유지한다. Catalog 등록만으로 native signing·artifact 실행·고객 활성화·G3 OPEN을 인증하지 않는다.

## 검증 경계

이번 실제 작업은 source parsing/rg, versions/counts/peer byte equality/SHA/filename inventory와 보고서 구조·기존 finalfiveaudit pin 보존 검사뿐이다. Gradle/nativefresh/PG/새 서버 실행은0이다.

승인된 correction 후 별도 허용된 bounded 환경에서 clean/upgrade/replay resource-only 등록·tenant조건·admin-disabled 보존·grant/pointer/blocker 불변, catalog-only/APPVIEW/VIEW-action/crossTenant/revoked/DENY negatives, missing eligibility signing calls0 및 blocker/writer failclosed를 검증한다. 현재 이 실행이나 소스 보정은 하지 않았다.

[기계 판독 보고서](/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/reports/workforce-controlled-export-registration-diagnostic-2026-09-14.json).
