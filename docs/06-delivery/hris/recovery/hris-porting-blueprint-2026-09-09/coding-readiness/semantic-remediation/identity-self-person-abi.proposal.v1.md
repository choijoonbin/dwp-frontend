# SelfPerson 공통 신원 조회 ABI 제안

상태: AUTHOR_PROPOSED_UNWIRED_SCAFFOLD / G3_CLOSED / COMMON_P0_OPEN. 기존 고용 SelfContext ABI14개 및 reader79 source/SQL은 수정하지 않습니다.

목적은 고용·assignment·location이 없는 사용자도 DWP의 기존 Auth principal→person / People person SoR를 재사용해 자기 신원 metadata를 읽는 것입니다. 별도 원장이나 TIM/PER 설치 의존성을 만들지 않습니다. 현재만 조회하며 person의 과거 asOf history를 구현한 것으로 표시하지 않습니다.

SelfPersonPortV1.resolve()는 caller tenant/actor/principal/person/selector/asOf를 받지 않습니다. trusted Clock now를 기존 AuthorityVerifier의 SELF_PROFILE_READ/HRIS_HRM query에 결속합니다. 기존 AuthBindingProvider를 그대로 사용해 native com_users.version/access_revision과 principal→person 관계를 확인한 뒤, guard가 민트한 private PersonLookup으로 People native snapshot을 읽습니다.

People SELECT는 public.ppl_persons의 tenant_id/public_id/version/lifecycle_state 네 컬럼뿐입니다. worker·relationship·assignment·location·TIM·Auth DB를 조회하지 않습니다. native snapshot은 raw carrier이며 capturedAt/expiry는 owner Clock과 Auth/current-authority lease로 제한합니다. Guard는 person UUID/tenant/version/state/current lease를 검증하고 목적 policy의 allowedPersonStates만 적용합니다. worker/assignment status policy는 비고용 profile 조회 조건이 아닙니다. Auth account는 ACTIVE 및 current APP entitlement/SoD가 필요합니다.

결과는 외부에서 mint할 수 없는 SelfPersonResolutionV1이며 verifiedAt 직전 Clock을 다시 읽고 두 owner/current proof의 만료·monotonic clock을 재검사합니다. 현재 raw DTO와 version 값은 signature 또는 production current PEP proof가 아닙니다. signed transport·native permission producer·relink/revoke ordering·runtime admission·실제 endpoint/등록은 OPEN입니다.

신규 neutral5개 source와 People native reader1개, neutral typed/JDBC/isolated native PG 테스트3개만 구현합니다. 현재 ABI는 in-process v1이고 HTTP.v2 공개 계약 승인으로 전환하지 않습니다. 이 단계는 metadata만 제공하고 이름·연락처·민감정보는 노출하지 않습니다. 실제 profile 개인정보 projection은 별도 목적/field policy와 owner 계약이 필요합니다.

[정확한 필드·오류·소유 경로·실행 반례 계획](/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/semantic-remediation/identity-self-person-abi.proposal.v1.json)을 사용합니다. 실제 unit/native 실행과 root 독립 검토 전에는 준비완료를 주장하지 않습니다. employment 날짜·시간대 정책은 별도 과제로 남습니다.

