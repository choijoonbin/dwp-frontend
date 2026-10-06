# Control metadata 실제 consumer — 작성자 후속 증적

판정: bounded native consumer 검증 완료. 독립 승인·G3 승인 아님. 원본 generic20과 BEFORE 증적은 보존했다.

## 실제 결과

| 엔진 | native UTC | 소요 | fresh XML |
| --- | --- | --- | --- |
| PostgreSQL 16 | 2026-09-14T11:17:07.030466+00:00 → 2026-09-14T11:18:39.458680+00:00 | 92.431907초 | 14 PASS / failure·error·skip 0 |
| PostgreSQL 18.4 | 2026-09-14T11:19:12.677485+00:00 → 2026-09-14T11:21:25.131355+00:00 | 132.460585초 | 14 PASS / failure·error·skip 0 |

동일한 exact 14개 시나리오, 두 엔진 실행 28건이다. source379 SHA·decimal ns가 각 실행 전후와 두 실행 사이에 같았다. critical4 source pin도 같았다. 각 실행의 실제 argv·UTC·Popen PID/PGID·180초 상한·fresh XML·완전 cases·stdout/stderr·소스 manifest/UTF8 snapshot을 JSON에 담았다.

PG16 host 해제 2026-09-14T11:18:50.213Z, PG18 해제 2026-09-14T11:21:35.545Z. 각 owned PG/Ryuk은 자동 ABSENT, manual stop 0, own processgroup 없음 확인 후 잠금을 해제했다. 다른 컨테이너 종료 0.

## 실패와 수정 경계

최초 readOnly=false 반례 및 동일 기대 repeat, 180초 combined34 timeout, 첫 full14의 12 PASS·2 FAIL은 별도 BEFORE JSON/MD에 보존했다. 첫 기록기 TypeError 때문에 최초 full stdout/source manifest를 회수하지 못한 한계와 timeout fresh XML 0/stale 제외를 그대로 유지한다.

생산 최소 변경은 등록 metadata principal의 원래 PostgreSQL JDBC 로그인 factory에만 readOnly=true 속성을 공급한 2524fdf3…→4af8b071…이다. runtime factory는 default false를 유지했다. frozen Inspector가 readOnly를 제조하거나 SET ROLE/owner fallback을 추가하지 않았다.

이번 후속에서는 새 test만 bc86b29b…→ee864af8…로 정정했다. primary label의 실제 IllegalStateException 거부와 catalogMutation의 최종 serving restore 거부→FAILED/noForeignSessions를 요구한다. proof.empty, ACTIVE 복구, 원래 JDBC 상태 복구 assertion은 유지했다. core·bridge·기존20 기대값 변경 0이다. 최종 serving 복구 실패를 성공이라고 부르지 않는다.

## 실제 검증한 경계

TEST_ONLY baseline 목적 풀을 frozen Inspector가 정상 승인한 뒤 실제 bridge 공급 풀을 동일 consumer에 연결했다. 원래 JDBC metadata login/current=session, readOnly·autoCommit 입구, native pg_catalog search_path, bounded RR/network timeout 및 원래 상태 복구, exact DS/qualifier, history row read 금지와 사전 고정된 compiler/history policy/surface를 검증했다. foreign CONNECT, column/routine/PUBLIC/default ACL/grant option/sequence/history/catalog 권한 음성, membership-before-open, wrong DS zero-open, disabled zero-secret/zero-open, runtime posture 비일반화를 같은 14개에 포함했다.

독립 TEST_ONLY fixture 기대값은 production 승인 입력이 아니다. 단독 NativeObservation은 live lease/current issuer 서명을 대체하지 않는다.

## 정적 검사 및 남은 OPEN

실제 source-size 1677 production files, test-size 832 Java tests/정확 legacy exceptions7, unused private, dependency cycles12 legacy/신규0 모두 exit0였다. 별도 repository scan 결과이며 whole-backend SHA/native 준비 증거가 아니다.

auth metadata 한 슬롯 범위다. 네 source signed publication/current vector, Main hook, 실제 credential generation port, transport/producer, Spring pool 등록, 앱8 migration DS 제거/runtime-only wiring, future13 stream 활성은 OPEN이다. 기존 generic20은 이 후속에서 current rerun하지 않았으며 역사 PASS를 합산하여 current34나 whole-G3 PASS로 주장하지 않는다. Root 독립 재검토가 필요하다.

