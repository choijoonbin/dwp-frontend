# Control adopted predecessor — ACTIVE-safe 최소 production 계획

상태: 실제 PG16 counterexample 확정, production 변경 승인 대기. 이 문서는 구현 완료나 G3 통과를 주장하지 않는다.

## 문제 경계

현재 공개 `MigrationControlMain`은 exclusive lock과 BASELINE preflight 뒤 즉시 ACTIVE fence를 적용한다. 그 후 `runAdoption`이 기존 receipt를 발견하면 `MigrationAdoptionGuard.verifyBeforeMigration`을 호출하고, 이 검증이 runtime principal로 새 연결을 연다. ACTIVE의 올바른 `CONNECT` 차단 때문에 해당 연결은 SQLSTATE `42501`로 거부된다.

단순히 `legacyBoundary` 호출만 ACTIVE 이전으로 옮기면 검증과 사용 사이의 receipt/history/inventory 변경을 검출하지 못할 수 있으므로 허용하지 않는다.

## 제안 API와 파일 경계

1. `dwp-core/.../MigrationAdoptionGuard.java`
   - 새 controller-observation 검증 API 하나를 추가한다.
   - 입력: `Contract`, 이미 열린 controller/bootstrap `Connection`, controller/migration/runtime principal, BASELINE에서 검증한 exact `Receipt`.
   - 동작: controller identity와 세 principal의 상이성을 확인하고, current full receipt의 canonical digest·외부 reference·history digest/row count/max·stored/live inventory digest를 exact expected receipt와 다시 대조한다.
   - metadata ACL은 새 principal 연결을 열지 않고 controller 연결에서 `has_schema_privilege(role, oid, ...)` / `has_table_privilege(role, oid, ...)`로 PUBLIC·migration·runtime posture를 관찰한다. runtime은 Control metadata privilege가 전부 없어야 한다.
   - 반환은 재검증된 동일 `Receipt`; mismatch나 SQL 오류는 기존 stream-key 결박 오류로 fail closed 한다.

2. `dwp-migration-control/.../AdoptionSealer.java`
   - package-private immutable `PreparedLegacyBoundary`를 추가한다: stream key, mode(initial/existing), legacy max, exact verified receipt. 비밀번호·DataSource·Connection은 담지 않는다.
   - `prepareLegacyBoundary`는 BASELINE에서 기존 direct migration/runtime 검증을 그대로 수행한다. existing은 full verified receipt를 proof에 저장하고, initial은 receipt 부재·previous settings 부재·positive history max를 저장한다.
   - `consumeLegacyBoundary`는 ACTIVE에서 proof/stream/mode를 exact 결박한다. existing은 위 controller-observation API를 호출하고, initial은 receipt가 여전히 없고 history max가 proof와 동일함을 bootstrap으로 재확인한다. 이 경로는 runtime 연결을 열지 않는다.

3. `dwp-migration-control/.../MigrationControlMain.java`
   - 같은 bootstrap connection 및 exclusive Control lock 안에서 `ControlPreflight.verify` 직후, ADOPT_OR_UPGRADE에 한해 stream 순서대로 proof 목록을 준비한다.
   - 그 다음 기존 `activateExclusiveControlFence`를 그대로 실행한다.
   - `runAdoption`에 proof 목록을 넘기고, ACTIVE에서 각 proof를 정확히 한 번 stream 순서대로 소비한 뒤에만 object transfer/Flyway를 진행한다.
   - proof 수, stream key, 순서, mode가 다르면 migration 전에 거부한다. 다른 mode의 Main 흐름은 변경하지 않는다.

## 추가 테스트

- 기존 신규 4-case를 유지하고 공개 Main case가 더 이상 ACTIVE runtime `42501` 재접속을 만들지 않음을 확인한다. fixture 범위상 이후의 unrelated migration 실패는 전체 Auth 성공으로 해석하지 않는다.
- controller observation 단위/PG 테스트: exact proof success, receipt/reference mutation, history mutation, inventory mutation, runtime metadata privilege grant, wrong controller/migration/runtime identity를 각각 거부한다.
- Control PG 테스트: swapped/missing/duplicate proof, initial receipt 출현, initial history max 변경을 migration 전에 거부한다.
- 기존 `MigrationAdoptionGuard*`, `MigrationControlMainTest`, `MigrationAdoptionGuardPostgresTest`, 신규 4-case, Control composition/bridge native 테스트를 같은 기대와 budget으로 재실행한다.

## 반드시 유지할 불변식

- runtime `CONNECT`는 ACTIVE 내내 차단한다.
- 기존 receipt와 `previousReceiptSha256ByStream` / `previousControlReference`의 exact binding을 유지한다.
- BASELINE의 실제 migration/runtime principal 검증은 제거하거나 controller 관찰로 대체하지 않는다.
- controller는 새 일반 목적 DataSource가 아니며, 이미 lock/fence를 소유한 Main의 bootstrap connection만 받는다.
- initial adoption과 existing adopted predecessor를 혼용하지 않는다.
- Auth 전체 migration, issuer/publication, 모든 앱 설정, G3는 별도 Gate로 남긴다.
