# R0 Organization Directory 및 Provisioning Boundary ADR

> 상태: Accepted Baseline v1.0
>
> 기준일: 2026-08-08
>
> 적용 저장소: `dwp-frontend`, `dwp-backend`
>
> 연계 Feature: `DWP-R0-ADM-003`, `DWP-R0-ADM-004`

## 1. 결정

DWP Identity Plane은 사용자마다 하나의 기본 조직을 두고, 그룹은 조직 계층과 분리된
다대다 직접 사용자 집합으로 관리한다.

- Organization Unit: Tenant 내부 계층, 사용자의 `primary organization` 0..1
- Directory Group: 부서와 무관한 직무·프로젝트·운영 집합, 직접 사용자 Membership 0..N
- Role: 권한 묶음이며 조직·그룹 자체와 동일한 개념으로 취급하지 않는다.
- Source ownership: `LOCAL`은 Tenant Admin이 관리하고 `SCIM`은 Provisioning 경로만
  변경할 수 있다.
- Directory 변경은 Identity Context 변경으로 간주해 사용자 `access_revision`을 올리고
  영향받은 활성 Session을 폐기한다.

## 2. 이유

조직도, 협업 그룹과 권한을 한 테이블이나 한 계층으로 합치면 HR 이동, 프로젝트 그룹,
외부 IdP 동기화와 권한 검토의 Lifecycle이 서로 얽힌다. R0에서는 의미를 분리해 다음
불변식을 우선 확보한다.

1. Parent와 Member는 항상 같은 Tenant에 속한다.
2. 조직 계층에는 자기 참조와 순환이 없다.
3. 활성 하위 조직 또는 멤버가 있는 조직과 멤버가 있는 그룹은 비활성화할 수 없다.
4. Key는 생성 뒤 바꾸지 않고 표시명·설명·상태·Membership은 Version으로 보호한다.
5. 외부 Source가 소유한 레코드를 로컬 API가 덮어쓰지 않는다.
6. 모든 성공 변경은 Actor, Tenant, Correlation과 전후 Snapshot Audit를 남긴다.

## 3. 동시성

- 조직 계층 변경은 Tenant의 조직 행을 ID 순서로 `PESSIMISTIC_WRITE` 잠금해 서로 다른
  두 행을 동시에 바꾸며 순환이 생기는 경쟁을 직렬화한다.
- 조직·그룹과 사용자는 JPA `version`으로 낡은 화면의 변경을 `409`로 거부한다.
- Membership 교체는 관련 사용자를 ID 순서로 잠그고 Diff, Identity Revision, Session
  폐기, Directory Revision과 Audit를 하나의 Transaction에서 처리한다.
- 다른 기본 조직에 속한 사용자를 새 조직에 배정하면 명시적 이동으로 처리하고 이전
  조직 Revision과 이동 Audit도 함께 갱신한다.

## 4. SCIM 경계

현재 Schema의 `source_type`, `external_id`와 Tenant별 Unique Constraint는 향후 SCIM
Inbound Adapter가 동일 Domain Service를 사용하기 위한 경계다. 하지만 이번 Baseline은
SCIM Endpoint를 노출하지 않는다.

다음 Revision에서 별도로 설계·검증한다.

- SCIM User·Group Schema, `externalId`, `meta.version`과 ETag
- Idempotent Create·Replace·Patch·Delete, Filter와 Error Mapping
- IdP Group과 DWP Group·Role Mapping, Joiner·Mover·Leaver 처리
- 중첩 Group 허용 여부와 Cycle·권한 폭발 방지
- 대규모 Directory Cursor Pagination
- 비동기 Provisioning Event와 재처리·Dead Letter·운영 지표

SCIM Core Schema는 Group Member가 User 또는 Group일 수 있도록 정의하지만 권한 의미는
서비스에 맡긴다. 따라서 중첩 Group을 미리 켜지 않고 실제 IdP와 권한 정책이 확정된 뒤
도입한다.

## 5. 제외 결정

- Organization 또는 Group 삭제 API를 제공하지 않는다. Lifecycle과 Audit를 유지한다.
- Group Membership만으로 Role을 자동 상속하지 않는다.
- Agent가 조직·그룹을 자율 생성·변경하지 않는다.
- SCIM 레코드를 Tenant Admin 화면에서 강제 수정하는 예외 경로를 만들지 않는다.
- 사용자 500명을 넘는 일괄 Membership 교체는 비동기 Job 계약 전까지 허용하지 않는다.

## 6. 후속 Gate

1. 실제 IdP의 User·Group Sample과 Attribute Mapping 승인
2. Group Role Mapping과 Effective Permission 계산·설명 가능성 검증
3. SCIM Contract·Conformance·Replay·Cross-tenant Test
4. Cursor 기반 검색과 대규모 Entity Picker 부하 Test
5. Joiner·Mover·Leaver SLO, 실패 재처리와 관리자 운영 화면

## 7. 표준 근거

- [SCIM Core Schema RFC 7643](https://www.rfc-editor.org/rfc/rfc7643)
- [SCIM Protocol RFC 7644](https://www.rfc-editor.org/rfc/rfc7644)
- [SCIM Cursor Pagination RFC 9865](https://www.rfc-editor.org/rfc/rfc9865)
- [SCIM Security Events RFC 9967](https://www.rfc-editor.org/rfc/rfc9967)
