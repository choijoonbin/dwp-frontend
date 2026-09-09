# 알림 관리자 거버넌스 스튜디오

기준일: 2026-09-09. Design AI 결과물 10, 11, 12를 DWP 공통 셸과 실제 알림 계약에
맞춰 구현한 기준이다. 참조 화면을 그대로 복제하지 않고 정보 우선순위, 비교 검토, 모바일
작업 흐름을 채택했다.

## 화면과 책임

| 화면            | 경로                             | 책임                                                                             |
| --------------- | -------------------------------- | -------------------------------------------------------------------------------- |
| 알림 계약       | `/notifications/admin/contracts` | Provider가 등록한 이벤트, 소유 앱, 우선순위, 채널, 스키마와 상태 조회            |
| 정책 스튜디오   | `/notifications/admin/policies`  | 회사 수신 정책 제안, 영향 미리보기, 독립 승인·반려, 작성자 철회                  |
| 템플릿 스튜디오 | `/notifications/admin/templates` | Provider 기본 문구 비교, 변수 검증, 렌더링 미리보기, 독립 승인·반려, 작성자 철회 |

세 화면은 공통 관리자 셸의 fluid 폭을 사용한다. 데스크톱은 목록과 상세를 함께 비교하고,
모바일은 목록과 상세를 한 화면씩 전환한다. 상세 진입 시 포커스를 상세 영역으로 옮기고
목록 복귀 시 원래 선택 항목으로 되돌린다.

## 권한과 변경 계약

- 조회: 각 `ADMIN.NOTIFICATION_*:VIEW` 권한.
- 초안 작성과 본인 초안 철회: `MANAGE` 권한.
- 다른 작성자의 초안 게시와 반려: `APPROVE` 권한.
- 작성자는 자기 초안을 승인하거나 반려할 수 없고, 다른 사용자는 작성자의 초안을 철회할 수 없다.
- 철회·반려는 `Idempotency-Key`, 정규 십진수 `expectedVersion`, 10~500자 사유를 요구한다.
- 테넌트 또는 사용자가 다르면 404, 닫힌 초안이나 오래된 버전은 409로 실패하고 상태를 쓰지 않는다.
- 중복 요청은 동일 결과를 재생하며 상태 전이, 감사 기록, 정책 Outbox를 중복 생성하지 않는다.

실제 명령은 다음 owner-service 경계를 사용한다.

| 명령        | API                                              | 권한                                  |
| ----------- | ------------------------------------------------ | ------------------------------------- |
| 정책 철회   | `POST /v1/admin/policies/{policyId}/withdraw`    | `ADMIN.NOTIFICATION_POLICY:MANAGE`    |
| 정책 반려   | `POST /v1/admin/policies/{policyId}/reject`      | `ADMIN.NOTIFICATION_POLICY:APPROVE`   |
| 템플릿 철회 | `POST /v1/admin/templates/{revisionId}/withdraw` | `ADMIN.NOTIFICATION_TEMPLATE:MANAGE`  |
| 템플릿 반려 | `POST /v1/admin/templates/{revisionId}/reject`   | `ADMIN.NOTIFICATION_TEMPLATE:APPROVE` |

## UX 불변조건

- Provider 원본은 화면에서 직접 수정하지 않는다. 회사 변경은 항상 초안으로 제안한다.
- 게시 전 현재 적용값과 제안값을 같은 행에서 비교하고 변경된 항목을 명시한다.
- 템플릿은 실제 렌더링 결과와 체크섬을 검토하며 경고가 남으면 초안 생성을 차단한다.
- 정책은 사용자 유형, 시간대, 현지 시각, 집중 모드와 방해 금지 상태를 시뮬레이션해 채널별
  즉시·지연·억제 결과를 게시 전에 확인한다.
- 템플릿은 앱 내, 이메일, 웹·모바일 푸시, Teams·Slack의 실제 채널 형태로 렌더링하고
  Provider 원문과 회사 재정의를 명확히 구분한다.
- 미리보기와 편집 Dialog를 중첩하지 않는다. 미리보기에서 편집으로 돌아가도 입력값을 보존한다.
- 위험 명령은 명시적 확인 Dialog와 사유를 요구하고, 요청 중 중복 제출을 막는다.
- 검색, 앱, 상태 필터는 320px에서도 가로 넘침 없이 모두 접근 가능해야 한다.

## 2026-09-09 검증 증적

| 검사                                        | 결과                                         |
| ------------------------------------------- | -------------------------------------------- |
| Notification frontend 단위·라우트 검사      | 13 files, 66 tests PASS                      |
| 관리자 Chromium E2E                         | 5/5 PASS                                     |
| 전체 Notification 브라우저 E2E              | 적용 가능 46개 PASS, 프로젝트 조건 42개 skip |
| 320·390·1440 반응형, Axe critical·serious   | PASS                                         |
| TypeScript, scoped ESLint, i18n, 표시 사전  | PASS                                         |
| Notification source-size·design-system 회귀 | PASS, 알림 소유 위반 0                       |
| production Vite compile                     | PASS, 5,219 modules                          |
| Notification backend 전체                   | 255 tests, 실패·오류 0, 환경 의존 6 skipped  |

브라우저 46개 중 45개는 고정 production preview에서, 동적 모듈 실패 주입 1개는 Vite 개발
서버에서 검증했다. 최신 공유 트리의 전체 release build는 알림 밖 Dwaion feature boundary,
production reachability, source-size, design-system 회귀 109건과 공통 initial bundle budget
초과 때문에 아직 PASS로 기록하지 않는다. 현재 initial graph는 raw 1,982.6/1,074.2 KiB,
gzip 564.7/317.4 KiB, 7/5 requests다.

외부 Email, Push, Teams, Slack Provider의 Production HA·부하·DR과 실제 Credential 증적은
이 UI 구현 완료와 별개의 출시 Gate다. 준비되지 않은 채널을 화면 성공 상태로 표시하지 않는다.
