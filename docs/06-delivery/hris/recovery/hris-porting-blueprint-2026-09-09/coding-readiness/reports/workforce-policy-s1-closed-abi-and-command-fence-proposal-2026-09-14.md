# Workforce policy S1 닫힌 ABI 및 S2/S3 명령 fence 보완안

상태: `READ_ONLY_CLOSED_ABI_PROPOSAL_UNPOSTED_NOT_IMPLEMENTED` / `G3_CLOSED_COMMON_P0_OPEN` / readiness=false.

이 문서는 Root 검토 전의 설계 후보입니다. 생산 코드 변경 0, 실제 unit/native 테스트 실행 0입니다. S1 읽기 증거는 정책 생성·철회 permit가 아닙니다. 15개 fixture group과 기존 29개 사례의 단계 배정을 정의했으며, 계획 수를 실행 결과로 사용하지 않습니다.

## 1. 보존 및 출처

기존 [owner connection 계획](workforce-policy-native-owner-connection-plan-2026-09-14.md)은 변경하지 않았습니다. 기존 JSON SHA `1f2246acfcf4194285fe67b3e75bc60d62eaba57c86bba1c111afd4904128a0f`, MD SHA `a2a2e6dd143ab162e7b8e9ab81a227663ba93650ddb15d786f5ba3fb5d024f41`입니다.

integration backend HEAD `db0d2b5067e6fbee27ee58121c5a4406cab132b9`. 선정한 실제 native 소스 66개를 2026-09-14T10:02:08.248860+00:00와 2026-09-14T10:12:50.619668+00:00에 읽어 SHA와 decimal-string mtimeNs를 비교했고 모두 동일했습니다. 전체 저장소 clean이나 full PEP 승인을 뜻하지 않습니다. 각 파일의 SHA·행수·타입 출처는 [동반 JSON](workforce-policy-s1-closed-abi-and-command-fence-proposal-2026-09-14.json)에 있습니다.

## 2. 닫힌 S1 ABI

단일 경로: `POST /internal/auth/v2/workforce-policy-governance/evaluate`.

공개 생성 가능한 carrier는 모두 UNTRUSTED입니다. 내부 adapter/guard만 현재 native 소스 검증 후 private verified 결과를 발급합니다. 성공 kind는 `AUTH_WORKFORCE_POLICY_READ_EVIDENCE_V1`, boundary는 `READ_ONLY_NOT_COMMAND_PERMIT`입니다. People 정책·조직 UUID/version은 검증된 owner proof가 아니라 요청 기대값이며, `NOT_PERFORMED_PEOPLE_NATIVE_REFETCH_REQUIRED`로 명시합니다.

요청은 schemaVersion, operationId, requestNonce, expectedActor(nullable), expectedAuthContext(nullable), governanceScope, candidate, expectedRequestDigest(nullable)만 허용합니다. 모든 필드는 required이고 nullable은 명시한 필드에만 허용합니다. candidate는 NONE/CREATE_POLICY/REVOKE_POLICY의 닫힌 tagged union이며 operation과 정확히 일치해야 합니다. CREATE는 DIRECTORY를 포함한 fieldGroups·READ/EXPORT action·native ROLE50 또는 USER·population·nullable window·justification 전체를 포함합니다. REVOKE는 People policy UUID/version 기대값과 저장된 subject 기대값·reason을 포함하지만 실제 before row를 증명하지 않습니다.

응답은 성공 또는 redacted 오류의 oneOf입니다. 성공은 native actor/tenant/session/scope/authorization/recipient fact, control ID/digest, captured/issued/expires를 포함합니다. 오류는 닫힌 25개 code와 nullable 검증된 nonce/operation만 포함하고 SQL·raw cause·토큰·권한 상세를 반환하지 않습니다. 필드별 native 타입·Java 타입·출처 74개와 request/response draft-07 exact schema는 동반 JSON에 있습니다. 이 schema는 normalized carrier의 형식 정의이며 JSON schema 통과만으로 native 권한이 되지 않습니다.

| 값 | native/전송 타입 | 신뢰 및 nullable |
| --- | --- | --- |
| tenant/user/role ID | BIGINT → canonical decimal JSON STRING | positive signed-long; DB ID를 UUID로 변환하지 않음 |
| rowVersion/accessRevision | BIGINT → decimal STRING | nonnegative; 두 actor stamp 별도 |
| principal/person public ID | native UUID → canonical lowercase UUID | actor person만 nullable; UUID 우연 동일성 fallback 금지 |
| authRevision | 실제 `auth-*` STRING | 기존 native factory 생성 그대로; hash→long 금지 |
| policyRevision / contextKey | opaque policy STRING / `psc-*` STRING | 실제 owner 값; Gateway `psr-*`와 구분 |
| user/tenant/role updatedAt | TIMESTAMP WITHOUT TZ → LocalDateTime | equality stamp; UTC/서버 zone freshness 변환 금지 |
| session/catalog/source window | TIMESTAMPTZ → Instant | 실제 owner Clock/min-expiry; nullable 원본 window만 null |
| requestNonce/evidenceId/digests | control UUID / SHA256 STRING | business public ID·authRevision 대체 금지 |

Auth V7에 실제 `com_tenants.version`이 있습니다. Tenant.java에 @Version이 없다는 이유로 native version 부재라고 판단하지 않습니다. JDBC로 version·ACTIVE·public_id·LocalDateTime updated_at tuple을 읽되, unmapped version 하나가 모든 write에 진전한다고 주장하지 않습니다. `com_roles.role_id`는 BIGINT이며 role_family는 builtin_role_code→sys_builtin_role_catalog에서 읽습니다. catalog.version은 없습니다.

## 3. 서버 operation·MANAGE·duty·SoD

서버 enum은 POLICY_LIST_AUTH_READ, ORGANIZATION_OPTIONS_AUTH_READ, POLICY_CREATE_PREFLIGHT_AUTH_READ, POLICY_REVOKE_PREFLIGHT_AUTH_READ 네 개입니다. 각각 후보 kind를 서버가 선택하며 클라이언트 선언 duty/field/purpose boolean은 권한이 아닙니다.

네 operation 모두 현재 REST 의미를 보존해 `ADMIN.WORKFORCE_ACCESS:MANAGE`가 필요합니다. VIEW는 거부합니다. APP.HCM/APP.HRIS는 현재 identity factory의 실제 호환 alias만 재사용합니다. 네 operation은 하나의 제안 capability `hcm.workforce-policy.governance-read`, duty `WORKFORCE_POLICY_GOVERNANCE_READ`, known SoD `SOD-HRIS-WORKFORCE-POLICY-AUTH-READ-V1`에 결속합니다. V91 duty/permission unique tuple 때문에 동일 MANAGE에 임의의 네 capability를 중복 심지 않습니다.

이 HRIS registry/duty/SoD는 현재 생산 등록이 없는 후보입니다. 미등록·DRAFT·unknown은 DENY/UNAVAILABLE입니다. 현재 approvals-only ScopedAdminDutyPolicy의 switch/default false, ADMIN 역할, 전체 개발 오픈으로 승계하지 않습니다. native baseline의 정상 기대는 미등록 거부입니다. 양성 fixture는 기존 테이블에 명시적 TEST_ONLY catalog를 구성하고 실제 기존 factory/evaluator를 실행하는 범위로만 계획합니다.

고객 TENANT identity plane에 HR_ADMIN의 native PEOPLE family는 정상입니다. family=TENANT만 강요하지 않습니다. PROVIDER plane/prefix/family는 거부하고 custom role의 reserved builtin 위장도 거부합니다.

## 4. 엄격 decoder·ROLE·digest

본문은 UTF-8 32KiB streaming 한도를 적용합니다. nested duplicate·trailing token·unknown field·coercion·undeclared null·unsupported schema를 거부합니다. schemaVersion은 integral numeric node 1만 허용해 true, string, 1.0을 거부합니다. BIGINT STRING은 leading zero/plus/whitespace/exponent/overflow를 거부하고 signed-long range를 파싱합니다. UUID는 nonzero parse/reemit equality, 날짜는 실제 civil date와 canonical Instant/LocalDateTime을 검증합니다.

ROLE는 business trim만 허용하며 lowercase를 upper-case로 승인하지 않습니다. native create grammar `^[A-Z][A-Z0-9_.-]{0,49}$`로 R/A.B/A-B가 정상입니다. validation/catalog lookup/digest/storage의 normalized 값은 동일해야 합니다. 기존 People legacy80 grammar OR native50은 저장된 행 inspection/revoke 기대값에만 허용하며 새 grant/native ROLE proof로 사용하지 않습니다. DIRECTORY 필수 및 legacy USER override는 변경하지 않습니다.

DWP canonical recipe는 sorted object keys, compact UTF-8 JSON, explicit null, BIGINT decimal strings, semantic-set field/action arrays 정렬, trim reason/justification을 사용합니다. locale folding·Unicode NFC 보정은 하지 않습니다. RFC8785 구현이라고 주장하지 않습니다.

candidate preimage는 canonicalVersion=DWP_WORKFORCE_CANDIDATE_V1 + operationId + full normalized candidate입니다. request preimage는 canonicalVersion=DWP_WORKFORCE_REQUEST_V1 + expectedRequestDigest만 제외한 full normalized request입니다. 서버가 항상 계산하고 nullable expected digest는 비교만 합니다. control hash가 native auth-*를 대체하지 않습니다.

읽기 전용 synthetic preimage 계산의 candidate SHA는 `c837ec7d974767a72ac0bb5e6d136546e0a15e10b6c5410ce42e0d56f95f27c7`, request SHA는 `debf3359aff1e06be9c596712c030075e9aaea98f9da9695bd0f580775b14c46`입니다. 전체 UTF-8 preimage는 JSON에 있고 native Auth/unit 테스트 또는 권한 proof가 아닙니다.

## 5. 정확 내부 security chain

신규 chain Order 1, exact endpoint/method만 담당합니다. 현재 ProductOperations(-2), ApprovalRecovery(-1), ProductSurface(0), SCIM(3), JWT(4)를 수정하지 않습니다. 소유 경로의 encoded/dot/trailing/semicolon 변형은 거부하며 /internal/**로 넓히지 않습니다.

단일 헤더 세 개를 요구합니다: 전용 `X-DWP-Workforce-Policy-Governance-Token`(전용 config, constant-time 비교), 정확 `X-DWP-Service-Identity: dwp-people-server`, 실제 사용자 `Authorization: Bearer ...`. duplicate/missing/ambiguous old service-token 헤더·잘못된 caller·cookie-only를 decoder 전에 거부합니다. X-User/Tenant/Roles/Permissions/Person/resource-role 표시는 authority가 아니며 신규 경로에서 거부합니다. expectedActor 본문은 native 비교용입니다.

현재 JwtConfig HS256 decoder + default validators + AuthSessionJwtValidator를 그대로 재사용합니다. 기존 encoder에는 iss/aud가 없으므로 없는 claim을 가정하지 않습니다. native sub/tenant_id numeric string, jti→token row, sid→session_family_id, native assurance/current-role/session 상태를 검증합니다. sid는 session_id가 아닙니다. iat는 native issued_at의 epoch-second floor와 비교해 native microsecond를 허위 mismatch로 만들지 않습니다.

이 경로에서 strict current Clock exp>now를 보완하고 native ACTIVE TENANT actor/ACTIVE tenant, revoked/absolute/idle expiry를 재검사합니다. native superseded grace는 유지하되 그 expiry로 evidence를 제한합니다. active JWT로 같은 READ를 반복하는 것은 허용하며 매번 fresh source/new evidenceId를 발급합니다. 철회·만료·grace 만료 JWT replay는 거부합니다. 가짜 S1 consume ledger를 만들지 않습니다.

STATeless/CSRF disable은 이 Bearer+service-token 경로에만 적용하고 기존 browser/cookie/public 정책은 보존합니다. malformed body가 native JWT 검증 뒤에 파싱될 수 있으므로 body-invalid의 adapter/factory0과 ingress-invalid의 decoder0을 구분합니다. 모든 S1 People 정책 DML은 0입니다.

## 6. native refetch·최종 expiry·ABA

A/B owner 조회는 별도 read-only transaction 및 persistence context를 사용합니다. 같은 EntityManager의 캐시 엔티티를 반복 load한 것을 current refetch로 인정하지 않습니다. fixed parameterized native actor/session/catalog/scope/ROLE source tuple과 실제 변경하지 않은 identity factory 및 active policy/evaluator를 각 단계에서 읽습니다.

각 owner 호출 직후와 발급 직전 Clock을 새로 캡처하고 non-regression을 확인합니다. actor2stamps/tenant native tuple/session windows/actual scope UUID+versions/native auth-/policy-/psc-/complete ROLE+duty IDs·versions·state·windows·catalog stamp를 A/B 비교합니다. membership 교체로 code/hash가 같아도 actual source identity가 바뀌면 무시하지 않습니다. UI IdentityAccessEvidenceRepository의 role_id0 resource grant/다른 scope GROUP는 current role proof가 아니며 기존 Auth4 native complete source reader를 재사용합니다.

expiry는 A/B 양쪽 lease와 native role/group/duty validTo·revalidateAt, JWT exp, session absolute/idle/grace, 최초 capturedAt+30초의 최소입니다. 더 긴 두 번째 lease로 첫 bound를 늘리지 않습니다. expiresAt<=최종 issuedAt이면 거부합니다. 이 비교는 읽기 당시 current snapshot이지 remote People COMMIT까지의 선형화 proof가 아닙니다.

## 7. 실제 사례의 단계 배정

기존 29개 A 사례는 동반 JSON에 하나씩 S1/S2/S3로 배정했습니다. S1은 native Actor/tenant/recipient/pointer/freshness/parser/dual-token+JWT/known duty·SoD/MANAGE의 사실 및 거부만 검증합니다. A09 실제 actor-held ROLE self-grant, A10 자기 USER override 철회 후 권한 증가, A11/A12 target-org∧field/USER override, A13 실제 서비스 producer, A15–A17 CAS/rollback, A28 두 owner 경합, A29 실제 revoke→read는 S2의 업무 실행으로 남깁니다. A25 public route/psr cutover는 S3입니다.

신규 S1 test3개에 15개 planned group을 배정했습니다: unit6, native6, security/nativeJWT3입니다. 기존 테스트 수·mock boolean을 actual native 생산권한 증거로 재사용하지 않습니다. 이후 actual 실행은 original failure 보존, fresh XML 고유 case IDs·0 skips, selected source SHA/ns 및 owned-container cleanup으로 기록해야 합니다.

## 8. S2/S3 별도 명령 계약

명령 kind는 `AUTH_WORKFORCE_POLICY_COMMAND_PERMIT_V1`이며 READ carrier는 파싱/캐스팅/소비할 수 없습니다. 필수 typed permit fields와 reserve/consume/reportOutcome/reconcile RPC shape는 JSON에 있습니다. native actor2stamps와 auth/policy/psc/psr STRING, exact command/route/purpose/audience, native recipient/scope stamp, 실제 locked People target before, full candidate digest, 고정 consume/completion deadlines, real native transition/commit receipts를 결속합니다. client COMPLETED boolean은 receipt가 아닙니다.

제안 선형화점은 실제 Auth native ISSUED→CONSUMED CAS이며 모든 관련 actor/duty/permission/catalog/pointer 활성·철회 writer가 같은 native fence 또는 증명한 동등 순서를 참여해야 합니다. consume 전에 ordered revocation이 있으면 거부하고, consume 이후에는 정확한 단일 명령만 bounded deadline에 완료 가능한 의미를 제안합니다. 이후 revoke가 People COMMIT까지 반드시 이겨야 한다면 이 단순 consume 의미는 불충분하며 durable cancel/coordination은 P0입니다. 이 결정은 Root 검토가 필요하고 닫힘으로 처리하지 않습니다.

People locked before/parent→Auth consume→People mutation+unique command receipt+outbox의 단일 local transaction→검증된 commit outcome으로 연결합니다. remote JDBC lock 유지/2PC/in-memory 가짜 permit/StepUp replay row·audit event의 permit 대용은 사용하지 않습니다. 응답 유실·commit 불명은 same permit/command/digest로 native refetch/reconcile하며 새 UUID/명령으로 자동 재시도하지 않습니다. 변경 digest/target/actor/route는 거부합니다.

실제 durable Auth permit/outcome store, People receipt publication, verified transport, writer fence가 없습니다. S1 scope에 이를 위한 승인 DDL도 없습니다. missing native provider/store/fence는 UNAVAILABLE/People DML0이며 S2/S3 Gate CLOSED입니다. native revoke-vs-consume race/actor-dutypointer ABA/expiry/lost reply/commit fail/duplicate/different digest/own USER reveal/UNKNOWN no-retry를 별도 실제 두-owner fixture로 검증해야 합니다.

## 9. 다음 최소 승인 범위

후보 production4개는 neutral `com.dwp.platform.contracts.hris.workforce.v1.WorkforcePolicyGovernanceV1`, Auth authority adapter/controller/exact security config입니다. test3개는 Auth adapter unit/native PG와 exact security chain입니다. 정확 전체 경로는 JSON에 있습니다. Root ABI/fence 검토 전 생산 작성은 0이며 기존 factory/JWT/v1-v3/Auth4/People7/Control/core/build/SQL/registry/Gate/legacy REST 의미는 수정하지 않습니다.

S1 작성자 mock 또는 native 읽기 양성을 전체 PEP·정책 mutation·실제 Gateway transport·5모듈 G3 승인으로 승계하지 않습니다. 현재 여섯 항목: native HRIS duty·known SoD 등록, actual current transport/owner publication, locked People target/정책 mutation, durable consume/revoke fence, public route+PEP integration, 독립 실제 경합 검증이 OPEN입니다.

