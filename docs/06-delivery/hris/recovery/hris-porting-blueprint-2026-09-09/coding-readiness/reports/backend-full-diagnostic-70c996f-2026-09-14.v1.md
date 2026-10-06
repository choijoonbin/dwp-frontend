# Backend 전체 진단 — 70c996f

결과는 **BUILD SUCCESS WITH EXISTING SKIPS**입니다. HRIS 전체 코딩 준비 완료나 기존 G0 catalog receipt의 재봉인을 선언하는 보고서는 아닙니다.

검증 명령:

```text
./gradlew check --no-daemon --max-workers=1 --continue
```

- 실행: 2026-09-14T01:15:44.578Z → 2026-09-14T01:29:20.949Z, 816.375초(Gradle 표시 13분 36초), exit 0.
- HEAD: `70c996fdafc011392056a1909a2e5222b240ded3`, tree: `ad226258485214e52a552e08594668c3593c320b`.
- Control 참조: `dwp-migration-control-v2:7f31c20e45bfdb6a3a4b101b79227645208c1846d16e7b5af790aef707c3b09c`.
- 검증 전후 HEAD/tree/Control 참조 동일, git clean. hris-verification lock 대기 0ms, 정상 해제.
- Gradle actionable tasks: 103개 중 23 실행, 80 UP-TO-DATE.
- XML: 774 suites/classes, 4,075 reported testcase IDs, failure 0/error 0/**skipped 68**. 68건을 성공으로 계산하지 않습니다.
- 이번 실행에서 갱신: 307 suites/1,712 reported cases, skip 1. 재사용: 467 suites/2,363 cases, skip 67. 재사용된 skip 조건은 이번 명령에서 재평가되지 않았습니다.
- 4,007건은 이번 실행 또는 이전 성공 XML의 non-skipped 건수이며, 4,007건 모두를 이번에 신규 실행했다는 뜻이 아닙니다.

## 모듈별 XML 결과

| 모듈 | suites | reported cases | skipped | XML 범위 |
| --- | ---: | ---: | ---: | --- |
| dwp-approval-server | 34 | 236 | 0 | 이번 실행에서 갱신 |
| dwp-audit | 1 | 1 | 0 | UP-TO-DATE 재사용 |
| dwp-auth-server | 106 | 445 | 0 | UP-TO-DATE 재사용 |
| dwp-core | 36 | 199 | 0 | UP-TO-DATE 재사용 |
| dwp-gateway | 41 | 309 | 1 | UP-TO-DATE 재사용 |
| dwp-meeting-server | 111 | 664 | 2 | UP-TO-DATE 재사용 |
| dwp-messaging-server | 44 | 193 | 58 | UP-TO-DATE 재사용 |
| dwp-migration-control | 5 | 32 | 0 | 이번 실행에서 갱신 |
| dwp-notification-server | 57 | 265 | 6 | UP-TO-DATE 재사용 |
| dwp-observability | 1 | 4 | 0 | UP-TO-DATE 재사용 |
| dwp-payroll-server | 4 | 6 | 0 | UP-TO-DATE 재사용 |
| dwp-people-server | 55 | 225 | 0 | UP-TO-DATE 재사용 |
| dwp-platform-contracts | 2 | 22 | 0 | UP-TO-DATE 재사용 |
| dwp-platform-server | 212 | 1160 | 1 | 이번 실행에서 갱신 |
| dwp-provider-server | 56 | 284 | 0 | 이번 실행에서 갱신 |
| dwp-space-server | 5 | 24 | 0 | UP-TO-DATE 재사용 |
| dwp-time-server | 4 | 6 | 0 | UP-TO-DATE 재사용 |

모든 모듈의 failure/error는 0입니다. 307개의 새 XML은 EXECUTED task, 467개의 기존 XML은 UP-TO-DATE task에 속함을 독립 교차 확인했습니다.

## 68개 skip의 선언된 조건

XML의 모든 `<skipped/>`는 이유/메시지를 기록하지 않았습니다. 따라서 실제 환경값이나 확정된 런타임 이유를 추정하지 않았고, 아래는 소스의 선언된 opt-in 조건입니다. 정확한 68개 ID와 소스 경로/행/조건은 JSON에 보존했습니다.

| 선언된 환경 조건 | reported skipped cases | 이유 근거 |
| --- | ---: | --- |
| `DWP_RUN_KAFKA_ROLLOUT_REHEARSAL` | 1 | XML 이유 미기록; 소스 선언 조건 확인 |
| `DWP_LIVEKIT_SMOKE` | 2 | XML 이유 미기록; 소스 선언 조건 확인 |
| `DWP_MESSAGING_INTEGRATION_DB_URL` | 58 | XML 이유 미기록; 소스 선언 조건 확인 |
| `DWP_NOTIFICATION_INTEGRATION_DB_URL` | 6 | XML 이유 미기록; 소스 선언 조건 확인 |
| `DWP_EXPORT_PLATFORM_OPENAPI` | 1 | XML 이유 미기록; 소스 선언 조건 확인 |

스킵 변경·opt-in 활성화·외부 DB/Kafka/LiveKit 설정 제공은 수행하지 않았습니다. 클래스 단위로 스킵된 parameterized test의 하위 invocation은 XML에 확장되지 않을 수 있어, 위 수는 정확한 JUnit XML reported ID 수입니다.

## 집중 검증 12개 재확인

- `ApprovalApplicationContextPostgresTest`: 3개. 실제 외부 Control → OpenAPI HTTP 정상 기동, runtime TEMP/domain DDL/history 접근 거부, actual receipt 누락 boot 거부.
- `ApprovalDatabaseMigrationConfigurationTest`: 3개.
- `ControlFixtureProcessTest`: 6개. 환경 격리, 비밀값 마스킹, 출력 제한, timeout/실패 처리.

위 12개는 이번 전체 실행에서 새로 갱신된 XML이며 failure/error/skipped 모두 0입니다.

## 변경·자원 경계

생산 소스·SQL·registry·guard·skip annotation·G0 catalog·사용자 서버를 수정하지 않았습니다. 직접 관찰한 이번 reporter/wrapper/single-use daemon/worker 및 process groups는 정상 종료 후 존재하지 않았고 강제 종료도 하지 않았습니다. 장시간 Platform 구간에서 소유 worker의 CPU와 실제 MailOrganization Flyway PostgreSQL commit stack을 읽기 전용으로 확인했습니다.

새 Control 참조와 일치하지 않는 이전 smoke/runtime matrix 및 session 봉인은 재사용하면 안 됩니다. HRIS 기능/owner-source 의미 설계와 모듈 Code Gate는 이 백엔드 진단과 별도로 검증해야 합니다.

[진단 JSON](/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/reports/backend-full-diagnostic-70c996f-2026-09-14.v1.json) · [전체 XML/class/skip manifest](/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/reports/backend-full-diagnostic-70c996f-2026-09-14.xml-manifest.v1.json)

