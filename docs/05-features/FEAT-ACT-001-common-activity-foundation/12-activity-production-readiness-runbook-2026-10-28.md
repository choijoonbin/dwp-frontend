# Activity 운영 준비 런북 (2026-10-28)

## 목적과 현재 판정

이 문서는 Activity 홈·타임라인·공통 상세·DWAI·ON 실행 이력을 운영에 전환하기 전에 필요한 검증과 승인 경계를 고정한다. 현재 소스는 로컬 계약·보안·접근성 검증을 갖추고 있지만, 이 문서 작성만으로 운영 배포·보존 정책 승인·법적 증적 적합성·외부 provider 연결을 승인하지 않는다.

다음 작업은 이 런북에서 **실행하지 않는다**.

- 운영 DB의 삭제·archive·partition 변경
- 운영 tenant 또는 실제 Mail/Calendar provider 호출
- legal hold 생성·해제
- 백업 복원, DNS·traffic·feature flag 변경
- 배포·rollback·경보 수신자 등록

위 작업은 각 절의 승인자가 서면 승인한 변경 창에서만 수행한다.

## 책임과 데이터 경계

| 영역                                 | 정본·책임자                  | 운영 전 필수 승인                       |
| ------------------------------------ | ---------------------------- | --------------------------------------- |
| Workspace Activity 사건·감사 receipt | Platform 서비스·DB 운영자    | Product owner, Platform owner, Security |
| DWAI·ON run·stage·source 관측        | Agent 서비스·DB 운영자       | Agent owner, Security                   |
| hash/checkpoint와 legal hold         | 중앙 Audit owner             | Security, Privacy/Legal, Audit owner    |
| 개인 Mail/Calendar 연결 상태         | Productivity connector owner | Connector owner, Privacy/Legal          |
| UI·접근성·브라우저 증거              | Frontend owner               | Product owner, Accessibility reviewer   |
| SLO·경보·on-call                     | SRE/Operations               | Service owners, SRE                     |

활동 API와 metric에는 prompt·답변·원문·credential·tenant ID·user ID·event/run ID를 기록하지 않는다. `dwp.activity.read.duration`은 고정된 `operation`과 `result` 태그만 사용한다.

`dwp.activity.read.duration`의 metric 이름, 설명, 단위, owner, 보존 기간과 `operation`/`result` 허용값을 Product Telemetry Registry에 등록하고 Telemetry owner가 승인하기 전에는 운영 exporter의 scrape·remote-write·dashboard·alert 대상에 추가하지 않는다. 등록 허용값은 `operation=LIST|DETAIL|SUMMARY|EVIDENCE|AGENT_EVIDENCE|SOURCE_STATUS`, `result=SUCCESS|EMPTY|PARTIAL|STALE|UNAVAILABLE|RESTRICTED|PENDING|FAILED|FORBIDDEN|NOT_FOUND|INVALID|ERROR`로 고정하며 tenant·user·object·event·run·provider 식별자를 새 태그로 추가하지 않는다. 등록 전 로컬·테스트 MeterRegistry 검증은 가능하지만 product telemetry emit은 `BLOCKED_TELEMETRY_DIMENSION_REGISTRATION`이다. 서비스 설정 `dwp.platform.activity.metrics.enabled`의 기본값은 `false`이며, Registry 승인 증거와 change ticket이 모두 연결된 환경에서만 `true`로 전환한다.

## 1. 변경 전 소스·계약 게이트

모든 명령은 깨끗한 검증 checkout에서 실행한다. 공유 개발 워크트리의 미커밋 파일을 검증 증거로 사용하지 않는다.

### Frontend Activity 게이트

GitHub Actions의 `Activity behavior, resilience, accessibility, and native zoom gates`가 다음 스펙을 Chromium과 mobile 프로젝트에서 실행해야 한다.

```text
e2e/activity-foundation.spec.ts
e2e/activity-stitch-visual-quality.spec.ts
e2e/dwaion-activity-list-detail.spec.ts
e2e/activity-source-link.spec.ts
e2e/activity-personal-work-handoff.spec.ts
e2e/activity-work-handoff.spec.ts
e2e/work-activity-return-focus.spec.ts
```

Linux native zoom 단계는 격리된 persistent Chromium profile과 다음 test-only extension을 사용한다.

```text
docs/05-features/DWP-R1-WRK-001-unified-work-execution/implementation-evidence/
2026-09-07-resume/mobile-accessibility-final/qa-browser-zoom-extension
```

재현 명령:

```bash
E2E_BASE_URL=http://127.0.0.1:4200 \
E2E_BROWSER_ZOOM_EXTENSION="$PWD/docs/05-features/DWP-R1-WRK-001-unified-work-execution/implementation-evidence/2026-09-07-resume/mobile-accessibility-final/qa-browser-zoom-extension" \
corepack yarn playwright test e2e/activity-stitch-visual-quality.spec.ts \
  --project=chromium --workers=1 --grep "브라우저 실제 200% 확대"
```

통과 조건은 보고된 zoom `2`, CSS zoom `1`, 실제 CSS viewport 절반, 1280/640 물리 폭의 overflow·Axe·작업 제어 확인이다. 일반 root-font 200% 검사는 native browser zoom의 대체 증거가 아니다. Linux Chromium extension gate가 runner 변경으로 실행 불가능해지면 해당 gate를 skip하지 말고 실패시킨 후, 동일 커밋을 macOS 전용 `visual-baselines` runner에서 수동 승인 없이 재실행 가능한 job으로 이관해야 한다.

### Agent PostgreSQL 게이트

`Activity PostgreSQL integration (Python 3.13)` job은 `postgres:18.4-alpine` 격리 service에서 아래 파일을 실행한다.

```text
tests/test_activity_source.py
tests/test_run_activity_observability.py
tests/test_user_run_api.py
tests/test_conversation_lease_upgrade_postgres.py
```

통과 조건:

1. fresh Activity DB 이름은 `_integration`, `_test`, `_verify` 중 하나로 끝나고, legacy upgrade DB는 별도의 `_verify` DB다.
2. PostgreSQL server version이 18.4다.
3. JUnit의 skipped test가 0이다.
4. JUnit 이름이 `[postgres]`로 끝나는 `test_activity_source.py`의 parameterized case 4개가 모두 실행된다.
5. 이전/최신 attempt ACK 격리, V73→V79 사이 current projection ACK, V76/V79 중단 후 재시작, V33 legacy fixture→V72~V84 포함 latest upgrade case가 모두 실행된다.
6. migration, repeatable-read snapshot, cursor scope, lease fencing, tenant/user 격리가 모두 통과한다.

Agent schema history는 최소 V84까지 적용되어야 한다. V72/V73은 nullable/default·rolling-writer trigger와 새 audit table만 먼저 확장한다. 짧은 DDL에도 5초 `lock_timeout`을 적용해 lock queue가 writer를 장시간 막지 않게 한다. V76/V79는 5,000행 단위로 commit하는 재시작 가능한 online backfill이며 `CREATE OR REPLACE PROCEDURE`로 중간 종료 뒤 남은 procedure를 안전하게 대체한다. V77/V78/V83은 `NOT VALID → VALIDATE → 짧은 NOT NULL`, V75/V80/V84는 non-transactional `DROP/CREATE INDEX CONCURRENTLY` 순서다. 과거 `completed_at < created_at` clock-skew 행은 `GREATEST(COALESCE(completed_at, created_at), created_at)`로 보정하며, V73의 `ai_agent_run_audit_links`에는 각 `(run_id, lease_generation)`별 audit event가 하나씩 존재해야 한다. 배포 전 전용 upgrade DB에서 V71 상태의 역전 시각 fixture와 합성 대용량 fixture를 넣고 V72~V84 적용 중 concurrent writer의 최대 정지 시간을 기록한다. 롤링 배포 중 구버전 writer도 안전하도록 V72의 상태 전환 시각 trigger와 V73의 audit-link capture trigger를 제거하지 않으며, old-writer insert·terminal update fixture가 두 trigger를 실제 통과해야 한다. generation 전환 UPDATE에서는 V73 trigger가 OLD/NEW audit identity를 모두 기록해야 한다.

collector 재전송 검증은 다음을 모두 확인한다.

- collector 2xx 후 로컬 DB ACK 실패 시 spool 파일이 남는다.
- 동일 request의 다음 lease generation이 시작되어도 이전 event ACK가 성공한다.
- 이전 event ACK는 최신 `ai_agent_runs.audit_link_state`를 `LINKED`로 바꾸지 않는다.
- 최신 event ACK 후에만 최신 projection과 세대별 link 행이 함께 `LINKED`로 수렴한다.
- V73 설치 후 V79 backfill 전 현재 projection의 ACK는 exact link를 먼저 생성하고 `LINKED`로 수렴하며 legacy receipt를 만들지 않는다.
- exact link를 복원할 수 없는 pre-V73 event만 cutover 시각·schema version 경계 안에서 `ai_agent_run_audit_legacy_receipts`로 격리되고 spool head에서 제거된다. post-V73 schema event mismatch는 계속 실패해야 한다.
- ACK 실패 파일은 공정하게 tail로 회전해 뒤의 정상 event를 굶기지 않는다.

배포 창 시작 전과 종료 후 `DWP_AUDIT_SPOOL_DIR`의 JSON 수, 가장 오래된 파일 시각, `PENDING` link 수, legacy receipt 수를 기록한다. legacy receipt가 새로 생기면 즉시 Critical incident로 분류하고 원본 spool·collector receipt를 보존한다. spool이 감소하지 않거나 post-V73 mismatch가 한 건이라도 있으면 확대 배포를 중단하며, 파일을 수동 삭제해 통과 처리하지 않는다.

### Platform 게이트

검증 checkout에서 다음을 실행한다.

```bash
./gradlew --no-daemon :dwp-platform-server:test \
  --tests 'com.dwp.services.platform.activity.*'
./gradlew --no-daemon serviceBoundaryRatchetTest
git diff --check
```

`ActivityPostgresIntegrationTest`는 Docker/Testcontainers가 없어서 skip된 결과를 운영 승인 증거로 사용할 수 없다. Flyway는 V342까지 적용되어야 하며 `pg_extension`의 `pg_trgm` 행과 `pg_indexes`의 `indexname='idx_activity_search_text_trgm'` 행을 확인한다. Platform bootstrap owner는 `btree_gist 1.7`, `pgcrypto 1.3`, `pg_trgm 1.6`을 `public` schema에 사전 설치하고 Migration Control의 exact inventory가 세 확장과 owner를 검증해야 한다. 일반 migration principal에 database `CREATE`를 부여해 통과시키지 않는다. V342는 `executeInTransaction=false`, `spring.flyway.postgresql.transactional-lock=false`, 5초 `lock_timeout`, `DROP/CREATE INDEX CONCURRENTLY`로 실행한다. timeout은 `CREATE EXTENSION`보다 먼저 설정하고 성공 경로에서 `RESET lock_timeout`과 `RESET statement_timeout`을 실행한다. transactional advisory lock을 다시 활성화하면 Flyway 자체의 장기 transaction과 concurrent index build가 서로 대기하므로, Spring Boot·programmatic test configuration·실제 `dwp-migration-control` runner 모두에서 session advisory lock 정책을 확인한다. Activity·비-Activity 대표 full migration test와 NOCREATEDB migration principal의 predecessor→V342 test를 통과시키고, 같은 Flyway session의 뒤 migration이 기본 timeout `0`을 관측하는지 검증한다. 실패 후 재시도 전 `pg_index.indisvalid=false`인 동명 index가 제거되는지 확인하며, 평문 `CREATE INDEX`로 되돌리지 않는다.

## 2. 용량·검색·SLO 검증

다음 수치는 **초기 제안 SLO**이며 SRE와 Product owner 승인 전에는 계약 SLO가 아니다.

| 신호                           | 제안 목표     | 경고                         | 중단/rollback 검토    |
| ------------------------------ | ------------- | ---------------------------- | --------------------- |
| `LIST` 서버 p95                | 750 ms 이하   | 15분간 750 ms 초과           | 15분간 1.5 s 초과     |
| `SUMMARY` 서버 p95             | 500 ms 이하   | 15분간 500 ms 초과           | 15분간 1 s 초과       |
| `EVIDENCE`/`SOURCE_STATUS` p95 | 500 ms 이하   | 15분간 500 ms 초과           | 15분간 1 s 초과       |
| `result=ERROR` 비율            | 5분간 1% 미만 | 1% 이상                      | 5% 이상               |
| `result=STALE                  | UNAVAILABLE`  | 승인된 connector 기준선 이하 | 10분 연속 기준선 초과 | tenant canary의 모든 원천이 5분 이상 unavailable |
| 첫 유용한 Activity 내용 p75    | 2.5 s 이하    | 2.5 s 초과                   | 4 s 초과              |

SRE는 배포 전 아래 PromQL을 staging dashboard에 저장하고, 실제 scrape 이름이 Micrometer 기본 변환인 `dwp_activity_read_duration_seconds_*`와 일치하는지 먼저 확인한다. 결과가 없는 쿼리를 0으로 간주하지 않는다.

```promql
histogram_quantile(
  0.95,
  sum by (le, operation) (
    rate(dwp_activity_read_duration_seconds_bucket{operation=~"LIST|DETAIL|SUMMARY|EVIDENCE|AGENT_EVIDENCE|SOURCE_STATUS"}[5m])
  )
)

sum(rate(dwp_activity_read_duration_seconds_count{result="ERROR"}[5m]))
/
clamp_min(sum(rate(dwp_activity_read_duration_seconds_count[5m])), 1)

sum by (operation, result) (
  increase(dwp_activity_read_duration_seconds_count{result=~"PARTIAL|STALE|UNAVAILABLE"}[10m])
)
```

경보 규칙 변경은 SRE review와 두 번째 승인자를 거친다. 이 문서의 임계치를 곧바로 운영 alert manager에 쓰지 않는다. 최초 14일 canary 기준선을 수집한 후 Product owner와 SRE가 임계치 또는 예외 tenant/provider 목록을 서명한다.

용량 검증은 운영 snapshot을 복사하지 않고 합성 데이터로 수행한다. 최소 profile은 사용자당 100,000 events, tenant당 1,000,000 events, Agent run 100,000개다. 검색·cursor·summary 각각에 대해 `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`을 저장하고 다음을 확인한다.

- substring 검색이 `idx_activity_search_text_trgm`을 사용할 수 있다.
- Agent substring 검색이 `idx_ai_agent_runs_activity_search_trgm`을 사용할 수 있다.
- 1~2자 검색은 UI와 두 서버에서 조회 전에 거절되고, 3자 검색부터 실행된다. 1/2/3자 각각의 plan과 반환 코드를 증거에 남긴다.
- owner cursor가 `idx_activity_verified_cursor`를 사용한다.
- 50건 페이지가 전체 정렬이나 disk spill을 유발하지 않는다.
- summary의 현재 상태 판정이 과거 execution version을 중복 집계하지 않는다.
- 테스트 로그에 title, summary, object label의 실제 사용자 문자열을 남기지 않는다.

## 3. 보존·legal hold·archive 승인

`wrk_activity_events`의 LIVE 행은 append-only trigger로 update/delete가 거절된다. 이 불변성을 우회하거나 trigger를 비활성화하지 않는다. 운영 전 다음 정책 문서를 Audit owner와 Privacy/Legal이 승인해야 한다.

1. object type·provenance별 보존 기간과 법적 근거
2. legal hold의 적용·해제 주체, 이중 승인, 감사 receipt
3. 원본 업무가 삭제되었을 때 Activity 최소 사실과 source route의 처리
4. Agent run, stage, source health, 중앙 audit receipt의 상호 보존 순서
5. archive 암호화·지역·키 관리·접근권한·복원 RTO/RPO
6. data-subject 요청과 감사 불변성의 충돌 처리

승인 전에는 자동 purge를 배치하지 않는다. 승인 후 구현은 날짜 partition 또는 별도 archive projection을 사용하되, 중앙 audit chain과 legal hold 대상은 누락하지 않아야 한다.

실행 ticket은 `policy_version`, `cutoff_at`, `hold_snapshot_id`, `candidate_count`, `archive_object_id`, `archive_checksum`, `approver_1`, `approver_2`, `started_at`, `completed_at`을 필수로 가진다. 현재 저장소에는 Activity legal-hold 판정과 archive executor가 없으므로 실제 후보 산출·이관·purge 단계는 `BLOCKED_LEGAL_HOLD_MODEL_AND_ARCHIVE_IMPLEMENTATION`이다. 승인 전 임시 SQL로 보존 대상 행을 삭제하거나 `wrk_activity_events`의 append-only trigger를 끄지 않는다.

구현 승인 후에도 순서는 다음과 같이 고정한다.

1. Privacy/Legal이 서명한 policy version과 cutoff를 ticket에 고정한다.
2. Audit owner가 같은 snapshot에서 hold 포함/제외 판정과 candidate count를 서명한다.
3. Archive executor가 암호화된 격리 대상에 쓰고 object ID·행 수·checksum을 반환한다.
4. 별도 verifier가 원본과 archive의 count/checksum/audit 연결을 대조한다.
5. 이중 승인 후에만 보존 executor를 dry-run에서 execute로 전환한다.
6. 사후 count/checksum과 중앙 audit receipt가 일치하지 않으면 추가 실행을 중단한다.
7. archive에서 표본 exact-detail/ACL 검증이 끝날 때까지 원본 purge 완료로 판정하지 않는다.

### 월별 성장 점검

DB 운영자는 read-only 세션에서 table/index 크기, 월별 event 수, 사용자별 p95 event 수, dead tuple과 index hit ratio를 수집한다. 기준선 대비 월 성장률 25% 초과 또는 90일 내 승인 용량의 80% 도달 예측 시 경고를 생성한다. tenant/user/object 식별자는 보고서에서 집계·가명화한다.

승인된 read replica에서 다음 쿼리를 실행하고 결과 JSON/CSV에는 집계값만 남긴다.

```sql
BEGIN READ ONLY;

SELECT pg_relation_size('wrk_activity_events') AS table_bytes,
       pg_indexes_size('wrk_activity_events') AS index_bytes,
       pg_total_relation_size('wrk_activity_events') AS total_bytes;

WITH monthly AS (
  SELECT date_trunc('month', occurred_at) AS month_start, count(*)::numeric AS events
  FROM wrk_activity_events
  WHERE occurred_at >= date_trunc('month', now()) - interval '13 months'
  GROUP BY 1
), growth AS (
  SELECT month_start, events, lag(events) OVER (ORDER BY month_start) AS previous_events
  FROM monthly
)
SELECT month_start, events,
       round(100 * (events - previous_events) / nullif(previous_events, 0), 2) AS growth_percent
FROM growth
ORDER BY month_start;

SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY owner_events) AS owner_event_count_p95
FROM (
  SELECT tenant_id, visible_to_user_id, count(*) AS owner_events
  FROM wrk_activity_events
  GROUP BY tenant_id, visible_to_user_id
) owner_counts;

SELECT relname, n_live_tup, n_dead_tup,
       round(100 * idx_scan / nullif(seq_scan + idx_scan, 0), 2) AS index_scan_percent
FROM pg_stat_user_tables
WHERE relname = 'wrk_activity_events';

COMMIT;
```

월 성장률이 25%를 넘으면 `ACTIVITY_GROWTH_RATE_HIGH`, SRE가 승인한 90일 용량 예측치가 승인 용량의 80%를 넘으면 `ACTIVITY_CAPACITY_90D_HIGH` ticket을 생성한다. 승인 용량과 예측 모델이 아직 없으면 후자를 임의 숫자로 대체하지 않고 `BLOCKED_SRE_CAPACITY_BASELINE`로 기록한다.

## 4. 격리 복원 훈련

복원 훈련은 운영 원본이 아닌 신규 격리 DB에서만 수행한다.

1. Backup owner가 승인된 암호화 backup ID와 checksum을 제공한다.
2. 격리 network·격리 credential로 빈 DB를 만든다.
3. checksum을 검증한 후 backup tooling으로 복원한다.
4. Flyway `info`로 schema version과 checksum drift 0을 확인한다.
5. Activity owner가 사건 수·월별 수·provenance 수와 audit FK orphan 0을 확인한다.
6. Activity PostgreSQL 통합 테스트와 exact detail/ACL 음성 테스트를 실행한다.
7. 임의의 기존 cursor는 복원 시점·secret rotation 경계를 넘지 못하는지 확인한다.
8. RTO/RPO, 누락 행, 무결성 checkpoint 상태를 기록한다.
9. 증거 승인 후 격리 DB와 임시 credential의 폐기를 Backup owner가 수행하고 receipt를 남긴다.

실 운영 restore, backup 폐기, key rotation은 별도 change ticket과 이중 승인 없이는 수행하지 않는다.

## 5. 실제 tenant·provider canary

Canary는 Product owner, tenant data owner, Security, Privacy/Legal, connector owner가 승인한 비운영 사용자 또는 명시적 canary 사용자만 사용한다. 일반 직원 계정을 임의로 선택하지 않는다.

실행 순서:

1. 승인된 tenant/user, 허용 resource, 관측 기간, 중단 시간을 ticket에 고정한다.
2. Activity/Ask와 필요한 Mail/Calendar 원본 VIEW 권한만 부여하고 관리자 감사 권한은 별도 승인 없이는 부여하지 않는다.
3. provider credential과 token이 log·screenshot·Playwright artifact에 남지 않는지 사전 검사한다.
4. Gateway UI에서 홈→타임라인→exact detail→원본 열기를 확인한다.
5. connector owner가 한 번의 실제 sync 관측을 만들고 `lastAttemptAt`, `lastSuccessAt`, `observedAt` 의미를 대조한다.
6. 한 원천을 승인된 방법으로 일시 중단해 성공 원천 유지, partial/stale 표시, 합계 오인 방지를 확인한다.
7. 원본 VIEW 권한을 철회하고 목록·상세·원본 열기가 fail-closed되는지 확인한다.
8. canary 종료 후 임시 권한·credential을 회수하고 audit receipt를 보존한다.

실제 메일·일정 본문, prompt, 답변, credential을 증거에 첨부하지 않는다. Provider 호출 비용·rate limit·데이터 지역이 승인되지 않았으면 이 절은 `BLOCKED_EXTERNAL_APPROVAL`로 남긴다.

## 6. 배포·관측·rollback 판정

배포 전 evidence bundle에는 commit SHA, 세 저장소 lockfile/checksum, OpenAPI drift 0, Frontend Activity 보고서, Agent PostgreSQL JUnit, Platform Activity Testcontainers 결과, 용량 EXPLAIN, 복원 훈련 receipt, canary 승인서를 포함한다.

점진 배포 중 다음 조건이면 확대를 중단한다.

- 권한 밖 event/run 노출 또는 잘못된 exact ID 대체 1건
- 정상 0으로 오인되는 source failure 1건
- audit integrity를 `VERIFIED`로 과장한 표시 1건
- 제안 중단 임계치를 넘는 latency/error
- 사용자 데이터 또는 credential이 log/artifact에 포함됨

Rollback은 UI/서비스 버전과 feature flag만 승인된 절차로 되돌린다. 이미 기록된 append-only Activity/audit 행을 rollback 명목으로 삭제하지 않는다.

## 7. 미완료 외부 승인 체크리스트

- [ ] Product owner가 Activity 사용자 성과 기준값과 SLO를 승인했다.
- [ ] Telemetry owner가 Activity metric과 bounded dimension 허용값을 Product Telemetry Registry에 등록했다.
- [ ] SRE가 등록 완료 후 metric 수집, dashboard, alert route, on-call을 승인했다.
- [ ] Privacy/Legal과 Audit owner가 보존·legal hold·archive 정책을 승인했다.
- [ ] Backup owner가 격리 restore drill과 RTO/RPO를 승인했다.
- [ ] Tenant data owner와 connector owner가 실제 provider canary를 승인했다.
- [ ] Security가 canary 권한·증거 redaction·credential 회수를 승인했다.
- [ ] Release manager가 evidence bundle과 점진 배포·rollback 창을 승인했다.

모든 항목과 실제 CI evidence가 완료되기 전 상태는 `IMPLEMENTATION_READY / CI_EVIDENCE_AND_PRODUCTION_APPROVAL_PENDING`이다.
