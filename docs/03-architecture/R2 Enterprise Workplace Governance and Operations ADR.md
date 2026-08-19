# R2 Enterprise Workplace Governance and Operations ADR

> 상태: Accepted for implementation
>
> 기준일: 2026-08-19
>
> 적용 저장소: `dwp-frontend`, `dwp-backend`

## 1. 결정

Workplace v1의 예약 안전성과 Calendar 경계는 유지하면서, 전사 확산에 필요한 공간 계층,
위임 관리, 정책 상속, 배치도 발행, 예약 개입, 감사와 연계 계약을 호환 확장한다.

운영 계층은 다음을 기준으로 한다.

```text
Tenant
  -> Campus
    -> Building (v1 Site 호환 투영)
      -> Floor
        -> Zone / Section
          -> Resource
```

- 기존 `wp_sites`와 `/v1/.../sites`는 Building 호환 API로 유지한다.
- Campus와 Zone은 별도 식별자를 갖고 이름 문자열을 권한이나 정책 키로 사용하지 않는다.
- 회의실 일정·반복·참석자·승인은 계속 Calendar가 단일 원천이다.
- 비회의 공간은 범용 RRULE 대신 원자적인 다중 날짜 예약 Series를 제공한다.
- 3D/BIM은 예약 기준 모델로 사용하지 않는다. 검증된 2D 배치도와 정규화 좌표를 유지한다.

## 2. 외부 모범 사례에서 채택한 기준

| 출처             | 채택 기준                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------- |
| Microsoft Places | Building-Floor-Section-Resource 계층, 예약/현장/지정/사용불가 모드, Building/Desk 관리자 분리 |
| Google Workspace | 건물·자원 대량 등록, 회의실을 Calendar 자원으로 유지하는 경계                                 |
| Robin            | 범위별 정책, 변경 가능한 예약, Neighborhood 초안과 게시 절차                                  |
| Envoy            | 위임 예약, 예약 로그, 기간 지정 좌석과 관리자 개입                                            |

공식 근거:

- <https://learn.microsoft.com/en-us/microsoft-365/places/get-started/quick-setup-buildings-floors>
- <https://learn.microsoft.com/en-us/microsoft-365/places/admin-portal>
- <https://learn.microsoft.com/en-us/microsoft-365/places/configure-admin-roles>
- <https://knowledge.workspace.google.com/admin/calendar/create-buildings-features-and-calendar-resources>
- <https://support.robinpowered.com/hc/en-us/articles/360016230311-Set-desk-booking-policies>
- <https://envoy.help/en/articles/5958577-reservation-log-and-delegated-booking>

## 3. 권한과 ABAC

Gateway가 검증한 `X-DWP-Group-Refs`, `X-DWP-Resource-Roles`, 사용자와 테넌트 문맥만
인가 입력으로 사용한다. 브라우저가 보낸 동일 이름 헤더는 Gateway에서 제거된다.

1. `APP.WORKPLACE`와 `ADMIN.WORKPLACE`는 앱 수준 RBAC를 담당한다.
2. Site/Zone 접근 규칙은 사용자와 검증된 Group Ref에 대한 ABAC를 담당한다.
3. 위임 관리 범위는 Building 또는 검증된 Managed Group에 부여한다. Building 범위는 해당 건물의
   Floor, Zone, Section, Resource에만 하향 상속한다.
4. Tenant Admin만 위임 범위와 정책 Override를 변경할 수 있다.
5. UI는 `VIEW`, `CREATE`, `UPDATE`, `MANAGE` Capability에 맞춰 명령을 노출하지만 서버 판정이 최종이다.

서버는 `/v1/admin/workplace/**` 요청을 Route Capability와 대상 객체의 실제 Site 범위로 다시
판정한다. 전역 관리자 역할만 이 범위 검사를 우회하며, 위임 관리자는 자신에게 부여된
Building 하위 범위 또는 Managed Group 범위에서만 명령을 실행할 수 있다. 대상 Site를 안전하게 역추적할 수
없는 요청과 Tenant 전체 예약 검색·감사·정책·Campus·위임 변경은 위임 관리자에게 fail-closed로
거부한다. 이 검사는 브라우저 메뉴 노출이나 Gateway 헤더에 의존하지 않는다.

명시적 허용 규칙이 없는 건물은 Tenant 기본 공개 정책을 따른다. 하나 이상의 제한 규칙이
존재하면 일치하는 사용자 또는 그룹만 탐색·예약할 수 있는 fail-closed 방식으로 전환한다.

## 4. 정책 상속

정책 우선순위는 `Resource > Zone > Floor > Building > Campus > Tenant`다. Override는 전체
정책 복제가 아니라 변경 필드만 저장한다. API는 최종 적용값과 각 필드의 출처를 함께 반환해
관리자가 상속 결과를 저장 전에 확인할 수 있어야 한다.

정책 변경은 낙관적 Version, 영향 범위, 미래 예약 충돌 건수, 사유와 감사 사건을 갖는다.
이미 확정된 예약을 새 정책으로 자동 취소하지 않는다. 즉시 보안 차단이 필요한 경우에만 별도
관리자 개입 명령을 사용한다.

## 5. 배치도 수명주기

Floor의 사용자 노출 배치도는 오직 `PUBLISHED` Revision이다.

```text
DRAFT -> REVIEW -> PUBLISHED -> ARCHIVED
  ^                    |
  +---- clone/restore -+
```

- 편집은 Draft의 배경 Asset과 Placement Snapshot에만 기록한다.
- Draft 편집기는 저장된 Snapshot과 현재 자원 Version을 함께 불러와 재개하며, 저장할 때 전체
  Placement Snapshot을 교체한다. 화면을 닫거나 대상 Floor를 바꾸기 전 미저장 변경을 확인한다.
- Review 요청은 미래 예약 영향, 누락 자원, 캔버스 밖 좌표와 중복 코드를 검증한다.
- Publish는 하나의 트랜잭션에서 이전 버전을 Archive하고 사용자 Projection을 교체한다.
- Rollback은 과거 행을 직접 재활성화하지 않고 과거 Snapshot을 새 Draft로 복제한 뒤 게시한다.
- 원본 Asset 삭제는 API 트랜잭션 이후 동기 삭제하지 않고 내구성 있는 Cleanup Outbox로 처리한다.

## 6. 예약 수명주기

- 모든 생성·변경 명령은 `Idempotency-Key`와 요청 Fingerprint를 사용한다.
- 같은 키와 같은 요청은 최초 결과를 재생하고, 같은 키의 다른 요청은 `409`를 반환한다.
- 사용자는 미래 `RESERVED` 예약의 시간 또는 동종 자원으로 이동할 수 있다.
- 다중 날짜 예약은 Series와 개별 Occurrence를 분리하고 전부 성공하거나 전부 실패한다.
- 고정석 대여는 Tenant Toggle만으로 열지 않는다. 배정자가 선언한 Release Window 안에서만 허용한다.
- Release Window 생성도 `Idempotency-Key`와 Fingerprint를 영속화하고 사용자·자원 단위 잠금을
  획득한다. 같은 키의 재시도는 최초 Window를 반환하고 다른 요청은 `409`로 거부한다.
- 관리자는 범위 내 예약을 검색하고 사유를 남겨 취소·재배치·대리 예약할 수 있다.
- 회의실 반복 Occurrence는 Calendar가 전개하며 Workplace 가용 Projection도 같은 회차를 읽는다.

## 7. 감사, 개인정보와 연계

- Workplace 감사 사건은 수정·삭제가 차단된 Append-only 원장과 중앙 Audit Outbox에 함께 기록한다.
- 완료·취소·노쇼 예약의 이름, 목적, Person ID는 Tenant 보존 기간 이후 익명화한다.
- Legal Hold는 익명화에서 제외되며 해제 사건도 감사한다.
- 예약·체크인·해제·노쇼는 `workplace.booking.*.v1` Domain Event를 같은 트랜잭션의 Outbox에 기록한다.
- 센서와 출입 공급자는 Adapter를 통해 관측 시각, 수신 시각, 장치 ID, 중복 키, 신뢰도를 전달한다.
- 원시 센서 신호는 예약을 직접 취소하지 않고 Occupancy Projection과 정책 평가기를 거친다.

## 8. 대량 운영

CSV Import는 `dry-run -> 오류 보고서 -> idempotent upsert -> 결과 내보내기` 순서다. 최대 행 수,
파일 크기와 문자열 길이를 제한하고 Campus/Building/Floor/Zone/Resource 외 임의 SQL 또는 JSON
경로를 허용하지 않는다. 대량 변경도 행별 결과와 상관 ID를 남긴다.

## 9. 출시 Gate

- 동일 자원 100개 동시 요청은 1개 성공, 나머지 `409`
- 동일 멱등 키 재시도는 동일 Booking ID 반환
- 다른 Tenant와 관리 범위 밖 Building은 존재 여부도 노출하지 않음
- Draft 배치도는 사용자 API에서 노출되지 않고 Publish 후 원자적으로 전환
- 정책 최종값과 출처가 서버와 UI에서 일치
- 반복 회의실 Occurrence가 Workplace 지도에서 점유로 표시
- Desktop, Tablet, Mobile, 200% Zoom에서 명령 누락과 수평 Overflow 없음
- 키보드 전 과정과 axe serious/critical 위반 0건
- API 장애 시 마지막 성공 데이터는 Stale 표시와 함께 유지
- OpenAPI, Flyway, Platform/Auth/Gateway 테스트와 실제 Gateway Playwright 통과

## 10. 구현 완료 범위

- Flyway `V156`~`V161`: 예약 운영·공간 거버넌스·미디어 정리 Outbox·감사/개인정보·지정석
  Release Window·Release Window 멱등성
- Campus → Building → Floor → Zone/Section → Resource 계층과 기존 Site API 호환 투영
- 접근 규칙, 정책 상속과 출처, 배치도 Revision/Snapshot, 위임 범위의 서버 측 ABAC
- 사용자 예약, 관리자 개입, Legal Hold, 보존기간 익명화, 감사 Outbox와 도메인 이벤트
- Desktop/Tablet/Mobile 관리 화면, 저장된 Draft 재개 편집, 오류·로딩·빈 상태와 권한별 명령 분리

## 11. 의도적으로 보류하는 항목

검증된 고객 요구와 입력 데이터가 없는 BIM/3D Digital Twin, 자체 센서 플랫폼, 점유 추천 AI는
도입하지 않는다. 확장 포트와 이벤트 계약까지만 제공하고 공급자 또는 실제 공간 데이터가 확정될
때 Adapter로 연결한다. 이는 기능 누락이 아니라 운영 위험과 과잉 구축을 줄이기 위한 명시적 결정이다.
