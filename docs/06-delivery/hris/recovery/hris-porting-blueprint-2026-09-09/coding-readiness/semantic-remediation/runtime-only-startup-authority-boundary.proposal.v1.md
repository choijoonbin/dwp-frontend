# Composite 검증과 production runtime-only startup 경계

상태: ROOT_BOUNDARY_CORRECTION_PROPOSED / G3 CLOSED. 신규 authority pilot의 역할을 바로잡는 설계 입력이며 runtime startup 구현 완료·기존 scalar 경계 변경·새 composite 승인 증거가 아니다.

## 확인한 충돌

신규 `CompositeRuntimeBindingGuard.verifyService` 초안은 migrationQualifier supplier와 runtime supplier를 모두 받아 migration principal 연결에서 native history/inventory를 검사했다. read-only SQL만 실행하더라도 그 호출자가 migration credential을 소유한다는 사실은 달라지지 않는다. 이를 production app startup에 배선하면 production runtime이 migration DS/credential을 가지면 안 된다는 아키텍처와 충돌한다.

해당 검사·실제 private PG negative는 외부 Control authority inspection/pilot로만 유효하다. 미배선 상태를 보존하고 app startup이 완성되었다고 보고하지 않는다. 클래스 이름이나 source-only 테스트 PASS로 이 책임을 숨기지 않는다.

## 책임 분리 결정안

1. External Control/Deployment verifier는 별도 프로세스에서 migration authority로 native history·definition/ACL/ownership·exact composite manifest/receipt·실제 source reference를 검사한다. 자격증명은 이 프로세스에만 제공한다. 필요시 승인된 runtime role을 연결해 deployment probe를 실행하지만 app에 migration pool을 넘기지 않는다.
2. Application startup은 자기 exact runtime purpose pools만 받는다. migration supplier·credential·DDL/Flyway producer·임의 endpoint factory는 API 입력 및 Spring wiring에서 제외한다. runtime은 native history SELECT/DML을 갖지 않는다.
3. Deployment authority의 versioned RuntimeStreamStartupSeal을 소비한다. seal은 service/stream/catalog/schema/history identity, manifest/receipt/Control/source revision, exact runtime purpose/principal/qualifier/readOnly/searchPath/object allowlist, native history/inventory 및 ownership digest, deployment epoch/permit identity/notBefore/expiresAt/signature/keyId에 결속되어야 한다. unsigned caller digest나 자기 서명 assertion은 권한 근거가 아니다.
4. App는 signed expected seal/현재 외부 authority freshness를 검증하고 실제 JDBC original login/current_user/session_user/catalog/endpoint registry/readOnly/searchPath/role attributes/own ACL·foreign schema 거부를 검사한다. 다른 purpose pool 재사용·primary fallback·누락 또는 stale seal은 fail closed다.
5. External Control migration/DDL와 startup permit 발급 사이에는 실제 deployment fence가 필요하다. native seal 검사 후 DDL이 바뀌었는데 오래된 permit으로 app가 시작하는 race를 허용하지 않는다. 현재 epoch/permit을 검사할 수 없으면 준비 상태를 열지 않는다. 이미 동작 중인 프로세스의 schema 변경·drift에는 readiness revoke/drain/reseal 정책이 필요하다.

## 아직 닫히지 않은 G3

RuntimeStreamStartupSeal exact machine schema/serializer/signature/key rotation/revocation, producer와 freshness/refetch transport, deployment epoch/fence/expiry 및 outage semantics, runtime-only DTO/SPI/guard와 실제 startup wiring, Control probe와 app API 분리, empty approved13-stream bootstrap 및 native/current-source pilot이 미완료다. 현재 private config/Insights pilot는 production process/13-stream bootstrap을 실행한 증거가 아니다.

테스트는 최소 app runtime registry에 migration supplier가 없으며 어떠한 입력에서도 호출하지 않음, runtime history SELECT/DDL denied, current original LOGIN 위장 거부, wrong role/purpose/qualifier/endpoint/source/epoch/seal/key/signature/expiry와 authority unavailable 거부, native probe→startup 사이 DDL fence 및 profile resource bound를 포함한다. 전체 신규 HRIS CRUD는 G4이며 이 공통 startup 권한 충돌은 G4/G6로 미루지 않는다.
