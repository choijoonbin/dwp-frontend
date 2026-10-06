# Controlled-export resource-only 게시 보완 제안

상태: **DESIGN_PROPOSED_ARTIFACT_ONLY_NOT_APPLIED / AUTHOR_ONLY / G3_AUTHORIZATION_NONE**.
이 패키지에는 계획 SQL artifact와 정책/반례가 있다. Backend Flyway file·source·기존 CSV/Gate·서버·DB·permission·activation을 변경하지 않았다. 자체 검사는 독립 기술 승인 또는 native Auth 수용이 아니다.

## 고정 진단과 의미

진단JSON SHA `32630c2b23f886c0da98b02e4e7f421dde61fa01ff8d11d99d99478f2cef7729`, MD SHA `e85b91a7eea4ab1f65ced46251713f3a3a2594d6a79f91a465b984ac02f193c6` 및 integration `db0d2b5067e6fbee27ee58121c5a4406cab132b9`를 보존한다. Descriptor5개(create/cancel/retry EXPORT3; read/preview VIEW2)는 있지만 production Auth resource registration이 없다. DRAFT seed import는 resource/permission/activation factory가 아니다. Main dirty descriptor/source는 이 게시 승인의 입력이 아니다.

`ACTION.WORKFORCE_CONTROLLED_EXPORT` 등록 누락은 내부 준비의 source gap이다. 반출 KMS/artifact/D09/D12 disabled writer와 People eligibility/signing 차단은 별도의 유지해야 할 안전 경계다. 등록을 외부 customer 설정에 위임하거나, 누락을 default autogrant로 고치지 않는다.

## enabled·factory·tenant lifecycle exact 정책

| 현행 조건 | resource-only 보완 결과 |
| --- | --- |
| exact tenant ACTION row enabled TRUE | ID·metadata·enabled 및 모든 grants 그대로 보존; EXPORT 권한/activation 증명 아님 |
| 기존 admin-disabled FALSE | 그대로 보존; 자동 재활성화/metadata touch 없음 |
| row 없음; ACTIVE tenant+enabled APP.HCM+same-tenant ACTIVE RS_HCM_CONFIG root | ACTION resource를 **FALSE**로1회 INSERT; 기존 conflict DO NOTHING |
| inactive tenant/APP.HCM disabled 또는 root 없음 | 생성 skip/configuration-required; synthetic root/관리 duty 없음 |
| 같은 key의 잘못된 type | 전체 transaction fail-closed; 임의 병합/rename 없음 |
| 새 tenant factory template 없음 | **없음을 보존**; template를 만들거나 ACTIVE로 바꾸지 않음 |
| exact 기존 RETIRED template | 기존 bytes/state 보존; RETIRED를 DRAFT/staged 상태로 재해석하지 않음 |
| ACTIVE/conflicting factory template | fail-closed; reviewed factory/owner lifecycle upgrade 없이는 게시하지 않음 |

현재 `AuthTenantProvisioningService.syncResources`는 ACTIVE template를 읽고 ON CONFLICT `enabled=TRUE`로 갱신한다. ACTIVE factory 추가만으로는 admin-disabled 보존이 불가능하다. 더 중요하게 `syncBuiltInRolePermissions`의 DELETE는 template key 존재를 검사할 뿐 ACTIVE를 필터하지 않는다. 따라서 **RETIRED template 신규 INSERT도 후속 provision/reconcile에서 기존 built-in explicit grants를 삭제할 수 있다**. 초기 검토 후보의 template INSERT를 제거해 최종 SQL artifact의 write target은 `public.com_resources` 하나뿐이다. existing factory를 무단 retire/remove해 기존 intent를 바꾸지도 않는다.

현재 auth V1..212에서 com_resources는 tenant_id/type/key unique와 enabled/updated_at를 가진다. 전용 resource lifecycle row_version/CAS는 이 패키지에서 구현하지 않았다. 명시적 reenable은 정확한 native row lock+ID/tenant/old enabled/updated_at+current owner policy gate를 가진 별도 governed command로 설계·검증해야 한다. 단순 last-write-wins와 template replay는 허가되지 않는다.

## 기존·신규 tenant와 APP.HCM 관리 경계

기존 tenant은 native ACTIVE 상태, exact APP.HCM enabled row, same-tenant RS_HCM_CONFIG ACTIVE set와 APP.HCM root member만으로 **등록 범위**를 정한다. 이것은 현재 signed core.people entitlement나 사용자 EXPORT 허가 증거가 아니다. root admin membership을 신규 resource에 복사하지 않는다.

V90의 existing APP.HCM/RS_HCM_CONFIG는 durable resource_set_id를 보존하며 child ACTION/ADMIN resource를 의도적으로 factory seed하지 않는다. 본 제안도 ACTION child member·관리 role assignment·APP.HCM grant/duty/package를 생성하지 않는다. 관리 UI의 catalog-only discovery와 유효 APP_CONFIG_ADMIN/APP_OWNER의 명시적 owner change purpose/승인/SoD/최소 audit는 **별도 exact owner 계약 OPEN**이다. APP administrator가 수집된 인사 반출 내용을 읽거나 EXPORT를 얻는 것은 아니다.

신규 tenant은 initial APP.HCM/root 생성 뒤의 **insert-only owner hook**에서 missing disabled ACTION을 생성하고 conflict를 보존하는 계약이 필요하다. 이미 등록 시점을 지나간 tenant도 같은 owner reconciliation을 exact native tenant IDs로 다시 실행한다. 이 hook/PEP/테스트는 아직 구현하지 않았다. 안전하지 않은 ACTIVE template를 대신 게시해 이를 완료한 척하지 않는다. 경계가 없으면 skip/unavailable로 닫히며 자동 root/duty/grant는 없다.

명시적 business grant는 `ACTION.WORKFORCE_CONTROLLED_EXPORT:EXPORT` exact capability에 실제 목적/population/field-policy revision/expiry/deny/SoD/승인·revoke가 결속되어야 한다. APP.HCM VIEW, Controlled-export VIEW, 다른 ACTION MANAGE 또는 admin responsibility를 EXPORT로 clone/상속하지 않는다. create/retry의 기존 CRITICAL activation policy·step-up·People eligibility와 disabled artifact writer/외부 정책은 그대로다.

## artifact·예약·native 실행의 분리

`controlled-export-resource-publication.plan.v1.sql`은 **artifact only**이며 app migration resource stage에 없다. 같은 common-allocation successor의 `SC-WCE-REGISTRY`는 Auth public213 후보, SYS module은214..242 후속 후보다. 현재 committed Auth212 및 common/private/module 전체 namespace를 대조한 **승인 입력**이지 구두 V213 승인이나 실행 권한이 아니다. 독립 review/정본 successor/owner CREATE token 뒤에만 정확한 새 backend file로 materialize하고 source/hash/history/native receipt를 다시 고정한다.

Artifact는 external Control이 실제 app writers/credential/CONNECT를 fence한 뒤 template와 resource를 먼저 lock하고 exact authority/catalog/factory/type를 검사한다. syntax placeholder reference 검사만으로 trusted signature/permit/current Control 검증을 제공하지 않는다. 외부 deployment anchor와 실제 native Control enforcement는 OPEN이다. resource missing INSERT FALSE/ON CONFLICT DO NOTHING 이외 UPDATE/DELETE/GRANT/DDL/history 수기 변경은 없다.

최소 before/after native receipt는 template/각 tenant resource ID-enabled-metadata, 모든 grants/default permission templates/users/groups/roles/packages/duties, APP.HCM root/admin assignments, DRAFT/approval/active pointer, People eligibility/signing/writer/D09/D12 상태를 exact 비교해야 한다. SQL artifact의 텍스트 linter/정책 모델은 이 native proof를 대신하지 못한다.

## idempotency·rollback·negative 계획

동일 resource key replay는 기존 ID/enabled/timestamp/metadata를 갱신하지 않는다. 실제 crash all-or-nothing와 concurrency는 future native transaction/Control test를 요구한다. rollback은 과거 Flyway SQL/checksum/installed_by/down-migration 수정이 아니다. 새 row는 처음부터 disabled다. 등록 중단/no-op을 기본으로 하며, 나중 explicit enable 후에는 current CAS+승인+audit를 가진 별도 forward disable만 허용한다. external receipt의 신규 ID·무참조·후속변경 부재를 증명하지 않은 DELETE나 기존 grant 임의 revoke는 금지다.

21 concrete synthetic model cases는 missing→disabled, TRUE/FALSE/id/metadata 보존, inactive/missing root/APP-disabled skip, wrong type/factory reject, cross tenant isolation/replay, future explicit reenable의 admin/entitlement/SoD/reason/CAS negatives를 포함한다. **실제 Auth/CAS/PEP/SQL/PG 실행이 아니다.** 별도12 native authorization negatives는 catalog-only, APP.HCM VIEW, 다른 ACTION MANAGE, Controlled-export VIEW, expired/revoked/DENY/SoD/cross-tenant, People signing calls0, D09/D12 writer, DRAFT pointer를 확인할 계획이며 아직 실행하지 않았다.

독립 승인 후 bounded native test는 clean/upgrade/restart, exact tenant 새 생성 및 owner-hook replay, concurrent disable와 resource reconciliation, no-grant/no-pointer byte snapshots, committed source/reference/checksum/history·Control fence 실패를 실제 검증해야 한다. 신규 13-stream bootstrap는 이 패키지의 전수 실행 scope가 아니며 `DESIGN_REGISTERED_NOT_IMPLEMENTED/OPEN`이다.

재현 명령(cwd `/Users/a10697/Work/DWP`):

```sh
/Users/a10697/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -B output/hris-porting-blueprint-2026-09-09/coding-readiness/semantic-remediation/validate_controlled_export_resource_publication.py
/Users/a10697/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -B -m unittest discover -s output/hris-porting-blueprint-2026-09-09/coding-readiness/semantic-remediation -p test_controlled_export_resource_publication.py -v
/Users/a10697/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -B output/hris-porting-blueprint-2026-09-09/coding-readiness/semantic-remediation/validate_controlled_export_resource_publication.py --require-g3
```

Author12 unit tests/21 model cases의 정상 exit0도 readiness=false/SQL applied=false다. require-G3는 exit1이다. linter는 text-token 검사이지 SQL AST 의미/실제 schema/operator/search-path/lock/FK/authorization 증명이 아니다. 현행 backend source mutation 또는 관련 native behavior 전체의 certification도 아니다.

G3에서 exact shared owner lifecycle/DTO/SPI/PEP/fail-closed adapter·current common publication/native proof/독립 successor review는 OPEN이다. domain full CRUD/여정 실행은 G4다. customer 활성화/실제 KMS·artifact/country/provider·People signing authority는 G6며 NOT_AUTHORIZED 그대로다. 어느 작성자 검사도 5모듈 착수 승인이나 반출 실행 승인을 선언하지 않는다.
