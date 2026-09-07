# Recipient Views and Action Home

기준일: 2026-09-04. 이 문서는 기존 기획의 미구현 제안과 현재 구현을 구분하는 최신 기준이다.

## 업무 정의

- 사용자: 현재 테넌트의 본인 알림을 처리하는 구성원. 관리 기능은 기존 Management 권한으로 분리한다.
- 질문: 나를 언급한 알림인가, 조치가 필요한가, 어떤 이유로 받았으며 무엇을 처리했는가?
- 주 행동: 보기 선택, 조건 조합, 관련 업무 확인, 답장, 읽음, 저장, 미룸, 알림 정리/복원.
- 화면 유형: 알림 센터는 목록/상세 작업대, 홈은 우선 항목을 직접 처리하는 개요다.
- 순서: 수신 분류와 서버 조회 계약을 먼저 확정하고 같은 의미를 홈에 재사용한다.

## 외부 비교

시장 순위로 '글로벌 Top 3'를 단정하지 않는다. 대표적인 협업 제품 3개와 현대 업무 제품을 비교했다.

| 제품과 공식 근거                                                                                                                                             | 도입한 원칙                                   | DWP에 그대로 복제하지 않는 부분                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | --------------------------------------------------- |
| [Slack Activity](https://slack.com/help/articles/46751260742035-Introducing-the-new-Activity-view-in-Slack/)                                                 | 멘션, 수신 이유, 읽지 않음, 정리 상태 구분    | 반응/초대/스레드는 producer 계약 없이 생성하지 않음 |
| [Microsoft Teams Activity](https://support.microsoft.com/en-us/teams/notifications-settings/explore-the-activity-feed-in-microsoft-teams)                    | 멘션 보기 안에서 unread를 독립 조건으로 적용  | Teams의 고유 회의·반응 분류를 추정하지 않음         |
| [GitHub Inbox](https://docs.github.com/en/subscriptions-and-notifications/how-tos/viewing-and-triaging-notifications/managing-notifications-from-your-inbox) | 수신 이유 필터, saved와 done 분리             | 알림 정리를 원천 업무 승인/완료로 취급하지 않음     |
| [Linear Inbox](https://linear.app/docs/inbox)                                                                                                                | 미룸/복귀, 문맥을 유지하는 정리와 키보드 조작 | 근거 없는 AI 요약·처리 생산성 점수를 만들지 않음    |

독립 디자인/아키텍처 에이전트가 URL 범위 소실, 중복 보기 컨트롤, 잘못된 분류 명칭,
모바일 가로 스크롤, reason alias 불일치를 검토했다. 이는 실제 업체/외부 디자이너의 승인이라는 의미는 아니다.

## 정보구조

공통 product route/PEP는 변경하지 않는다. sidebar는 홈, 알림 센터, 설정과 권한별 운영 메뉴를 유지한다.
기본 보기는 `/notifications/center` 내부 단일 탐색으로 제공하므로 legacy/canary shell 모두 동일하다.

| 기본 보기 | 실제 서버 조건  | 유의점                                                |
| --------- | --------------- | ----------------------------------------------------- |
| 받은 알림 | `view=ALL`      | 활성 inbox. 미룸·정리됨을 제외하므로 전체 이력이 아님 |
| 조치 필요 | `view=PRIORITY` | 활성 `action_required`. 긴급도와 다른 축              |
| 나를 멘션 | `view=MENTIONS` | 명시적인 멘션 사유만 포함. 일반 대화와 다름           |
| 저장됨    | `view=SAVED`    | 저장 표시. 미룸/정리 상태와 중복될 수 있음            |
| 나중에    | `view=SNOOZED`  | 만료 전 미룸. 만료 후 받은함에 복귀                   |
| 정리됨    | `view=DONE`     | 알림 정리 상태이며 원천 업무 완료가 아님              |

- 추가 필터: 읽음 상태, 원천 앱, 수신 이유, 우선순위, 검색.
- 수신 이유: 직접 수신, 멘션, 역할, 조직, 구독, 필수 정책. DIRECT는 업무 배정만을 의미하지 않는다.
- 멘션 보기로 이동하면 모순되는 reason만 해제하고 unread/app 등 다른 조건은 유지한다.
- 보기 숫자는 서버의 사용자 전체 집계다. 검색 결과 수나 현재 페이지 수로 대체하지 않는다.
- 현재 정렬은 `last_activity_at DESC, notification_id DESC`. SLA/AI 우선순위 정렬이라고 표시하지 않는다.
- URL은 `view/read/q/app/priority/reason`만 관리한다. 공통 `scope` 등 다른 query는 유지한다.
- 보기 이동은 history push, 세부 필터/검색은 replace. Back/Forward에서 URL이 정본이며
  사용자 이벤트에서만 URL을 변경해 상호 effect의 경쟁을 제거한다.
- 모바일은 보기 선택기와 bottom filter sheet를 사용한다. 가로로 숨겨진 메뉴를 탐색할 필요가 없다.

## 서버 계약 보정

DB 변경/추가 테이블 없이 기존 인덱스·keyset·RLS 조회를 유지한다.
필터와 응답은 동일한 canonical alias 표를 사용한다.

| 정규 값          | 과거/producer 표기 |
| ---------------- | ------------------ |
| DIRECT           | DIRECT_RECIPIENT   |
| MENTION          | MENTIONED          |
| ORGANIZATION     | ORG                |
| SUBSCRIPTION     | SUBSCRIBED         |
| MANDATORY_POLICY | MANDATORY          |

ROLE은 정확한 ROLE이다. 잘못된 readState는 400으로 거부한다. 미분류 코드를 직접 수신으로
위장하지 않도록 UNKNOWN은 중립적인 수신 이유로 표시한다. UNKNOWN은 정상 업무 필터 선택지에
포함하지 않는다. 새로운 업무 유형은 producer 온보딩 계약에서 먼저 정의해야 한다.

## 홈 연결

- 공통 fluid PageCanvas/가로 gutter를 사용한다. Notification만의 중앙 최대폭 제한을 제거했다.
- 큰 소개 영역 대신 작은 제목, 검색, 동기화 상태를 같은 상단 도구 영역에 배치한다.
- 조치 필요/읽지 않음/멘션/미룸 요약 선택은 서버 query를 실행해 홈 내부 목록을 전환한다.
- 선택 해제 시 개요로 돌아오고, 센터 열기는 현재 선택 조건을 전달한다.
- 결정론적인 업무 브리핑과 조치/대화/업데이트 그룹, 앱별 unread 분포와 수신 정책은 유지한다.
- 메신저 답장은 실제 messaging API에 idempotency key를 사용한다. 전송 성공 후 알림 정리에
  실패해도 메시지를 다시 보내지 않고 별도 경고를 제공한다.
- Approval/Reject는 Notification의 read/complete API로 대체하지 않는다. 현재 소유 업무 화면으로
  이동하며, 별도 owner-command capability가 준비돼야 inline 승인으로 확장할 수 있다.

## 검증과 남은 범위

- `notification-filter-model.test.ts`: 필터 조합/초기화/URL/낙관적 reason 격리.
- `notification-views.spec.ts`: 6종 reason query, 멘션 전용, URL 복원, 필터 빈 상태,
  390/320px filter sheet, 홈 내부 전환, Axe.
- `notifications.spec.ts`, `notifications-runtime.spec.ts`: 설정/운영/상세/키보드/답장 재시도/
  header burst/권한 회수/부분 실패/다국어/모양새 회귀.
- Backend `NotificationReasonQueryPostgresIntegrationTest`: 실제 PostgreSQL 마이그레이션·RLS,
  alias·필터 조합·사용자 격리·keyset. mocked browser와 실제 DB 증적을 구분한다.

이번 범위에 개인 SavedView 저장은 포함하지 않는다. 기존 플랫폼 저장 테이블은 재사용할 수 있으나
`notifications.center` surface 허용, exact entitlement, PERSONAL 제한, 설정 schema 검증이 먼저다.
현재 URL로 조회 상태를 보존하며 저장 버튼이 작동하는 척하지 않는다.
반응 전용/회의 초대/구독 스레드/owner inline 승인과 외부 채널 HA·부하·DR은 별도 계약과 운영 Gate다.
이 메뉴 개선 완료를 모든 앱의 이벤트 발행 또는 Production 출시 완료로 해석하지 않는다.

## 실행 증적 (2026-09-04)

| 검사                                              | 결과                           | 경계                                                            |
| ------------------------------------------------- | ------------------------------ | --------------------------------------------------------------- |
| Notification backend `check`                      | 219 PASS, 실패/스킵 0          | 담당 아키텍처 에이전트 실행 결과                                |
| reason 타깃                                       | 64 PASS                        | 단위 48 + 실제 PostgreSQL 16, 위 219에 포함                     |
| Notification frontend 단위 검사                   | 8 files / 53 PASS              | center/model/filter/navigation 및 arrival/header 관련 선택 집합 |
| 브라우저 회귀                                     | 35 PASS / 31 명시적 skip       | 3 spec의 중복 프로젝트 실행 제외. 실패/재시도 0                 |
| 전체 TypeScript / scoped ESLint                   | PASS / 오류·경고 0             | Notification 변경 경계                                          |
| architecture / source-size / i18n / design-system | PASS                           | 기준 상향 없음                                                  |
| 전체 `yarn build`                                 | 마지막 bundle budget 단계 FAIL | lint/tsc/Vite 컴파일은 PASS                                     |
| local Notification runtime                        | `8008/actuator/health` UP      | Notification만 재기동, 기존 DB/Redis/Kafka 재사용               |

브라우저 회귀는 실제 Chromium/WebKit 화면을 API fixture와 함께 실행한 UI 증적이다.
기존 로그인 계정의 비모킹 실서버 종단 테스트를 의미하지 않는다. 사용자 Chrome 탭 연결은
도구 타임아웃으로 완료하지 못했다. 실제 DB 조회와 RLS는 별도의 PostgreSQL 통합 검사로 검증했다.
320/390px, 밝은/어두운 테마와 고대비, 200% 배율에 대응하는 640px 유효 화면 폭을 검증했다.
배율 검증은 CSS `zoom`이 아닌 축소된 CSS viewport에서 미디어쿼리와 필터 접근을 확인한다.
뒤로 가기 경합은 추가 10회 반복에서도 통과했다.

```sh
corepack yarn vitest run apps/dwp/src/features/notifications apps/dwp/src/components/notification-arrival apps/dwp/src/components/notification-header-data
E2E_REUSE_EXISTING_SERVER=true PLAYWRIGHT_OUTPUT_DIR=artifacts/notification-final-e2e corepack yarn playwright test e2e/notifications.spec.ts e2e/notifications-runtime.spec.ts e2e/notification-views.spec.ts --workers=2
corepack yarn typecheck
corepack yarn architecture:check
corepack yarn build
./gradlew :dwp-notification-server:check
```

마지막 명령은 backend 저장소에서 실행한다. 프런트 명령은 프로젝트가 지정한 Node 24 런타임을 사용한다.
스크린샷은 `artifacts/notification-final-e2e/`에 보관한다. 테스트용 제목/계정이 포함된 화면이며
운영 사용자의 실데이터 캡처로 제시하지 않는다.

남은 공통 빌드 차단: initial raw **1172.7 / 1074.2 KiB**, gzip **333.5 / 317.4 KiB**.
초기 요청 수 5/5와 최대 비동기 청크 예산은 통과했다. 이 작업에서 공유 번들 정책이나
허용량을 수정하지 않았으며, 공통 초기 의존 그래프 최적화가 필요하다.

추가로 처리한 결함은 reason alias 오분류, unknown의 DIRECT 위장, URL 상호 effect 경합,
키보드의 이전 선택 참조, 잘못된 상세 응답이 정상 도착 알림까지 중단하는 문제다.
빈 상세 응답은 최대 3회 재시도하며 같은 배치의 정상 알림과 중복 방지를 보존한다.
기능 안내용 고정 하단 바는 목록을 가리지 않도록 제거했고, 키보드 조작 자체는 유지했다.

독립 최종 감사에서 수신 이유 변경 후 이전 범위의 일괄 선택이 유지되는 P1을 발견했다.
회귀 테스트를 먼저 실행해 툴바가 남는 실패를 재현한 뒤, `filters.reason` 변경도 선택 ID·
상세창·retained 상태 초기화에 포함했다. 최종 35건에는 DIRECT 선택 후 ROLE 전환 시
체크 해제·일괄 툴바 제거·bulk 요청 미발생을 검증하는 사례가 포함된다.
재감사에서 해당 P1 해소와 검토한 캡처의 시각 배치 적합을 확인했다.
키보드·뒤로 가기 주요 흐름도 추가 반복 10/10으로 통과했다.
