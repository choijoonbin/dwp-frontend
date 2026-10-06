# People 고용주 공통49 준비 변경 검토

검토: root, 2026-09-14 13:34 KST. 상태: `TARGETED_COMMON_PREPARATION_CHANGE_ACCEPTED / G3_CLOSED`.

Harvey 작성 공통 allocation successor의 People49 예약 항목과 checker300행·테스트145행을 직접 검토했다. 기존 People V1 정의에는 고용주 public UUID가 없고 V41은 worker/relationship/assignment만 보완한다. 현재 integration의 실제 파일 inventory는 V1..48이며49 파일·version 충돌이 없다. 제안의 HRM50..72 범위는 공통49를 제외한다. 기존 G2 예약과 SQL은 수정하지 않았다.

독립 실행 결과: `test_common_allocation_successor.py` 18개 통과, 실패·오류·건너뜀0. 정상 checker는 pinned Git db0에서521개 SQL, 역사503개 불변, 추가18개, 공통6/모듈105개 예약 및 충돌 검사를 통과했다. 이 검사는 Git-only 구조 검증이며 전체 업무 의미·native replay·정본 게시를 승인하지 않는다. 정상 결과도 `readinessPass=false/g3Authorization=NONE`이다.

승인 범위는 정확히 `dwp-people-server/src/main/resources/db/migration/V49__add_native_legal_employer_public_id.sql`의 신규 CREATE-only 공통 준비 변경이다. People 기존 소유 테이블에 `public_id UUID NOT NULL DEFAULT pg_catalog.gen_random_uuid()`와 단독·tenant-bound uniqueness를 추가한다. 내부 PK, 회사별 business key, 수명주기, 기존 FK는 유지한다. 신원 원장 신설·권한 부여·테넌트 활성화·HRM 업무 테이블 생성은 포함하지 않는다. 실제48→49 검증은 Mendel의 `NativeSelfContextQueryReaderV1PostgresTest`에서 수행한다. 예약안의 dedicated testPath는 작성자가 제시한 아직 미구현 경로이므로 게시 시 실제 검증 경로로 연결해야 한다.

검토 입력 SHA256:

- allocation JSON: `e1183748493f6f48c1e89863fc6a9103fa2408ff5907e7b853391352052e7a6e`
- allocation MD: `6279ae1b9194394bc769875e7e6e84f3691aac132379ca44055e1a8d2dcf72a2`
- checker: `4490154ca9a9b271904ad8050826146a94021d399cec4e9eeb3df52baa44d0d3`
- tests: `96607d3880fa7623ef4e000fce1edd513bc5a14e4e9d6d12efb6bf4b17fe14ed`
- 실제 신규49 SQL: `9fe9f4b2f540b94a38525544e40989452410a860dca3fdc521a0ee07c542ada3`

신규 파일은 아직 integration working tree 변경이다. commit·5 paired 작업환경 배포·current source/native seal 재고정·정본 successor 게시·전체 G0/G3 독립 검증은 완료되지 않았다. db0의521개 Git 증거를 working-tree49의 native 증거로 혼용하지 않는다. 5개 모듈 `NO_G3_START`는 유지한다.
