# Meetings 관리 Surface 후속 Bundle 승격 설계

## 상태와 목적

- 상태: `DESIGN READY / ACTIVATION NO-GO`
- 범위: `meetings.management`를 호환 `DRAFT` 화면에서 서버가 직접 판정하는 Exact
  Product Surface로 승격하기 위한 append-only 설계
- 불변식: 생성 시점까지 존재하는 모든 이전 권한 Bundle의 바이트·checksum·의미를 변경하지 않는다.
- 현재 안전 상태: rollout `000/100`에서는 기존 `ADMIN.MEETINGS` 호환 권한을 사용하고,
  `110/111`에서는 승인된 exact 관리 권한이 없으면 fail-closed한다.

이 설계는 개발 착수 기준을 고정하지만 Product·Security·IAM 승인, immutable CI 증적,
staging 관찰과 수동 인수를 대신하지 않는다.

## 사용자와 운영 질문

- 주 사용자: 회사 관리자가 지정한 Meeting 앱 관리자
- 운영 질문: 회의 서비스의 운영 상태와 정책 변경 영향을 확인하고 안전하게 조치할 수 있는가?
- 기본 동작: 업무 화면에서는 단일 `앱 관리` 진입점만 제공하고, 관리 화면에서는 관리 메뉴만
  노출하며 `업무로 돌아가기`로 명시적으로 문맥을 전환한다.
- 화면 archetype: 운영 command center, 정책 focus form, AI·데이터 readiness investigation

## Canonical 계약 후보

공통 속성은 다음과 같이 고정한다.

| 항목                | 값                             |
| ------------------- | ------------------------------ |
| product             | `meetings`                     |
| surface             | `meetings.management`          |
| owner service       | `dwp-meeting-server`           |
| product entitlement | 요구하지 않음                  |
| authority mode      | `PERMISSION`                   |
| responsibility      | `APP_CONFIG_ADMIN` 필수        |
| scope               | `APP_RESOURCE_SET:RS_MEETINGS` |
| access modes        | `NORMAL`, `ELEVATED`           |
| provider support    | 명시적 fail-closed             |

### Capability

| key                        | 권한                    | 위험도 |
| -------------------------- | ----------------------- | ------ |
| `meetings.operations.read` | `ADMIN.MEETINGS:VIEW`   | LOW    |
| `meetings.policy.read`     | `ADMIN.MEETINGS:VIEW`   | LOW    |
| `meetings.policy.update`   | `ADMIN.MEETINGS:MANAGE` | MEDIUM |

정책 저장은 단순 `UPDATE`가 아니라 제품 정책 전체에 영향을 주므로 `MANAGE`를 사용한다.
`APP_CONFIG_ADMIN` 책임과 위 capability는 AND 조건이며 어느 한쪽만으로 진입하거나 실행할 수 없다.

### Route

| contract key                                     | kind   | UI                             | Gateway → owner                                                                          | access                     |
| ------------------------------------------------ | ------ | ------------------------------ | ---------------------------------------------------------------------------------------- | -------------------------- |
| `route.meetings.management.operations.page`      | PAGE   | `/meetings/admin/operations`   | GET `/api/meetings/v1/admin/overview` → `/v1/admin/overview`                             | `meetings.operations.read` |
| `route.meetings.management.policies.page`        | PAGE   | `/meetings/admin/policies`     | GET `/api/meetings/v1/admin/policy` → `/v1/admin/policy`                                 | `meetings.policy.read`     |
| `route.meetings.management.intelligence.page`    | PAGE   | `/meetings/admin/intelligence` | GET `/api/meetings/v1/admin/intelligence/readiness` → `/v1/admin/intelligence/readiness` | `meetings.policy.read`     |
| `route.meetings.management.policy-update.action` | ACTION | 없음                           | PUT `/api/meetings/v1/admin/policy` → `/v1/admin/policy`                                 | `meetings.policy.update`   |

세 PAGE는 read-only, 정책 갱신 ACTION만 write로 분리한다. Intelligence는 최소 권한 원칙상
`meetings.policy.read`를 재사용하며, 별도 capability가 필요하면 bundle 생성 전에 Product·Security가
결정해야 한다.

## 구현 tranche

### 1. Frontend 권한 소비

- 모든 관리 GET을 선택 scope, query cache identity, abort signal과 결속한다.
- PUT 직전 `meetings.policy.update`를 재평가하고 context scope와 expected decision revision을
  Gateway로 전달한다.
- identity·scope·revision 변경 시 편집 상태와 mutation을 취소하고 늦은 응답, toast, cache 쓰기를
  폐기한다.
- 관리 전용 사용자는 `APP.MEETINGS` 없이 접근할 수 있고, 일반 Meeting 사용자는 관리 Surface에
  접근할 수 없어야 한다.

### 2. Gateway와 owner PEP

- 네 method/path만 `meeting` owner로 exact projection한다.
- missing·unknown·ambiguous route key, duplicate·noncanonical scope, trusted-header spoof를 거부한다.
- 정책 PUT의 missing/stale decision revision은 fail-closed한다.
- Meeting owner는 work의 SELF scope와 management의 RESOURCE_SET scope를 binding별로 재계산한다.
- CROSS_TENANT, SCOPE_ESCAPE, STALE_AUTHORITY_REVISION, NORMAL↔SUPPORT CONFUSED_DEPUTY,
  INTERNAL_HEADER_SPOOF 5-cell과 정상 PAGE 3개/ACTION 1개의 실제 controller 도달을 고정한다.

### 3. 정책 명령 원자성

- tenant, actor, command, idempotency key, request fingerprint를 하나의 reservation으로 저장한다.
- 같은 key·같은 payload는 이전 결과를 replay하고, 같은 key·다른 payload는 conflict로 거부한다.
- 실제 정책 변경, version CAS, audit 기록을 하나의 트랜잭션 경계에 둔다.
- audit 중복 예외를 삼키는 방식은 idempotency로 인정하지 않는다.

### 4. Auth migration

- 기존 `APP_MEETINGS` resource set을 `RS_MEETINGS`로 in-place rename하고 ID, member, assignment를
  보존한다.
- 같은 tenant에 두 이름이 서로 다른 ID로 공존하면 migration을 실패시킨다.
- `ADMIN.MEETINGS` 권한과 `APP_CONFIG_ADMIN@RS_MEETINGS` 책임이 함께 유효할 때만 허용한다.
- 기존 사용자를 migration으로 임의 승격하지 않는다. SKAX backfill은 IAM 승인 후 별도 운영
  절차로 수행한다.

### 5. Append-only 생성

- canonical YAML에서 다음 미사용 버전을 생성하고 모든 이전 버전의 immutable 검사를 유지한다.
- Activity 계약이 append-only v5로 먼저 확정되면 이 관리 tranche는 v6 이상에서 생성한다.
- latest alias, Auth seed, 서비스 projection, rollout inventory, fixture, schema/type와 CI pin을 함께
  갱신한다.
- 이 tranche만 새 버전에 포함될 경우 예상 증분은 capability 3개, route 4개다. 다른 tranche와 병합하면
  전체 count와 checksum을 생성 시점에 다시 계산한다.
- 생성만으로 PAGE를 official 처리하거나 readiness를 COMPLETE로 올리지 않는다.

## 수용 Gate

1. 모든 이전 버전의 byte/checksum 불변과 신규 버전 strict-superset 검증
2. fresh·upgrade Auth DB의 resource-set migration 및 permission/responsibility 음성 회귀
3. Gateway method/path/header/scope/revision/rollout `000/100/110/111` 회귀
4. owner-service 5-cell, PAGE 3개와 ACTION 1개의 실행 증적, 거부 시 service invocation 0
5. 정책 갱신 idempotency replay/conflict, CAS, audit 원자성
6. 관리 전용·업무 전용·결합 권한 사용자 Chromium/mobile E2E
7. drawer focus 복원, route 전환 main/H1 focus, aria-live, 320px·200% zoom과 한영 긴 문구
8. 전체 unit, typecheck, lint, architecture, build, product builds, bundle budget
9. Product·Security·IAM owner approval, immutable revision/CI, staging `110→111`, rollback rehearsal,
   수동 접근성·인수, chaos/pentest 증적

## 활성화 결정

다음 네 결정이 문서화되기 전에는 구현할 수 있어도 activation은 `NO-GO`다.

1. Intelligence가 `meetings.policy.read`를 재사용한다.
2. 일반 정책 갱신은 MEDIUM이며 `ADMIN.MEETINGS:MANAGE`를 요구한다.
3. 기존 LOCAL/운영 Meeting 관리자에게 책임을 자동 backfill하지 않는다.
4. Meeting→Work follow-up 내부 계약은 별도 후속 bundle로 분리한다.

외부 증거가 실제 도착할 때까지 production readiness 항목은 `BLOCKED_EXTERNAL`을 유지한다.
