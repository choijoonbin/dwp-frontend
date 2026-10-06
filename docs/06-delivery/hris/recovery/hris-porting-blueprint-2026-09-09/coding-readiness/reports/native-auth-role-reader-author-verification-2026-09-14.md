# Native Auth 역할 원천 읽기 브리지 — 작성자 검증

상태: AUTHOR_ONLY / UNWIRED / G3_CLOSED. 기존 권한·신원 원천을 재사용하는 READ pilot이며 설치·전체 HRIS 권한 적용 승인이 아닙니다. Root의 독립검토/재실행 전 작성자 증거입니다.

## 실제 결과

| 실행 | 실제 결과 | 시간 |
| --- | --- | --- |
| 최초 컴파일 | exit1, test0 — 신규 test Runnable 문법 오류 | 10.335823s |
| 문법 수리 후 첫 unit | 15, failure/error/skip0 | 17.345390s |
| 첫 PG16 fixture | initializationError1, reader 도달 전 user_id9 역사 시드 충돌 | 23.645217s |
| 최종 PG16 | native27, failure/error/skip0 | 25.795329s |
| 최종 PG18.4 | 같은 native27, failure/error/skip0 | 17.287595s |
| 최종 unit | 15, failure/error/skip0 | 6.985237s |

최종 고유42개(단위15+native27), 최종 실행69개(15+27+27)입니다. 두 DB 실행을 서로 다른 고유 사례로 더하지 않았습니다. 정확한 UTC/argv/exit/tasks/case IDs/XML gzip/SHA는 [작성자 JSON](/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/reports/native-auth-role-reader-author-verification-2026-09-14.json)에 보존했습니다.

모든 실행은 host hris-verification lock, 최대30초 잠금 대기, --no-daemon / --max-workers=1 / test-local --rerun, 최대180초 timeout입니다. 실제 timeout은 없었습니다. 최종 세 배치의 관련205개 source SHA/bytes/decimal-string ns 전체가 같고 각 실행 전후에도 동일합니다. 전체 backend source/current G0 catalog 증명으로 확대하지 않습니다. 승인된 다른 작성자의 신규 core namespace는 별도이며 실행 중 core compile task의 UP-TO-DATE/실행 여부도 원문에 남았습니다.

## 새 파일4개

기준 checkout: /Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend.

| 파일 | SHA256 | lines | bytes | exact ns |
| --- | --- | --- | --- | --- |
| Auth service NativeHrisAuthIdentityEvidenceTruthV2.java | 1e2cf221f55d0bf8747fcc533b3d6f6125894ca9ffaa6bd64f2862413f230be2 | 25 | 1315 | 1789374221626453277 |
| Auth service NativeHrisCurrentRoleEvidenceReaderV2.java | e7aa8868b0dfaba0481123d4fb7fed1d3b152bf402125e39c64c4f871abaa1ce | 174 | 14005 | 1789374744821480696 |
| Auth service test NativeHrisCurrentRoleEvidenceReaderV2Test.java | a4e48a15baea88581621233765b0fe6c96d9f841ecdc4379c8238e7d75fe4fa1 | 94 | 7880 | 1789374837368367006 |
| Auth service test NativeHrisCurrentRoleEvidenceReaderV2PostgresTest.java | ddff93ede1b2364a344b315a748345b44e2f79592d87bd4ea12a5558652dc013 | 212 | 19919 | 1789374846968626071 |

main 경로는 dwp-auth-server/src/main/java/com/dwp/services/auth/service/, test 경로는 dwp-auth-server/src/test/java/com/dwp/services/auth/service/입니다. 기존 People7/frozen v2 six/기존 v1 reader/build/SQL/공유 registry/route/Gate를 이 작업에서 변경하지 않았습니다. 신규4를 동결했고 commit/정본 전파하지 않았습니다.

## 원천과 신뢰 경계

Auth native com_users의 tenant/user/publicUUID/personUUID(nullable)/identity_plane/status/version/access_revision을 private guard-issued lookup의 actor와 정확히 비교합니다. ACTIVE TENANT만 읽고 null person은 non-SELF actor에서 허용합니다. actor person과 대상 People person을 UUID 우연일치로 연결하지 않으며 대상에 Auth 계정이 있어야 한다는 조건을 만들지 않습니다.

실제 ProductAuthorizationIdentityEvidenceService.load를 factory로 재사용합니다. 기존 permissions·roles·responsibilities·scoped duties hash 알고리즘의 auth-* 문자열을 그대로 두며 새로운 hash 규칙/해시→long/가짜 counter를 만들지 않습니다. native roleCodes 전체 집합은 owner truth 및 lookup auth-*와 일치해야 합니다.

DIRECT는 com_role_members, GROUP는 com_group_role_assignments + com_group_members + com_groups, PRIVILEGED는 com_active_privileged_grants이며 active tenant-local com_roles를 join합니다. GROUP의 ACTIVE assignment_type/lifecycle_state, ACTIVE group, TENANT/no scope_ref, native window를 모두 적용합니다. ORG_UNIT/RESOURCE 그룹 범위를 TENANT로 격상하지 않습니다. DIRECT/PRIV에 없는 source version을 만들지 않습니다. role/assignment/group native versions와 updated_at, membership ID/stamp를 최종 refetch 비교에 포함합니다.

흐름은 native read → truth1 → native read → truth2 → final native read이며 매 단계 Clock을 다시 읽고 monotonic/현재 actor·authority 만료를 확인합니다. final expiry는 최초 시각+lease, actor/authority expiry 및 모든 선택된 native validTo의 최솟값입니다. 마지막 truth callback 중 actor/group stamp 변경도 거부했습니다. 이는 최종 SQL 이후의 분산 revoke 경쟁을 막는 mutation fence가 아닙니다.

factory/source/clock/lease가 없으면 clock·truth·SQL 호출0으로 거부합니다. 요청 헤더/본문 roles, X-DWP-Roles, email/name/correlation fallback은 없습니다. carrier는 raw/untrusted이고 HTTP 신뢰 증명을 민트하지 않습니다.

## native27 사례의 실제 범위

native binding/read-only case, scoped/inactive/revoked/eligible/future/expired GROUP 및 inactive role8종, native actor revoked/rowVersion/accessRevision/principal relabel/person relink/foreign tenant6종, no-person non-SELF, 합법 dot/hyphen 코드, 전체101개 source failclosed, native roleVersion/actor/group stamp 중간 변경, 다른 auth digest, provider redaction+최종 lease expiry, UI resource grant role_id0 분리, runtime DDL/TEMP/WRITE/history/SET ROLE/SELECT privilege 손실 거부, V108 privileged activation 23514를 실행했습니다.

실제 RoleMemberRepository @Query native SQL을 fixture의 owner API mock이 실행했고, 실제 IdentityEvidenceService factory/hash는 실행했습니다. 하지만 AuthService/permission/governance/duty API와 Gateway/DwpAuthoritySnapshot/APP/SoD/current session은 명시적 MOCK composition입니다. 실제 AuthService JPA/native permission/duty/Gateway 서명 전구간 PASS가 아닙니다. neutral v2 guard가 실제 private lookup을 민트하지만 callback에서 멈춰 verified 최종 권한을 만들지 않습니다.

격리 PG에서 변경하지 않은114개 Auth Flyway migrations(최신212)를 실행했습니다. owner만 migrations/grants/synthetic data를 관리했고 runtime LOGIN은 필요한 columns SELECT만 갖습니다. People DB에 접근하지 않습니다. 개인정보/display payload/history를 runtime이 읽지 못하는 것도 실제 검증했습니다. credentials는 메모리만 사용하고 보고서에는 원문 secret을 보존하지 않았습니다.

현재212에서는 healthy active PRIVILEGED origin이 없습니다. 변경하지 않은 V108이 INSERT를23514로 거부했습니다. trigger 우회/비활성화/fixture ALTER로 건강한 JIT를 만들지 않았고 legacy107→212 live grant upgrade는 구현/승인했다고 주장하지 않습니다.

## 최초 실패와 보존

최초 컴파일은 신규 test64행 Runnable을 Executable로 넘긴 실제 문법 오류였습니다. call::run과 신규 예외 serialVersionUID 경고만 수정했습니다. 최초 native 실패는 migration seed user_id9와 fixture PK 충돌로 beforeAll에서 발생했고 독립 owned principal900009로만 바꿨습니다. production 보안 조건/기대 거부/역사 SQL을 바꾸지 않았습니다. 두 최초 실패는 별도 JSON에 원문·source manifest·XML(존재한 경우)을 보존했습니다.

[읽기 검증/정리 receipt](/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/reports/native-auth-role-reader-author-archive-readback-2026-09-14.json)는 세 source manifests 및 다섯 XML gzip SHA/case count, 현재 source4 SHA/ns를 실제 다시 대조한 기록입니다. XML에서 확인한 owned PG/Ryuk6IDs는08:38:25UTC safe docker inspect에서 모두 no such object였습니다. stop/remove0이며 주 PostgreSQL/Redis/Kafka 및 다른 작성자의 컨테이너는 건드리지 않았습니다. 최초 absence 분류가 Docker lowercase 오류문구를 놓친 진단 한계도 receipt에 정정했습니다.

## 남은 준비 및 표기 정정

현재 native role evidence를 provider로 읽는 것만 검증했으며 trusted Gateway route/scope/psr transport, 실제 Auth native permission/duty proof 생산·등록, ROLE subject People 정책 conjunction, HRIS atomic duties/purpose/dynamic SoD, mutation current-owner/CAS/fence, 설치·전체 current backend checks·G3 승인은 남아 있습니다. missing adapter/default grants를 권한 허용으로 치환하지 않습니다.

원본 author JSON c06a3ee3041fc2bbdbce7cbac708ba83699af4531c5aa25bec5d361f1415c9c7의 remaining 설명에서 frozen People7 regex를 [A-Z][A-Z0-9_]{0,49}로 잘못 요약했습니다. 실제 [NativeHrisUserPolicyAdmissionPilotV2.java](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-people-server/src/main/java/com/dwp/services/people/hris/identity/v2/NativeHrisUserPolicyAdmissionPilotV2.java:148)는 [A-Z][A-Z0-9_]{1,79}입니다. source/실행 SHA는 바뀌지 않았고 원본 JSON은 보존했으며 successor receipt에서 정확한 식을 정정했습니다. 실제 Auth CreateRoleRequest는 [A-Za-z][A-Za-z0-9_.-]{0,49}를 허용하므로 People7는 dot/hyphen뿐 아니라 single-letter도 제한합니다. 새 Auth reader는 native 규칙과 owner trim/uppercase를 적용했으며 이 호환성 문제는 frozen People7 변경 없이 별도 USER+ROLE successor에서 다루어야 합니다.
