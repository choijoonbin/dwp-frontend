# 기존 DWP 권한 재사용: Current HRIS owner bridge ABI.v2 후보

상태: **AUTHOR_MOCK_SCAFFOLD_ONLY / G3_CLOSED / NATIVE_PEP_COMMON_P0_OPEN**. 기존 권한·신원 원장을 재사용하는 neutral API 후보다. 새 RBAC·신원 연결 원장·revision counter·DDL·실제 endpoint/PEP를 만들지 않았다. 중립 unit60 통과는 native Auth/Gateway/People 연계 승인이 아니다.

## 실제 기존 소스 의미

- `ProductAuthorizationIdentityEvidenceService.load`는 기존 권한그룹 permissions/roles, 앱 responsibility/resource-set, DB-owned scoped duties를 읽고 `auth-{SHA256}`를 만든다. 이 문자열은 native user.version이나 access_revision이 아니다.
- `ProductAuthorizationAuthorityAdapter.evaluate`는 활성 bundle version·pointer revision·checksum으로 `policy-*` 문자열을 만들고, route/plane/mode·APP entitlement·capability·responsibility·SoD·scope를 평가한다. `psc-*`는 tenant/actor/product/surface/mode와 auth/policy/scope의 context SHA다.
- `ProductSurfaceContextAggregationSupport.compositeRevision`의 `psr-*`는 Auth/policy/People relationship/population/support/rollout을 합성한 Gateway 결정 revision이다. 이를 단일 auth-*나 hash→long으로 대체하지 않는다.
- `HcmProductSurfacePepFilter`는 trusted current psr/revalidateAt·route·context·selected scope를 요구하고, action expected psr를 비교하며 People owner scope를 재검증한다. v2 후보는 이 기존 체계와 owner 책임을 재사용한다.
- Auth는 기존 `public.com_users`의 tenant/user/public_id/person_public_id/identity_plane/status/version/access_revision만 자신의 native identity 권위로 사용한다. People의 업무대상은 person/worker/workRelationship/assignment의 UUID·parent·4versions를 별도로 보유한다.

각 기존 파일 SHA와 정확한 decimal-string ns는 JSON `existingSources`에 있다. legacy v1의 `permissionDecisionRevision long`에 위 문자열을 집어넣거나 임의 숫자로 변환하지 않았다.

## 신규 파일과 경계

신규 package는 `dwp-platform-contracts/.../hris/identity/v2`다. 기존 generated/G2/v1/core/Control/SQL·shared registry·메뉴/route를 수정하지 않았다.

| 파일 | 책임 |
| --- | --- |
| CurrentHrisAuthorizationV2 | public **untrusted** carrier, 원래 native string revision 타입, server requirements, PERSON/EMPLOYMENT target |
| CurrentHrisAuthorizationPortsV2 | explicit trusted composition SPI, guard만 발급하는 private DwpLookup/PeopleLookup |
| CurrentHrisAuthorizationExceptionV2 | typed fail-closed 오류, native ID·SQL·provider cause 미노출 |
| GuardedCurrentHrisAuthorizationPortV2 | missing-provider calls0, current owner 검증·native refetch·단계별 Clock 검사 |
| VerifiedCurrentHrisAuthorizationV2 | private constructor·guard-only mint, bounded local 검증 결과; signed native proof 아님 |
| CurrentHrisAuthorizationV2Test | 실제60 중립 typed 회귀; 모든 current/native provider는 명시적 mock |

`authorize(TargetSelector)`는 business selector만 받는다. public API에 actor·권한 carrier·duty/field/purpose boolean을 넘기는 경로가 없다. `Requirements`는 trusted server operation registry가 exact operation/product/surface/route/purpose/audience/plane/mode/selection/targetKind/permission/atomic-duty/field/mutation 요구를 구성한다. request JSON을 이 생성자에 바인딩해서는 안 된다.

raw owner carrier의 grant/check 필드는 서버 검증 제공자가 기존 엔진으로 **그 exact route와 selected scope**를 평가한 결과여야 한다. raw 전체 permission/group의 합집합, 클라이언트 플래그, 전역 관리자 역할, 기본 true는 권위가 아니다. 현재 provider가 없으면 신규 guard는 모든 provider 호출 전에 거부한다. Spring bean/ServiceLoader/default provider를 등록하지 않았다.

## 신원과 업무대상 분리

- SELF: Auth native principal→person 관계에 명시적으로 연결된 person만 대상이다. person 누락 시 principal UUID와 우연히 동일한 selector를 줘도 거부한다. email/name/correlation/equality fallback 없음.
- NONSELF: 로그인한 **actor**와 People-owned **subject**를 분리한다. 권한·업무책임·current population/field/purpose/SoD가 필요하지만 입사예정자 대상에게 Auth 계정을 강요하지 않는다. native actor person이 없는 NONSELF도 별도 정책상 허용할 수 있다.
- PERSON: tenant/person UUID·native person version·owner state만. worker/relationship/assignment/location/zone/TIM 설치를 강요하지 않고 employment 필드는 모두 없어야 한다. target state는 owner 정책 결과로 판단하며 neutral guard에서 ACTIVE로 고정하지 않는다.
- EMPLOYMENT: person/worker/relationship/assignment의 네 version과 실제 parent UUID를 각각 검사한다. 선택된 worker/person·relationship/worker·assignment/relationship 관계를 보존한다. native version0도 정상이다. 기본 worker·primary LIMIT1·첫 번째 context 선택은 하지 않는다.

## 검사와 refetch 순서

1. 구성 adapter·Clock·server requirements 누락이면 provider0/0/0 거부.
2. 초기 Clock → current verified-server invocation → Clock 재캡처·monotonic/expiry 검사.
3. private DwpLookup: Auth native actor identity/row/access + 기존 current authorization 재평가 + verified Gateway psr; exact requirements, native actor, 문자열 namespace, APP/permission/duty/static SoD와 expiry 검사.
4. private PeopleLookup: actual subject UUID/parent/4versions + current selected population/allowed fields/purpose/dynamic SoD; Clock 재캡처.
5. DWP current source를 다시 읽어 actor row/access와 auth/policy/psc/psr/scope/grants를 exact 비교. capture 시각만 갱신 가능하며 policy/권한 revision 변경은 거부.
6. People subject·parent·4versions/state·모든 owner policy revision/allowed fields를 다시 읽어 exact 비교.
7. 매 단계 시계를 재취득하고 마지막 발급 전에 **최초** proof까지 만료 재검사. 최대30초와 모든 expiry의 최솟값만 사용해 bounded local 결과를 민트한다.

native 문자열 형식 검사는 **shape**만 검증한다. SHA가 실제 데이터에서 계산됐는지, source provenance·signed transport·current revocation lease는 native owner 제공자가 검증해야 한다. 순차 두 DB refetch는 최종 read 이후 revoke race나 cross-DB atomic transaction을 증명하지 않는다.

## 실제 작성자 테스트

UTC 2026-09-14 07:33:31.712490–07:33:37.799811, 6.086671초, Gradle exit0. 60 고유 case / failure0 / error0 / skip0. 93개 관련 source SHA·정확 ns 전후 동일, host semaphore 해제, PG0.

- 양성6: SELF PERSON/EMPLOYMENT, NONSELF person without target Auth, NONSELF actor without person, zero native versions, callback마다 진행되는 Clock.
- 음성53: missing provider calls0, actor relabel/native person/row/access/revoke/plane, 잘못된 auth/policy/psc/psr string, APP/permission/duty/SoD/population/purpose/field 누락, foreign target/parent/scope, source kind, current revision/pointer/target4versions/owner policy 변경, 단계 만료·최초 proof 중간 만료·stale capture·역행/null/예외 Clock, provider secret/cause redaction. expected code와 실제 provider-call-count를 assert한다.
- private API1: raw authority를 authorize 인자로 받지 않고 lookup/result constructor가 private임을 reflection으로 확인.

```text
./gradlew :dwp-platform-contracts:test --rerun --tests com.dwp.platform.contracts.hris.identity.v2.CurrentHrisAuthorizationV2Test --no-daemon --max-workers=1
```

XML 원문·case IDs·source manifest·argv/시각/exit는 별도 author-verification 보고서에 고정한다. 기존 72/79/165/Control31 native 증거를 이 v2 구현의 native 통과로 재사용하지 않는다.

## 실제 준비·등록 순서 및 남은 P0

1. Auth/Gateway/People가 exact versioned transport·source ownership·current freshness/session binding schema를 독립 승인한다.
2. Auth v2 private lookup native read·기존 authorization adapter bridge를 실제 구현한다. v1 숫자 revision fake 값으로 native Reader lookup을 우회하지 않는다.
3. Gateway의 verified invocation·psr transport를 연결하고 client header/body forgery·tenant/plane/revoke/expiry를 실제 검증한다.
4. People의 PERSON/EMPLOYMENT owner-native selectors와 population·field·purpose·dynamic SoD를 구현한다. Auth DB를 People에서 읽거나 반대로 읽지 않는다.
5. per-operation server PEP/query masking/transaction lock+CAS/current expected psr·native versions·outbox를 실제 구현·검증한다.
6. consumer compile/native PG/verified transport/lifecycle/revoke/maker-approver race·scope selection 검증 후 shared source/operation 등록과 Gate 검토를 수행한다.

**현재 중요한 미완료:** `ScopedAdminDutyPolicy.requiresScopedDuty`는 approvals/approvals.admin만, static SoD도 approvals 3 switch만 처리한다. DB-owned duty view·기존 그룹·app resource package는 재사용하되 HRIS atomic duty/동적 SoD를 true/default로 승계하지 않는다. 이를 전 권한 오픈이나 G4 이후로 미뤄 닫았다고 주장하지 않는다.

실제 native providers·signed HTTP parser/transport·freshness/relink/revoke ordering·per-operation PEP·query masking·transaction fence·shared verification root/registry 등록은 아직 OPEN이다. 본 결과는 **author-only 후보**이며 독립 검토·소비자/native 구현·전체 current check·G3 승인 전이다.
