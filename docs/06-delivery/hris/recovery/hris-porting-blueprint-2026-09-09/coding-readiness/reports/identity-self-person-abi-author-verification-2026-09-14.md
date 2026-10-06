# SelfPerson 공통 신원 조회 ABI 작성자 검증

상태: **AUTHOR ONLY / 미게시·미배선 후보 / G3 CLOSED / COMMON P0 OPEN**.

고용 배정·근무지·근태 모듈 데이터 없이 자기 People 신원 메타데이터를 조회하는 별도 ABI와 native SELECT-only reader를 구현했습니다. 기존 Auth→person 소유권과 native person row/version/state를 재사용하며 별도 신원 원장·DDL·이메일/이름/UUID 우연 동일 fallback은 만들지 않았습니다.

- neutral `SelfPersonPortV1.resolve()`는 caller 입력 0개/current-only이며 guard가 SELF_PROFILE_READ/HRIS_HRM query를 발급합니다.
- 기존 AuthorityVerifier/AuthBindingProvider SPI를 재사용하고, guard만 private PersonLookup/검증 결과를 발급합니다. 공개 carrier는 미검증 데이터일 뿐 권한 토큰이 아닙니다.
- People reader는 `public.ppl_persons` tenant_id/public_id/version/lifecycle_state 4개만 읽습니다. worker/relationship/assignment/location/TIM/Auth DB/개인정보 조회는 없습니다.
- profile 정책은 allowedPersonStates만 적용합니다. 고용 status 정책·assignment 선택·시간대는 요구하지 않으며 INACTIVE는 명시적 owner policy로만 허용합니다.
- verifier/Auth/People 호출 후 단계별 현재 Clock을 다시 읽고 역행·authority/Auth/person 만료 및 capture를 검사합니다. Auth rowVersion/accessRevision은 authority의 기대값과 정확히 결속하며 personVersion은 최신 native row에서 읽고 음수를 거부합니다. personVersion을 외부 signed current proof에 결속한 상태는 아니며 실제 revoke fence도 아직 OPEN입니다.

## 실제 작성자 실행

UTC 2026-09-14T05:10:15.667368+00:00 → 2026-09-14T05:10:33.436058+00:00, 17.768061초, exit0. 선택 test task 2개 모두 task-local `--rerun`으로 실행했습니다.

**3 XML / 72 고유 cases / 0 failure / 0 error / 0 skip**: neutral typed guard48 / JDBC boundary16 / 실제 격리 native PostgreSQL8. 195 관련 source SHA-256와 decimal-string mtime ns는 실행 전후 동일합니다.

실제 typed 거부 fixture는 adapter 부재(호출0), tenant/person/principal/plane 불일치, 현재 APP/SoD 거부, native version/access revision 변경, cached/future/expired capture, 상태 정책, owner-stage expiry/clock regression, SQL redaction을 exact code/provider-call-count로 assert합니다. 진행 Clock 정상·최종 발급 만료도 실제 실행했습니다.

native8은 person-without-worker, location-less native assignment, **Clock.systemUTC 실제 진행 조회**, 최신 native person version/state, INACTIVE allowlist, missing/cross-tenant/UUID alias 거부, MERGED 거부, column SELECT 철회/redaction, runtime 최소4column/PII·고용·history·DML·DDL·TEMP·SET ROLE 거부를 포함합니다. 실제 owner V1..V49를 그대로 migrate했고 runtime은 SELECT-only이며 owner fixture만 role/데이터를 만듭니다. 사용자 주 DB/서버는 건드리지 않았습니다.

첫 72 PASS의 도구 출력 budget이 작아 manifest JSON이 절단된 문제는 그대로 기록했습니다. source를 변경하지 않고 다시 72를 신선 실행해 완전한 최종 증거를 수집했습니다. JSON에는 정확 argv/UTC/exit/HEAD/tree/승인된 dirty snapshot, 195 source pre/post, 11 후보파일 pins, 모든72 ID/결과, 실제 3 XML SHA/ns 및 gzip+base64 원본 archive를 보존합니다. XML은 이후 다른 선택 test 실행으로 교체될 수 있어 archive의 SHA를 재검증할 수 있습니다. 실행에서 생성된 PostgreSQL/Ryuk 2개만 read-only inspect해 exact ID REMOVED를 확인했으며 임의 서버/container를 종료하지 않았습니다.

source-size/test-size/SCC/unused-private 4개 read-only static도 통과했습니다. 이는 이후 root가 추가한 무관한 Control 파일까지 포함한 최신 full backend check라는 의미는 아닙니다.

## 미완료 경계

**Authority/Auth는 EXPLICIT MOCK ONLY입니다.** native People owner query 성공을 실제 Auth endpoint/Gateway end-to-end/current PEP/APP entitlement issuer, signed transport/freshness, relink/revoke/lifecycle ordering, runtime DS admission 또는 전체5모듈 준비완료로 확대하지 않습니다. 개인정보 profile field masks 및 고용 purpose의 물리/business date-zone 계약은 별도 OPEN입니다.

기존 고용 ABI/reader79/역사 SQL/Control/Gate/정본은 이 작업으로 변경하지 않았습니다. commit/정본전파 0이며 root의 독립 검토·재실행 전 작성자 후보만 제출합니다.
