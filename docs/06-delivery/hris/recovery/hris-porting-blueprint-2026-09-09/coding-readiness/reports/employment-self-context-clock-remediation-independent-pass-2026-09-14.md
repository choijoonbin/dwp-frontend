# 고용 SelfContext 실시간 시계 보완 독립 정상 재실행

상태: **제한된 보완 검증 PASS / G3 CLOSED / 공통 전체 준비 OPEN**.

root가 실제 진행 시계 오류를 보완하고 기존 만료 fixture를 owner callback 단계에 맞춰 수정한 뒤, 별도 작성자인 제가 같은 165개 범위를 실제 재실행했습니다. 최초 양성 실패와 후속 기존 fixture 4건 실패는 이전 동명 계열 보고서에 보존합니다.

UTC 2026-09-14T05:06:28.595358+00:00 → 2026-09-14T05:06:47.374259+00:00, 18.778528초, exit0. 10 XML / 165 고유 case / 0 failures / 0 errors / 0 skips.

- neutral 기존 identity59 + 진행 시계 정상 회귀1 + generated/platform22.
- 기존 Auth/People reader79: 격리 실제 PostgreSQL35 + JDBC 단위44. 실제 native migration은 Auth114/latest212 및 People49이며 역사 SQL 변경 없이 수행했습니다.
- People/Payroll consumer4.
- 선택한 4 test task에만 `--rerun`을 적용했습니다. 모든 task는 실제 실행됐으며 test UP-TO-DATE 0입니다. compiler/Control 전체 강제 재빌드는 하지 않았습니다.
- 195 관련 source SHA-256/decimal-string mtime ns 실행 전후 동일. 정확 dirty snapshot/HEAD/tree/argv/실패0 XML SHA/ns/모든 case ID는 JSON에 보존합니다. 신설 SelfPerson 파일은 컴파일 경로에만 존재하며 해당 사례 실행은 **0건**입니다.
- 중간 exit0 실행은 Auth/Payroll UP-TO-DATE였으므로 165건 신선 실행으로 주장하지 않았습니다. 최종 재실행에서는 XML timestamps가 모두 이번 UTC 실행 구간 안에 있음을 확인했습니다.

보완은 query.asOf 초기 고정, 단계별 현재 시계 재취득·역행 거부·current authority/Auth 만료 재확인, owner lookup의 해당 단계 capturedNow 전달입니다. 본문 ID/UUID 우연 동일/primary assignment/이메일·이름 fallback은 허용하지 않습니다.

권한/일부 owner composition은 **explicit mock**입니다. native SQL 성공은 signed current proof, Auth→Gateway end-to-end, 실제 current PEP, lifecycle/relink/revoke fence, production 배선, 전체 백엔드 check 또는 전체 HRIS 준비완료를 의미하지 않습니다. 사용자 주 DB·서버·기존 SQL·guard 정책을 변경하지 않았고, lock은 해제했습니다.
