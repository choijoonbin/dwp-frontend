# Identity owner ABI.v1 집중 검증

상태: AUTHOR_SCAFFOLD_VERIFIED / G3_CLOSED / COMMON_P0_OPEN. 기존 DWP 신원 권위를 재사용하는 미배선 Java ABI·guard 검증이며 native 배선 또는 전체 개발 준비 승인 아니다.

최종 고정 소스 실행: 85건, 실패·오류·skip 0. 새 identity 59건(typed 거절 42, UUID record 일관성 6, 발급 시각 3, 정상·구성 경계 8), 기존 공통 계약 22건, People/Payroll 실제 mock projection·adapter 누락 4건이다. 2026-09-14 03:19:31.798771–03:19:49.699015 UTC, Gradle exit 0, 17.900초. host semaphore 즉시 획득·정상 해제, --no-daemon/--max-workers=1, owner test process timeout 600초. PG·외부 endpoint·사용자 server를 실행하거나 변경하지 않았다.

세 test task 모두 --rerun으로 실제 실행했다. 최종 neutral main/test 컴파일은 실행되었고 두 consumer 컴파일은 바로 앞 동일 consumer 소스 실행에서 실제 수행되어 최종에는 up-to-date다. 기존 static 검증 5개 모두 PASS. 14 Java+2 ABI 문서 hash를 실행 전후 비교해 동일, 수정 시각은 실행 시작 전이며 BE HEAD/tree db0d2b5067e6fbee27ee58121c5a4406cab132b9 / 20f345a640b1d8238b9a2e709a060cc51df9b729 유지다. BE는 의도한 신규 untracked 경로만 있고 tracked 변경은 없다. FE aaeba79eefae7cc2d1ba6151f47fa9e891a75bfd 그대로 clean. commit/전파는 root 독립 검토 전 보류한다.

공개 owner-return DTO는 미검증 carrier이며 private lookup/verified 선택 결과만 guard가 생성한다. Auth의 principal→person과 People의 실제 person→worker→relationship→assignment를 재사용한다. 별도 신원 원장·DDL·binding counter·shadow 권한 체계를 만들지 않았다. 여러 native context를 첫 행으로 선택하지 않으며 explicit UUID 3종 tuple을 요구한다. foreign tenant/person/parent, revoked·expired·version mismatch·current APP entitlement 없음·SoD, missing adapter 호출0 등을 실제 typed DTO·Clock·expected code·호출 수로 검증했다. 같은 UUID의 부모·버전·상태·날짜·zone 모순과 발급 중 lease 만료·역행도 차단했다. Java civil-date 범위 및 native zone 변환 오류도 typed 거절이다.

기존 com_users.version은 JPA person 연결의 보수적 stamp이며 access_revision은 별도 검사한다. 계정 activation native SQL(200–202행)이 status를 바꾸면서 두 revision을 증가시키지 않는 현행 예외가 있어 전체 lifecycle revision이나 signed freshness로 간주하지 않는다. 현재 owner status publication·native producer 일관성·revoke·ordering은 OPEN이다. former-person 과거 PAY 접근은 목적별 person/worker/assignment 상태 정책으로 표현했고 실제 운영 정책·배선은 구현하지 않았다.

People/Payroll consumer는 raw owner DTO들을 guard에 연결하여 SELECTED의 person/worker/relationship/assignment UUID·각버전·Auth stamps·PROFILE/PAY 목적을 실제 projection으로 소비해 assert한다. adapter 누락이면 모든 호출0 typed 거절이다. 이는 mock consumer 실행이며 실제 Auth endpoint/People DB producer/HTTP/Gateway PEP 실행이 아니다. root가 얕다고 지적한 초기 null-return witness가 포함된 81건 실행은 JSON의 prior81CaseRun에 역사 SHA·XML·argv로 별도 보존했고 최종 증거로 사용하지 않는다.

exact 파일 hash·실제 argv·85 case ID·42 reject code/호출 수·owner source SHA·남은 공통 P0는 [증거 JSON](identity-owner-abi-focused-2026-09-14.v1.json)에 있다. 최종 ABI JSON SHA cb05e3f1a00e90574c97118a7508fc6e325b50f3bfd89809c2ac45a621b2d9d6. 실제 owner endpoints/native complete producer/현재 proof wire·서명·freshness·revoke/route PEP/lifecycle·relink/13stream startup 배선과 전체 current 검증은 OPEN이며 모듈 Gate를 열지 않는다.
