# Stitch 구현 및 글로벌 완결성 감사

최초 감사일: 2026-09-16  
완료 재검증일: 2026-09-17

## 최종 판정

전달받은 Stitch 01-20의 정보 구조, 반응형 화면, 정상·빈 화면·오류·권한·오프라인 상태와
화면에 표현된 사용자·관리자 기능을 DWP Shell과 실제 Notification 계약에 맞게 구현했다.
PNG를 정적인 샘플 데이터로 복제하지 않고 실 API, 권한, 개인정보 보호, 낙관적 처리와 실패 복구를
연결했으며, 승인된 화면 구성을 Playwright 이미지 기준선으로 고정했다.

| 검증 축              | 판정           | 완료 근거                                                                                         |
| -------------------- | -------------- | ------------------------------------------------------------------------------------------------- |
| Stitch 01-20 화면    | 완료           | 홈, 센터, 상세, 개인 설정, 관심 규칙, 관리자 거버넌스와 품질 화면을 Desktop·Mobile에 연결         |
| 사용자 실행 기능     | 완료           | 읽음·저장·미룸·완료·일괄 처리, Messenger 답장, Saved View, Context Filter, Follow·Mute·Prioritize |
| 관리자 기능          | 완료           | 계약, 정책, 템플릿, 전달 운영·제어, 관심 정책 4-eyes, 익명 소음 품질과 Finding Deep Link          |
| 시각 수용 기준       | 완료           | 17개 Stitch 전용 Screenshot Baseline과 320·390·1280·1440·200% Reflow 회귀                         |
| 내부 R2 고도화       | 완료           | E1-E5의 데이터, API, 권한, 감사, UI, 실패 상태와 회귀 테스트 구현                                 |
| 외부 채널 Production | 외부 Gate 대기 | Email·Push·Teams·Slack 자격증명, Kafka HA·부하·DR 및 출시 승인은 배포 환경 증거 필요              |

여기서 "완료"는 DWP 저장소에서 통제할 수 있는 제품·아키텍처·코드·자동 회귀 범위의 완료다.
실제 Provider 계약이나 Production 인프라 승인을 화면 Fixture로 가장하지 않는다.

## Stitch 수용 방식

### 입력 정본

- 01-14 원본 ZIP SHA-256:
  `c5675c7843023dba353f9df57a9a48caae26414995ff7ef976f516e0e5d40ac1`
- 15-20 추출·감사 산출물:
  `/Users/a10697/Work/DWP/output/notification-design-15-20-audit-2026-09-16`
- `02._action_center_390px`는 Notification 화면이 아니라 Approval Owner 화면이므로 알림 구현에서
  제외했다.

### 적용 원칙

- Stitch의 정보 위계, 화면 구성, 밀도, 상태와 작업 흐름을 수용한다.
- DWP 공통 Header·Sidebar·Typography·Spacing·Focus 계약을 유지한다.
- 샘플 수치를 하드코딩하지 않고 실제 API 응답과 개인정보·권한 정책을 사용한다.
- Provider가 비활성인 기능은 성공처럼 꾸미지 않고 비활성 사유와 운영 Gate를 표시한다.
- Desktop Split View와 Mobile List → Detail → Back 흐름을 별도로 검증한다.

## 화면 및 기능 매핑

| 디자인 범위           | 구현 화면·기능                                                                          |
| --------------------- | --------------------------------------------------------------------------------------- |
| 01-02 알림 홈         | 실시간 상태, KPI Filter, 브리핑, 우선 조치, 멘션·대화, 업데이트, 앱별 미확인, 수신 환경 |
| 03 알림 센터          | 보기 탭, 조합 Filter, Saved View, 목록·상세 Split, Keyboard Triage, Bulk Action         |
| 04 상세·작업          | 수신 이유, Safe Preview, 읽음·저장·미룸·완료, Source 이동, Messenger Reply·Retry        |
| 05-06 실패·빈 상태    | Partial·Offline·Timeout·403·429·Deleted Target, Retry, Focus·Draft 보존                 |
| 07-08 개인 설정       | 채널, 앱·유형 규칙, Quiet Hours, Digest, Privacy, Endpoint·시험 알림 진단               |
| 09 관리자 운영        | 상태·SLO·Finding·Unknown 분류, 전달 조사와 정확한 Deep Link                             |
| 10-12 관리자 거버넌스 | 계약, 정책, 템플릿, 전달 운영, 억제, 4-eyes와 감사 경계                                 |
| 13-14 관리자 장애     | Provider·Queue 장애, Unknown 상태, 제한 작업, 복구와 Reconciliation                     |
| 15 관심 규칙          | Actor·Thread·Resource·Topic Exact Rule, Follow·Mute·Prioritize, 일정·채널 Override      |
| 16 Saved View v2      | 다중 Context, 밀도·Grouping, Pin·순서·한도, URL·Reload·Tenant/User 격리                 |
| 17 Context Action     | 현재 알림에서 즉시 Follow·Mute·Prioritize, 서버 Preview와 정책 잠금                     |
| 18-19 수신 집중 설정  | Desktop·Mobile 규칙 작성, Scope Discovery, 시험 알림·기기 진단, 실패 복구               |
| 20 소음 품질          | 익명 Mute·중복 억제·전환 지표, 최소 집단 Privacy, Finding·정책 Deep Link                |

## 글로벌 사례 반영

Slack Activity의 실행 중심 분류, Microsoft Teams의 수신·채널 제어, GitHub Inbox의 Saved
Filter와 Done 모델을 참고했다. DWP는 여기에 Tenant Mandatory Policy, 독립 승인, 감사 Outbox,
Source App Entitlement와 개인정보 보호 집계를 결합했다.

- [Slack Activity](https://slack.com/help/articles/46751260742035-Introducing-the-new-Activity-view-in-Slack/)
- [Slack Activity 작업 방식](https://slack.com/help/articles/19693583638803-Get-your-work-done-from-the-Activity-view)
- [Microsoft Teams 알림 설정](https://support.microsoft.com/en-us/teams/notifications-settings/manage-notifications-in-microsoft-teams)
- [Microsoft Teams Activity](https://support.microsoft.com/en-us/teams/notifications-settings/explore-the-activity-feed-in-microsoft-teams)
- [GitHub Inbox 관리](https://docs.github.com/en/subscriptions-and-notifications/how-tos/viewing-and-triaging-notifications/managing-notifications-from-your-inbox)
- [GitHub Inbox Filter](https://docs.github.com/en/subscriptions-and-notifications/reference/inbox-filters)

## R2 고도화 완료 상태

| 단계 | 범위                             | 상태 | 구현 결과                                                       |
| ---- | -------------------------------- | ---- | --------------------------------------------------------------- |
| E1   | Saved View v2                    | 완료 | 밀도·Grouping·다중 Context·Pin·순서·한도와 무손실 계약          |
| E2   | Contextual Follow/Mute·중요 인물 | 완료 | Actor·Conversation·Thread·Resource Exact Rule, 이유와 감사      |
| E3   | 안전한 시험 알림                 | 완료 | Inbox 비투영, Rate Limit, 활성 Browser·Device 선택, 실패·재시도 |
| E4   | Governed Topic Watch             | 완료 | Producer Topic Token, Tenant Allowlist, 민감 본문 비검색        |
| E5   | Noise Quality Analytics          | 완료 | 익명 지표, 최소 집단 보호, Noisy Type와 개선 Finding            |

새 Sidebar 메뉴를 무분별하게 늘리지 않고 `알림 센터`, `알림 설정`, `정책 스튜디오`, `운영 개요`
안에 반복 업무와 권한 경계를 배치했다.

## 검증 요약

정확한 명령과 수치는
[R2 완료 증적](18-notification-r2-completion-evidence-2026-09-17.md)에 기록한다.

- Frontend Notification 단위 테스트 29 files, 163 tests 통과
- Chromium Notification E2E 101 통과, 프로젝트 전용 1건 조건부 Skip, 실패 0
- Stitch Screenshot Baseline 17건 독립 재실행 통과
- iPhone 13 WebKit 실제 대상 2건 통과, Desktop 전용 100건 조건부 Skip
- Notification Backend 464 tests 중 416 통과, PostgreSQL 조건부 48건 Skip, 실패 0
- 실제 PostgreSQL 통합 61건 통과
- Messaging Producer 계약 8건 통과
- TypeScript, Notification ESLint, Vite Production Build 통과

## Production에서만 닫을 수 있는 Gate

- Email·Web Push·Mobile Push·Teams·Slack 실제 Provider 자격증명과 Callback 검증
- Production Kafka 다중 Broker·복제, 부하·장애·복구·DR 실행 증적
- Retention, Residency, Support Session 본문 가시성의 조직 승인
- Tenant 휴일 정본·개인 일정 합성 우선순위와 Governed Failed-delivery Replay 운영 정책 승인
- Edge·Safari 실기기 전체 SSE Matrix와 Screen Reader 장시간 Burst 검증
- Production 용량 기반 Virtual List 활성화 임계와 최종 SLO 승인

이 항목은 내부 제품 미구현이 아니라 외부 환경·정책·출시 증적이다. Readiness에서는 계속
Fail Closed 또는 `PENDING/BLOCKED_EXTERNAL`로 유지한다.
