# 알림 Design 01-14 구현 매트릭스

기준일: 2026-09-09. 사용자가 전달한 Stitch 결과물 01-14를 최종 디자인 기준으로 삼되,
DWP 공통 셸, 실제 권한, Notification API와 원천 앱의 업무 소유권을 보존해 구현한 추적 문서다.
화면에 보이는 성공 상태나 명령을 fixture만으로 만들어 운영 기능처럼 표시하지 않는다.

## 완료 범위

| ID  | 사용자 과업             | 제품 경로와 구현                                                                       | 수용 기준                                                                            | 상태 |
| --- | ----------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---- |
| 01  | 조치 중심 알림 홈       | `/notifications/home`, `notification-home.tsx`                                         | 실제 Summary/Inbox/Profile로 KPI, 우선 조치, 멘션·대화, 업데이트, 앱별 미확인을 구성 | 완료 |
| 02  | 홈 실패·오프라인·모바일 | 같은 경로, `use-notification-runtime.ts`와 공통 상태 패널                              | Partial/Offline/재시도, 390px 단일 열, 숨은 가로 메뉴 없음                           | 완료 |
| 03  | 받은 알림 작업대        | `/notifications/center`, `notification-center.tsx`                                     | URL 정본 필터, 일괄 처리, 키보드 triage, 데스크톱 master-detail                      | 완료 |
| 04  | 상세·원천 행동·답장     | `/notifications/center/:notificationId`, `notification-detail-pane.tsx`                | 직접 URL, target 수명주기, 읽음·저장·미룸·정리, Messenger 실제 답장 API              | 완료 |
| 05  | 멘션·수신 이유·수명주기 | Center의 `MENTIONS/SAVED/SNOOZED/DONE` 보기                                            | 서버 집계와 reason query를 유지하고 원천 업무 완료와 알림 정리를 분리                | 완료 |
| 06  | 모바일 필터·개인정보    | Center Drawer/filter sheet와 delivery profile                                          | 320/390px, preview 숨김, 민감 정보 명시적 열기, 필터 결과와 빈 Inbox 구분            | 완료 |
| 07  | 개인 수신 설정          | `/notifications/settings`, `notification-preferences.tsx`                              | 채널, Quiet Hours, Digest, 표시 개인정보, 앱·유형별 설정과 자동 저장                 | 완료 |
| 08  | 수신 상태 진단          | 같은 경로, `notification-delivery-status.tsx`                                          | 영속 저장소·SSE 동기화·채널 가용성을 API로 표시하고 즉시 재검사                      | 완료 |
| 09  | 운영 개요·전달 현황     | `/notifications/admin/{overview,operations}`                                           | 실제 KPI·추이·Finding·QoS lane·Provider 상태와 정본 조사 URL                         | 완료 |
| 10  | 알림 계약 카탈로그      | `/notifications/admin/contracts`, `notification-admin.tsx`                             | 앱·Type·스키마·채널·상태 검색과 반응형 목록/상세                                     | 완료 |
| 11  | 회사 정책 스튜디오      | `/notifications/admin/policies`, `notification-policy-studio.tsx`                      | 현재/제안 비교, 영향 미리보기, 4-eyes 승인·반려·철회                                 | 완료 |
| 12  | 메시지 템플릿 스튜디오  | `/notifications/admin/templates`, `notification-template-studio.tsx`                   | Provider 원본 보존, 변수 검증, 실제 렌더링 미리보기, 4-eyes 변경                     | 완료 |
| 13  | 실패 조사·안전 조치     | `/notifications/admin/operations?finding=...`, `notification-operations-workbench.tsx` | 목록/상세, 영향·담당·시각·권고, 재검사, 감사 증적과 거버넌스 화면 연결               | 완료 |
| 14  | 전달 억제 운영          | `/notifications/admin/suppressions`, `notification-suppression-studio.tsx`             | 생성·예약·활성 상태, 긴급 우회, 사유·기간, 확인 후 해제, 모바일 카드                 | 완료 |

`/notifications/inbox`와 `/notifications/inbox/:notificationId`는 기존 링크를 깨지 않도록
query/hash를 보존해 Center 정본 경로로 이동한다. 사용자 메뉴와 관리자 메뉴는 Work/Management
surface, PAGE/DATA/ACTION 권한 경계를 공유하지 않고 각자 fail-closed한다.

## Design AI 보정 원칙

- 화면 구조와 작업 우선순위는 도입하되 Calendar, Chronos, 가상 AI 점수 같은 참조 제품 데이터는
  DWP 데이터인 것처럼 복제하지 않았다.
- 데스크톱은 비교가 필요한 Center·관리자 카탈로그를 분할 화면으로 제공하고, 모바일은 목록과
  상세을 한 번에 하나씩 보여준다.
- 선택 카드와 상세 패널이 동시에 보일 때 동일한 Primary Action을 중복 노출하지 않는다.
- 모바일 운영 지표는 넓은 표의 가로 스크롤 대신 QoS lane·Provider 카드로 모든 열을 노출한다.
- 임의 재전송은 중복·권한 상승·부작용을 만들 수 있어 버튼만 만들지 않았다. 현재는 재검사,
  감사 증적, 정책·계약·템플릿 정본 이동까지 제공한다.

## 검증 경계

- `notification-design-completion.spec.ts`: 운영 Finding 정본 이동, 390px 조사·억제, 설정 진단,
  Center 분할 상세·호환 경로, 상세 Messenger 답장을 검증한다.
- `notifications.spec.ts`, `notification-views.spec.ts`, `notification-admin-governance.spec.ts`:
  기존 홈·센터·설정·관리 기능과 디자인 고도화 간 회귀를 검증한다.
- API fixture 브라우저 검증과 실제 시스템 종단 증거를 구분한다. 2026-08-21에는 서로 다른 실제
  계정의 Messaging Commit -> Outbox -> Kafka -> Notification Materializer -> Inbox -> SSE를 확인했다.
- Email, Push, Teams, Slack Provider의 Production Credential·HA·부하·DR 증거는 외부 환경 Gate다.
  비활성 채널은 UI에서 성공으로 표시하지 않는다.

### 2026-09-09 실행 결과

| Gate                                    | 결과                                         |
| --------------------------------------- | -------------------------------------------- |
| Notification 단위·라우트 검사           | 13 files, 66 tests PASS                      |
| 홈·센터·설정·관리 브라우저 E2E          | 적용 가능 46개 PASS, 프로젝트 조건 42개 skip |
| TypeScript와 Notification scoped ESLint | PASS, 오류·경고 0                            |
| Notification source-size·design-system  | PASS, 알림 소유 위반 0                       |
| i18n·Display Dictionary                 | PASS                                         |
| Production Vite compile                 | PASS, 5,219 modules                          |
| Notification backend `check`            | 255 tests, 실패·오류 0, 환경 의존 6 skipped  |

브라우저 묶음은 320/390/1440px, 모바일 직접 상세 URL, 200% 유효 폭,
light/dark/high-contrast, 키보드, 권한 회수, SSE cursor reset, partial/offline, long text와
Messenger 답장 실패·재시도를 포함한다.
고정 production preview에서 45개를 검증했고, 동적 모듈 실패 주입 1개는 Vite 개발 서버에서
별도로 검증했다. 최신 공유 트리의 전체 release build는 알림 밖 Dwaion feature boundary,
production reachability, source-size, design-system 회귀 109건과 공통 initial bundle budget
때문에 아직 닫히지 않았다. initial 합계는 raw 1,982.6/1,074.2 KiB,
gzip 564.7/317.4 KiB, 7/5 requests다. 알림 구현 완료와 전체 제품 출시 Gate를 혼동하지
않는다.

## 의사결정이 필요한 후속

다음 항목은 디자인 누락이 아니라 안전한 운영 계약이 먼저 필요한 범위다.

1. Governed Replay: 대상 Delivery Job, 최대 batch, dry-run, 독립 승인, idempotency, rate limit,
   취소와 감사 원장을 갖춘 별도 ACTION 계약이 확정돼야 한다.
2. 외부 채널 실제 발송 시험: Provider Credential, 발신 Domain, callback·suppression,
   장애 주입·HA·DR 환경 승인이 필요하다.
3. 조직·Role 대규모 발송: People Target Population Snapshot 계약과 용량 한도 승인이 필요하다.

이 세 항목을 제외한 01-14의 내부 제품 화면, 메뉴, 반응형 흐름과 현재 공개 API 연결은 구현 범위다.
