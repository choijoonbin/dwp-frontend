# ADR-001 HRIS 통합 Lineage, 조건부 v35 Successor와 Migration Lease

> 상태: Accepted for integration
>
> 결정일: 2026-10-06
>
> 적용 저장소: `dwp-frontend`, `dwp-backend`, `dwp_agent`
>
> 기준 Pin: [2026-10-06 Source 및 Lineage Provenance](../../06-delivery/hris/2026-10-06-source-and-lineage-provenance.md)

## 1. 결정 요약

1. `dwp-dev`의 현재 Frontend·Backend·Agent HEAD를 통합의 기준 Lineage로 사용한다.
2. Reconciled branch는 복구된 기능과 증거의 immutable 입력이다. 단순 Merge, `ours`/`theirs`
   일괄 선택, 동일 Version Artifact 덮어쓰기를 금지한다.
3. 현재 Backend의 Authorization v32·v33·v34는 byte-for-byte 보존한다. Reconciled v33의
   의미가 현재 v34의 부분집합이면 v34를 유지하고, 통합 Canonical Source에 실제 의미 Diff가
   있을 때만 현재 v34 위의 immutable **v35 successor**를 합성한다.
4. 공유되거나 현재 Lineage와 충돌하는 Flyway Version은 중앙 SYS/Common Lane이 통합 직전에
   JIT Migration Lease로 발급하며 Reconciled 번호를 그대로 복사하지 않는다. 소유 DB가 분리되고
   경로·bytes·SHA를 명시적으로 admission한 People/PAY/TIM migration만 원본 번호를 보존한다.
5. Backend가 Authorization·OpenAPI·HRIS Canonical Contract의 정본이다. Frontend Projection은
   확정된 Backend Contract에서 생성하며 수동 병합하지 않는다.
6. v35가 필요한 경우에만 `DRAFT`와 Default-OFF로 시작한다. 통합 Gate에서 v34→v35
   활성화와 v35→v34 Rollback을 함께 검증하기 전에는 Release Lineage로 승격하지 않는다.

이 결정은 현재 v34 Pin에 묶여 있다. 통합 Lock 뒤 비교에서 Reconciled-only route, capability,
access policy, predicate와 entitlement expression은 모두 0건이었다. 공통 항목의 차이는 현재
Assignment/Communications route 확장 4건뿐이므로 현 시점 기본 판정은 `KEEP_V34`다. 통합 중
Canonical Source가 달라질 때만 `REQUIRE_V35`로 전환한다. 그 전에 Canonical Lineage가 v35
이상으로 진행되면 이 ADR을 개정하고 successor 번호를 다시 계산하며 번호를 재사용하지 않는다.

## 2. 배경과 충돌 증거

현재와 Reconciled Lineage는 같은 Authorization Version 번호에 서로 다른 불변 Artifact를
보유한다.

| Lineage | Version | Checksum | Route 수 |
| --- | ---: | --- | ---: |
| 현재 `dwp-dev` | 32 | `b620ea86a8310cf23796e3e380b74c39764bdca28f41033496d21887a89da9cc` | 912 |
| Reconciled | 32 | `9e4e274bf457d1a5947c8b54e83299d28fb9fe128d9f1100991bc30634b54344` | 943 |
| 현재 `dwp-dev` | 33 | `9c9a18b44eb83de0e98f4ec16e44c1df0ce216e00bc7075462f4e35f7fb87639` | 945 |
| Reconciled | 33 | `254ead674e1126d50e8dcf1011486ea1127fb2479f7a82d832cdf0466995bc49` | 944 |
| 현재 `dwp-dev` | 34 | `852d20e1e639e1a7170f02b5714d21d8c51a9eb8ff5ac32d8b7940b82d6be83b` | 952 |

같은 Version 번호를 덮어쓰면 승인·활성화 Receipt와 Runtime Evidence의 Checksum Lineage가
깨진다. 또한 Git 파일명 충돌이 없더라도 다음 Flyway Version 충돌이 존재한다.

- Auth 현재 Lineage는 `V232`부터 `V241`까지 사용한다. Reconciled Lineage도
  `V232`, `V233`, `V234`, `V234_1`을 다른 의미로 사용한다.
- Platform 현재 Lineage는 `V320`, `V321`을 사용한다. Reconciled Lineage의 HRIS Rename도
  `V320`을 사용한다.
- People 현재 Lineage에는 `V53`이 존재하고 Reconciled Lineage는 `V49`부터 `V52`를 추가한다.
- PAY와 TIM은 Reconciled Lineage에서 각각 독립 Migration Stream을 시작한다.

따라서 Git이 자동 병합할 수 있다는 사실은 Runtime에서 안전하게 통합할 수 있다는 의미가
아니다.

## 3. 허용하는 통합 방식

통합 Branch는 현재 `dwp-dev` Pin에서 새로 만든다. Reconciled HEAD는 변경하지 않고 두 번째
입력으로 고정한다. Ancestry를 보존할 필요가 있으면 격리된 Integration Worktree에서
`--no-commit` Merge로 변경을 펼칠 수 있으나, 다음 조건을 모두 충족하기 전에는 Merge 결과를
Commit하지 않는다.

1. 충돌을 Authorization, Migration, OpenAPI, Gateway, People/Assignment, Frontend
   Route·Model·i18n·Snapshot Cluster로 분류한다.
2. 현재 Admin, Home, Visible HRIS Identity, Governed Assignment Proposal 기능을 보존한다.
3. 생성 Artifact는 한쪽 파일을 선택하지 않고 Semantic Source를 합친 후 한 번 재생성한다.
4. 현재 v32·v33·v34 파일과 Checksum이 변경되지 않았음을 검증한다.
5. Reconciled HRIS 의미 변경의 disposition이 구조화된 v34 Diff와 작업 패킷 Trace에 모두
   포함되었음을 검증한다. Diff가 비면 v35를 생성하지 않는다.

37개 Frontend Commit이나 46개 Backend Commit을 개별 Cherry-pick하는 방식은 상호 의존 변경과
증거 Lineage를 누락할 위험이 있으므로 기본 방식으로 사용하지 않는다. 예외가 필요하면 누락
검사와 Commit Mapping을 별도 증거로 남긴다.

## 4. 조건부 v35 합성 계약

G2는 먼저 통합 Canonical Semantic Source와 현재 v34를 구조적으로 비교한다. 비교 결과와
generator 출력이 모두 동일하면 v34를 유지하며 successor Bundle·Seed·Migration을 만들지 않는다.
Diff가 존재할 때만 v35 작업 패킷을 발급하고 다음을 하나의 변경 단위로 소유한다.

- 현재 v34와 Reconciled HRIS Route·Capability의 의미 Diff
- Canonical Product Authorization Bundle, Index와 Checksum
- Auth Seed와 JIT Lease Migration
- Gateway Enforcement와 Population·SoD·High-assurance 정책
- OpenAPI와 Backend Fixture·Contract Test
- Frontend Route/Capability Projection과 동기화 검사
- Default-OFF Rollout, Maker/Checker/Activator Receipt와 Audit
- v34→v35 Activation, stale CAS 거부, v35→v34 Rollback

정본은 Backend의 `contracts/product-authorization`, `contracts/openapi`,
`contracts/hris/canonical`에 둔다. Frontend는 생성된 Projection만 소비한다. Module Agent는
공통 Contract를 직접 수정하지 않고 SYS/Common Owner에게 Contract Change Request를 낸다.

## 5. Migration Lease 계약

G1에서 Integration Branch HEAD를 Lock한 뒤 중앙 Migration Owner가 Auth `V242`의 실제 Lease를
발급했다. 표의 나머지 Fence는 admission 경계이며 실행 번호 발급을 뜻하지 않는다. 특히 v35
Seed용 `V243`은 G2 의미 Diff가 확인되기 전까지 미발급이다.

| Stream | 보존 범위 | JIT 시작 Fence | 현재 Lease 상태 | 결정 |
| --- | --- | --- | --- | --- |
| Auth | 현재 `V232`~`V241` | `V242` | `ISSUED_NOT_USED` | Payroll exact verb 4개 효과만 V242에 이식. v35 Seed용 V243은 의미 Diff가 있을 때만 별도 발급 |
| Platform | 현재 `V320`~`V321` | 없음 | `NOT_REQUIRED` | Reconciled V320과 현재 V321이 byte-identical이므로 중복 반입 금지 |
| People | Reconciled `V49`~`V52`, 현재 `V53` | 신규 없음 | `ADMITTED_PENDING_ENVIRONMENT_HISTORY_CHECK` | V49~V52 immutable admission. V53 선행 적용 환경이면 중단하고 forward-only 보정 설계 |
| Payroll | 독립 `dwp_payroll` DB | `V1`~`V5` | `ADMITTED_IMMUTABLE` | 독립 DB·Schema·History 소유권 확인. 원본 번호와 bytes 유지 |
| Time | 독립 `dwp_time` DB | `V1`~`V7` | `ADMITTED_IMMUTABLE` | 독립 DB·Schema·History 소유권 확인. 원본 번호와 bytes 유지 |

발급된 Lease에는 다음을 필수로 기록한다.

- Lease ID, Stream, 정확한 시작·종료 Version
- 발급 시각, 발급자와 단일 Writer
- 기준 Branch와 Commit Pin
- 소유 Module/작업 패킷, 허용 Migration 경로
- 예상 Schema Effect와 Rollback/Forward-fix 정책
- 만료 조건과 미사용 번호 처리
- 중복 Version, 순서, Clean Install, 기존 DB Upgrade 검증 결과

Lease가 없는 Agent는 Migration 파일을 생성하거나 Rename하지 않는다.

## 6. Rollback과 실패 처리

- v35가 불필요한데 생성되었거나 필요한 v35 생성·동기화가 실패하면 현재 v34 Artifact를 수정하지
  않고 Integration Branch의 해당 시도만 폐기한다.
- Migration은 배포 후 파일 Rollback보다 Forward-fix를 기본으로 하며, 제품 활성 Bundle은
  v35→v34 CAS Rollback을 별도로 검증한다.
- Contract, Migration, Runtime Evidence 중 하나라도 Pin이 다르면 기존 PASS를 재사용하지 않는다.
- 고객 데이터, Production 활성화, 고객 정책 승인은 Synthetic W1의 범위 밖이다.

## 7. 기각한 대안

| 대안 | 기각 이유 |
| --- | --- |
| Reconciled Branch를 새 기준으로 채택 | 현재 `dwp-dev`의 후속 Admin·Home·Assignment 변경과 원격 기준선을 잃는다. |
| 동일 v32/v33 파일을 `ours` 또는 `theirs`로 선택 | 이미 발급된 Checksum·Receipt의 불변성을 깨뜨린다. |
| Reconciled Flyway 파일을 번호 그대로 복사 | Git이 감지하지 못하는 중복 Version과 잘못된 Upgrade 순서를 만든다. 단, 소유 DB가 분리되고 번호·bytes를 immutable admission한 PAY/TIM과 People V49~V52는 예외다. |
| 통합 표식용 v35를 항상 생성 | 현재 v34가 Reconciled v33 의미의 완전한 superset이므로 불필요한 Bundle·Seed·Migration lineage를 만든다. |
| Agent별 공통 Contract 직접 편집 | 동시 Writer가 되어 Version·OpenAPI·Migration Lease 충돌을 재발시킨다. |
| 수정할 때마다 전체 W1 재실행 | Head가 안정화되기 전 비싼 검증을 반복하면서도 새 Lineage에 대한 최종 증거를 만들지 못한다. |

최종 실행 순서와 Gate는 [2026-10-06 HRIS 통합 로드맵](../../06-delivery/hris/2026-10-06-integration-roadmap.md)을 따른다.
