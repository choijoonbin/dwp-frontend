# DWAI·ON Stitch 재검증 원장 — 2026-09-09

## 완료 보고 철회

기존의 `35개 프레임 구현 완료`, `280/280`, `36/36 메뉴 완료` 표기는 Stitch 원본과
현재 렌더의 화면별 직접 비교를 증명하지 못했다. 해당 완료 판정은 철회한다.

Stitch 프로젝트 `13391261371843159731`의 로컬 정본 21개 상태를 현재 제품과 다시 대조한
엄격 판정은 **시각 PASS 0 / PARTIAL 21 / FAIL 0**이다. 따라서 어떤 메뉴도 현재
`Stitch 구현 완료`로 표시하지 않는다.

## 판정 기준

- 시각 PASS: 화면 계층, 정보 밀도, 열/카드 구성, 주요 정보와 반응형 구조가 정본과
  실질적으로 같고 직접 비교 증거가 있다.
- 기능 PASS: 대표 동작과 실패·빈 상태·revision·멱등 경계를 실제 UI/API로 검증했다.
- 권한 PASS_TESTED: 현재 코드의 route/context/scope/revision 거부 경로가 통과했다.
- production PASS: 실제 운영 provider·connector·scheduler·worker·rollout 관측 증거가 있다.
- 어느 축이든 PARTIAL 또는 미검증이면 전체 완료가 아니다.

## 21개 현재 판정

| ID  | 경로/작업면                      | 시각    | 기능    | API           | 권한        | Production            | 전체    |
| --- | -------------------------------- | ------- | ------- | ------------- | ----------- | --------------------- | ------- |
| U01 | `/dwaion/home`                   | PARTIAL | PASS    | PASS_CONTRACT | PASS_TESTED | NOT_LIVE_VERIFIED     | PARTIAL |
| U02 | `/dwaion/new`                    | PARTIAL | PASS    | PASS_CONTRACT | PASS_TESTED | NOT_LIVE_VERIFIED     | PARTIAL |
| U03 | `/dwaion/conversations/:id`      | PARTIAL | PASS    | PASS_CONTRACT | PASS_TESTED | NOT_LIVE_VERIFIED     | PARTIAL |
| U04 | `/dwaion/conversations`          | PARTIAL | PASS    | PASS_CONTRACT | PASS_TESTED | LOCAL_LIVE_VERIFIED   | PARTIAL |
| U05 | `/dwaion/proposals`              | PARTIAL | PASS    | PASS_CONTRACT | PASS_TESTED | LOCAL_LIVE_VERIFIED   | PARTIAL |
| U06 | `/dwaion/proposals?proposal=:id` | PARTIAL | PASS    | PASS_CONTRACT | PASS_TESTED | LOCAL_LIVE_VERIFIED   | PARTIAL |
| U07 | `/dwaion/agents`                 | PARTIAL | PARTIAL | PARTIAL       | PASS_TESTED | NOT_LIVE_VERIFIED     | PARTIAL |
| U08 | `/dwaion/actions`                | PARTIAL | PARTIAL | PARTIAL       | PASS_TESTED | NOT_LIVE_VERIFIED     | PARTIAL |
| U09 | `/dwaion/activity`               | PARTIAL | PASS    | PASS_CONTRACT | PASS_TESTED | NOT_LIVE_VERIFIED     | PARTIAL |
| U10 | global overlay                   | PARTIAL | PARTIAL | PARTIAL       | PASS_TESTED | NOT_LIVE_VERIFIED     | PARTIAL |
| X01 | `/dwaion/routines`               | PARTIAL | PARTIAL | PARTIAL       | PASS_TESTED | UNAVAILABLE           | PARTIAL |
| X02 | `/dwaion/personal-controls`      | PARTIAL | PARTIAL | PARTIAL       | PASS_TESTED | PARTIAL_INTERNAL_ONLY | PARTIAL |
| X03 | `/dwaion/artifacts`              | PARTIAL | PARTIAL | PARTIAL       | PASS_TESTED | PARTIAL_INTERNAL_ONLY | PARTIAL |
| A01 | `/dwaion/admin/overview`         | PARTIAL | PARTIAL | PARTIAL       | PASS_TESTED | NOT_LIVE_VERIFIED     | PARTIAL |
| A02 | `/dwaion/admin/agents`           | PARTIAL | PARTIAL | PARTIAL       | PASS_TESTED | NOT_LIVE_VERIFIED     | PARTIAL |
| A03 | `/dwaion/admin/sources`          | PARTIAL | PARTIAL | PARTIAL       | PASS_TESTED | NOT_LIVE_VERIFIED     | PARTIAL |
| A04 | `/dwaion/admin/actions`          | PARTIAL | PARTIAL | PARTIAL       | PASS_TESTED | NOT_LIVE_VERIFIED     | PARTIAL |
| A05 | `/dwaion/admin/safety`           | PARTIAL | PARTIAL | PARTIAL       | PASS_TESTED | NOT_LIVE_VERIFIED     | PARTIAL |
| A06 | `/dwaion/admin/evaluation`       | PARTIAL | PARTIAL | PARTIAL       | PASS_TESTED | NOT_LIVE_VERIFIED     | PARTIAL |
| A07 | `/dwaion/admin/gates`            | PARTIAL | PARTIAL | PARTIAL       | PASS_TESTED | NOT_LIVE_VERIFIED     | PARTIAL |
| A08 | `/dwaion/admin/audit`            | PARTIAL | PARTIAL | PARTIAL       | PASS_TESTED | NOT_LIVE_VERIFIED     | PARTIAL |

## 직접 확인된 수정과 동작

- `새 대화`와 `내 대화`의 과도한 좌우 여백을 제거하고 DWAI 작업면이 가용 폭을 사용하도록
  정렬했다.
- `내 대화`는 실제 Agent API의 17개 대화, 검색·기간·정렬, 선택 inspector,
  rename/delete 및 legal-hold 실패 경계를 사용한다.
- `AI 제안함`은 list/analyze/preference/clear와 proposal decision/revision을 실제 API에
  연결한다. 모바일 분석 영수증에도 unavailable source를 숨기지 않도록 수정했다.
- 관리형 local runtime에서 신호 12건 분석 → 근거 제안 1건 생성 → `ACCEPT` → revision
  `1 → 2`, processed count `0 → 1`을 브라우저로 확인했다.
- U04–U06의 임의 색·반경·그림자·타이포그래피 값을 디자인 시스템 토큰과 공용 컴포넌트로
  교체했다.

이 수정은 확인된 오차를 줄였지만 Stitch 시각 PASS를 뜻하지 않는다. 정본에 있는 정보 중
현재 API가 제공하지 않는 값은 제품에 꾸며 넣지 않았고, 그 차이는 PARTIAL로 남겼다.

## 남은 실제 차이

1. 21개 전부 정본 대비 정보 밀도·계층·세부 메타데이터 또는 반응형 구조 차이가 있다.
2. X01에는 background scheduler, delegated authority, source connector fetch,
   proposal/notification delivery가 없다.
3. X02는 활성 PostgreSQL domain의 물리 purge까지만 제공하며 외부 원천·백업·crypto-shred는 없다.
4. X03은 local/PostgreSQL export와 server-bound citation 검증까지만 제공하며 enterprise DLP,
   외부 공유·협업·외부 source freshness 검증은 없다.
5. U10의 실제 장치·codec·production STT/TTS provider, A01–A08의 live probe·connector health·
   WORM/signature·평가 telemetry는 검증되지 않았다.
6. v6 권한 bundle은 `DRAFT`이고 rollout flag가 비활성이다.
7. production build와 bundle budget은 PASS했지만 Product Surface production readiness evidence는
   `BLOCKED 0/37`, release-approved product closure는 `0/12`다.

## 증거

- 독립 감사: `/Users/a10697/Work/DWP/output/dwaion-design-2026-09-09/independent-release-gate/audit.md`
- 21개 직접 비교: `/Users/a10697/Work/DWP/output/dwaion-design-2026-09-09/independent-release-gate/contact-sheet-21.png`
- 비교 파일 hash·치수: `/Users/a10697/Work/DWP/output/dwaion-design-2026-09-09/independent-release-gate/validation/visual-evidence.json`
- 실제 브라우저 흐름: `/Users/a10697/Work/DWP/output/dwaion-design-2026-09-09/final-audit/live-browser-verification.md`
- 권한 폐쇄: `/Users/a10697/Work/DWP/output/dwaion-design-2026-09-09/authorization-closure/verification.md`
- runtime 폐쇄: `/Users/a10697/Work/DWP/output/dwaion-design-2026-09-09/runtime-gap-closure/verification.md`

위 21개가 각 축의 증거를 모두 갖추기 전에는 DWAI·ON 전체를 `개발 완료`로 보고하지 않는다.
