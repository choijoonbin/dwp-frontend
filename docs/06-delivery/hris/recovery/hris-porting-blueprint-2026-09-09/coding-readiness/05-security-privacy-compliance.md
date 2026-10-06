# HRIS 보안·개인정보·컴플라이언스 계약

## 1. 권한 모델

별도 HRIS 권한 엔진을 만들지 않는다. DWP 권한 체계를 다음 교집합으로 확장한다.

```text
ALLOW = authenticated tenant
     ∩ HRIS app entitlement
     ∩ atomic capability/action
     ∩ target population/resource scope
     ∩ field projection policy
     ∩ approved purpose where required
     ∩ state precondition
     ∩ SoD pass
     ∩ step-up pass for high risk
     ∩ no explicit deny
```

`직원·관리자·업무운영자·설정관리자·전사감사자`는 UI 분류이며 거대 상위 role이 아니다. 실제 access package는 `hris-permission-group-matrix.csv`처럼 업무/위험 단위로 atomic duty를 조합한다. 그룹 membership, direct grant, delegation, support session, 기간과 겹치는 scope를 합친 effective permission으로 SoD를 평가한다.

## 2. PEP 배치

| 계층 | 책임 |
|---|---|
| Frontend | 메뉴/행동 projection과 설명; 보안 정본 아님 |
| Gateway | app entitlement, route contract, rate/size limit, trusted actor context |
| Owner service | capability, resource/population, state, dynamic SoD, purpose, field mask의 최종 판정 |
| Repository | tenant와 대상 scope predicate, high-sensitivity RLS |
| Worker | command 수락 당시뿐 아니라 실행 시점의 권한/정책 revision 재확인 |

Tenant/Platform Admin, provider support, 개발자 계정은 HRIS 데이터 권한을 자동 상속하지 않는다. support는 tenant consent, ticket/purpose, 제한 scope, 만료, step-up, session watermark와 강화 감사를 요구한다.

## 3. 민감도와 필드 정책

최소 분류는 `PUBLIC / INTERNAL / CONFIDENTIAL / HIGHLY_RESTRICTED / STATUTORY_RECORD`다. 필드 그룹은 기본 프로필, 연락처, 고용, 보상, 은행, 세무/보험, 개인식별, 근태 원시기록, 휴가 사유증빙, 성과 비공개, 감사 projection으로 나눈다.

- API serialization 전에 allowlisted projection을 생성한다.
- masking은 값의 일부를 노출해도 안전한 경우만 사용하고 그 외는 redact한다.
- query/filter/sort/autocomplete/count도 field 권한을 적용해 inference를 막는다.
- `REDACTED_PAYLOAD`는 원문 payload나 object 내용을 뜻하지 않는다. 이 field group은 digest, count, allowlisted error code만 허용하며 원문 값·파일 byte·secret·임의 경로는 항상 제외한다.
- 대량 반출, 급여, 계좌, 개인식별, 비공개 성과, 설정 게시, 마감/재개방은 강화 감사와 필요 시 step-up을 요구한다.
- 로그·trace·metric label·exception·event에는 민감 원문을 금지한다.

## 4. 데이터 보호

- 전송 TLS, 저장 암호화, secret manager/KMS reference를 사용한다.
- 계좌·국가식별자는 token vault 또는 별도 restricted store에 보관하고 일반 도메인에는 token/last4만 둔다.
- 암호키 rotation과 crypto-shredding 가능성을 설계하되 법정 보존과 충돌하면 record class별 정책을 적용한다.
- file은 tenant별 object prefix, hash, malware scan, content-disposition, TTL, legal hold를 가진다.
- test/Design AI/로그에는 합성 데이터만 사용하며 실제 PII를 반출하지 않는다.
- backup/replica/export에도 같은 분류·암호화·접근통제를 적용한다.

## 5. 개인정보 lifecycle

처리목적, 수집근거, 최소필드, 보존기간, 접근자, 제3자 제공/국외이전 여부를 data-product/field group에 연결한다. 정정·삭제·제한·열람·portable export 요청은 owner workflow와 감사 receipt를 가진다. 삭제는 운영 projection, search index, cache, object, analytics에 전파하며 법정 보존 record는 legal hold와 제한처리로 전환한다.

Country pack이 법적 보존기간과 문서 요건을 제공하더라도 실제 국가별 법률 승인은 G6 이전 실명 법정/Privacy 책임자가 해야 한다. 설계 문서나 에이전트 검증은 법률 승인으로 간주하지 않는다.

## 6. 위협과 필수 방어

| 위협 | 필수 방어/시험 |
|---|---|
| cross-tenant IDOR | trusted tenant context, repository predicate/RLS, 다른 tenant public ID negative test |
| 권한 cache 잔존 | entitlement/scope revision, 짧은 TTL, revoke event, in-flight/job 재평가 |
| 급여/성과 추론 | field-aware count/filter/export, small-cell suppression, 목적기반 접근 |
| self approval/SoD 우회 | effective permission + object relation guard, assignment/group/delegation mutation test |
| replay/double pay | idempotency hash, expected version, provider key, immutable receipt |
| formula/config injection | declarative DSL/schema, no eval/script/SQL, signed country/extension pack |
| malicious import | size/type/schema, formula injection neutralization, quarantine, malware scan |
| SSRF/connector abuse | allowlisted endpoint policy, egress proxy, DNS/IP validation, secret reference, timeout |
| event poisoning | schema registry, signature/producer identity, tenant/sequence validation, inbox quarantine |
| log leakage | structured allowlist logging, redaction tests, low-cardinality metric dimensions |
| support misuse | tenant consent, time-bound session, purpose, step-up, watermark, immutable audit |
| dependency compromise | pinned lock/BOM, SBOM, license/vulnerability gate, provenance and artifact signature |

## 7. Audit 계약

감사 event에는 actor/delegation/support session, tenant, capability, purpose, target type/public ID, scope/field policy revision, before/after digest 또는 안전한 diff, state transition, correlation/causation, outcome/error code, step-up, timestamp를 기록한다. 민감 원문을 복제하지 않는다. 감사 outbox 실패는 high-risk domain commit과 분리되지 않아야 하며, collector 장애 때 durable retry와 alert가 발생한다.

## 8. Secure delivery Gate

- threat model과 data-flow diagram 갱신
- tenant/scope/field/SoD/step-up negative matrix
- SAST, secret scan, dependency audit, SBOM/license
- API fuzz/property tests와 import/parser resource limits
- security headers, CSRF/CORS/token audience, rate/size limit
- migration/RLS/DB role invariant tests
- 로그/trace/event PII leakage tests
- high-risk command replay/CAS/result-unknown tests
- country/extension/connector signature and fail-closed tests

실제 penetration test와 production key/secret/egress review는 G6 activation 증거다.

## 9. 기존 Approval 운영 DB 역할 상속 복구 경계

신규 또는 폐기 가능한 G3 Approval DB는 migration을 처음부터 실행해 migration/runtime 역할의 `NOINHERIT` 불변식과 strict ACL negative test를 검증한다. 이 경로는 범용 코어 개발 증거이므로 과거 운영 DB의 상태 때문에 G3를 차단하지 않는다.

반면 과거 V24 시점에 생성된 역할을 보유한 **기존 Approval 운영 DB**는 `INHERIT=true`가 남아 있을 수 있다고 전제한다. 영향을 받는 DB의 G6 운영 활성화 전 Integration Control이 승인된 일회성 복구를 수행해야 하며, application runtime이 시작하면서 역할이나 ACL을 자동 변경해서는 안 된다. 정본 Gate는 `ACT-G6-APPROVAL-LEGACY-ROLE-HARDENING`이고 다음 증거를 모두 요구한다.

- Approval DB principal inventory와 각 principal의 `rolinherit`, login, membership 상태
- 검토된 `rolinherit=false` 전환 또는 controlled role rebuild 결과
- membership·object/schema ownership·cluster ACL·database ACL의 전후 diff
- exact schema-history와 ownership digest
- 변경 전 backup restore point와 strict process restart 결과
- rollback rehearsal와 복구 receipt
- 실명 DBA·Security·SRE release 승인

하나라도 없거나 대상 DB 식별이 불완전하면 그 Approval 운영 DB만 fail-closed한다. 단순 migration 성공, 신규 DB 테스트, 문서상 승인 또는 G3 workflow review는 이 G6 증거를 대신하지 않는다.
