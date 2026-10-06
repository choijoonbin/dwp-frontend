# Common migration baseline 및 successor 예약 제안

상태: `DESIGN_PROPOSED_NOT_CANONICAL / G3_AUTHORIZATION_NONE`. 기존 예약·validator·SQL·historical G2를 수정하지 않습니다. Git-only 사실과 새 예약 설계의 승인을 구분합니다.

## 고정한 커밋과 SQL 계보

- Historical: `6f1ed92d2610ace3df75f094297032e8b476ef5d`, tree `fab2e1441d2ab224ae93b14978c282eff93973be`.
- Current committed: `70c996fdafc011392056a1909a2e5222b240ded3`, tree `ad226258485214e52a552e08594668c3593c320b` (e562d9b 뒤 Approval 테스트 커밋).
- ancestry PASS. 전체 db SQL503 historical blob은 mode/OID/bytes가 동일하며 신규18개만 추가됐습니다. Current521개: 실제 stream/core resource516개 + local fixture5개.
- 각 파일의 실제 Git blob OID·SHA-256·version·크기·historical 동일성은 [typed inventory](common-migration-baseline.proposal.v1.json)에 전수 기록했습니다. 작업 중 SQL을 읽거나 commit하지 않았습니다.

| Stream | Historical files/high-water | Current files/high-water | 범위 |
| --- | --- | --- | --- |
| Auth public | 112 / 210 | 114 / 212 | Control |
| People public | 46 / 46 | 48 / 48 | Control |
| People performance | 0 / 0 | 0 / 0 | Control, hris_performance 별도 history |
| Platform public | 196 / 230 | 203 / 237 | Control |
| Approval public | 14 / 14 | 16 / 16 | Control |
| Notification public | 26 / 26 | 29 / 30 | Control |
| Provider public | 55 / 55 | 57 / 57 | Control |
| Time public | 0 / 0 | 0 / 0 | Control |
| Payroll public | 0 / 0 | 0 / 0 | Control |
| Meeting public | 27 / 41 | 27 / 41 | 보호 범위, Control 외 |
| Space public | 6 / 6 | 6 / 6 | 보호 범위, Control 외 |
| Messaging public | 15 / 16 | 15 / 16 | 보호 범위, Control 외 |

Auth의 V89_1/89_2/89_3은 각각89.1/89.2/89.3입니다. 파일 수와 high-water는 같은 숫자가 아닙니다. Notification은 pinned historical V1–26, current V1–26+V28/29/30이며 V27은 두 tree에 없습니다. 숫자 빈칸 자체는 결함이 아닙니다. 실제 applied history/필수 정책이27을 참조할 때만 missing-source 여부를 판단합니다. 미확인 WIP 기원은 추정하지 않습니다.

dwp-core repeatable1개와 local-seed5개는 독립적으로 분류했습니다. Time/PAY/PER stream의 committed numbered SQL0개는 live DB history0개 또는 classpath repeatable 부재의 증명이 아닙니다. 정확한 staged resource/실행 classpath와 실제 DB 영수증은 별도로 검증해야 합니다.

## 예약 successor DESIGN

| Owner/stream | 역사적 G3 예약 | 제안 예약 | Capacity / 현재 slice demand / spare |
| --- | --- | --- | --- |
| HRM/People public | 47–69 | 49–71 | 23 / 21 / 2 |
| PER/performance | 1–63 | 1–63 | 63 / 22 / 41 |
| SYS/Auth public | 211–239 | 213–241 | 29 / 1 / 28 |
| SYS/Platform public | 231–259 | 238–266 | 29 / 15 / 14 |
| TIM/Time | 1–39 | 1–39 | 39 / 20 / 19 |
| PAY/Payroll | 1–49 | 1–49 | 49 / 21 / 28 |

현재100 active slice의 등록된 schema-touch demand에만 distinct slot을 배정했습니다. 정확한 slice→version→SQL filename, old planned path, 미사용 spare는 JSON에 있습니다. 이미 materialize된 SQL을 재번호한 것이 아닙니다. 기존 명명된 HRM 현대파일64–69는 제안66–71, Platform257–259는264–266; 아직 filename 미정인 base slice는 정렬한 명시 슬롯 제안입니다.

현재 demand의 구조적 용량은 맞지만, 새 HRM/PER/SYS/TIM 의미 재설계의 전체 SQL grouping/정정·신규 공통 bootstrap 용량은 **UNREVIEWED**입니다. operation 수를 migration 수로 간주하거나100/56 고정 숫자에 맞추지 않습니다. 필요하면 범위를 재검토합니다.

HRM70/71은 과거 `PER People70–89` 역사적 예약과 숫자가 겹칩니다. PER의 그 예약은 이미 `SUPERSEDED_G2_ENTRY_ALLOCATION/HISTORICAL_G2_ONLY`이며 active PER는 별도 performance1–63입니다. 역사적 행은 삭제하지 않고 명시 predecessor/supersession을 보존해야 합니다. 실제 SQL/version 충돌은 없습니다.

Approval17+, Notification31+, Provider58+는 Control on-demand 하한일 뿐 module CREATE 허가가 아닙니다. Meeting41/Space6/Messaging16 high-water는 보호 inventory이며 HRIS writer를 부여하지 않습니다.

## SYS bootstrap의 남은 P0

정본01:73과03:59는 configuration과 insights의 분리, 전용 `hris_insights` schema/NOBYPASSRLS app role, repository import/cross-schema FK 금지를 요구합니다. 그런데 pinned ControlPlan의 Platform은 `platform-main/public/flyway_schema_history` 한 stream뿐입니다. 현재 SYS configuration/listening/analytics/AI 계획도 public version allocation에 함께 묶여 있습니다.

public 예약 숫자를238–266으로 미는 것만으로 insights 배포가 가능해지지 않습니다. 반드시 다음 사항을 먼저 검토·게시해야 합니다.

1. context→schema→runtime/ingestion/analysis/issuer 역할→owner migration→history/stream/route matrix. 기존 configuration/public baseline은 역사 그대로 두고, insights 별도 stream 또는 정당화된 multi-schema 단일 history 전략을 명시합니다. 공개 범위가 protected 데이터 권한으로 확대돼서는 안 됩니다.
2. missing/wrong-owner schema fail-closed 및 Control 선프로비저닝, no schema/role CREATE/BYPASSRLS app, exact native/adopted seal와 resource stage. 새 history의 receipt key를 다른 stream과 혼용하지 않습니다.
3. 익명 identity issuer는 응답/token/receipt schema에 접근하지 않고 analysis는 cohort owner port만 접근합니다. configuration과 insights 사이 versioned application port/event 외 repository/FK 결합을 금지합니다.
4. 이 scaffold는 Control common successor로 승인/commit하고 diverged worktree에 exact CONTROL_BASELINE_SYNC/artifact dependency로 공급합니다. module 첫 예약 버전을 묵시 소비하지 않습니다.
5. common bootstrap이 추가 SQL을 소비하면 그 **실제 커밋 high-water 뒤**에 allocation을 다시 계산합니다. 별도 insights stream이면 자체 dir/history/version1..N 예약도 새로 검토합니다. 본 public range 제안은 insights schema writer 승인이 아닙니다.

## 게시·실행 순서와 검증

Committed common inventory → SYS/bootstrap+remediation 용량 review → common scaffold commit → successor allocation과 slice filename/owner CREATE-only checkpoint/generator/validator/세션 지시서 공동 갱신 → module exact new blob CREATE → Control 동일 blob 통합+global replay/DBA/RLS/ACL/receipt 수용 → 독립 semantic/static/runtime/capacity proof → authoritative live/published Gate.

기존 SQL 수정·삭제·재번호·checksum/installed_by 변조, historical count weakening은 금지입니다. historical G2 baseline과 current G0 successor 검증은 분리합니다.

재현 명령(정본 위치 coding-readiness 기준):

```sh
python3 semantic-remediation/validate_common_migration_baseline_proposal.py --self-test
python3 semantic-remediation/validate_common_migration_baseline_proposal.py --current 70c996fdafc011392056a1909a2e5222b240ded3
python3 semantic-remediation/validate_common_migration_baseline_proposal.py --proposal semantic-remediation/common-migration-baseline.proposal.v1.json
```

12 self-tests는 multipart/alias version·삭제/수정/mode·committed collision·duplicate slot·잘못된 stream filename을 검증합니다. Git oracle와 전수 manifest/슬롯 구조 비교는 별도 실행합니다. 이것은 설계 작성자 자체 도구의 구조 검증이며 SQL 업무 의미·새 capacity·DB replay·독립 설계승인·G3 PASS가 아닙니다.

스프레드시트 지침에 따라 기존23 allocation행과100 slice demand 및 source digest를 보존·역추적했습니다. 원본 CSV는 편집/재저장하지 않았고 JSON/MD proposal 및 격리 read-only verifier만 만들었습니다.

