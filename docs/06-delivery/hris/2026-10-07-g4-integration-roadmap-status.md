# 2026-10-07 HRIS G4 통합 로드맵 상태 Successor

> 상태: G4 complete; G5 authorized and in progress
>
> 기준일: 2026-10-07
>
> 선행 정본: [G3 통합 로드맵 상태 Successor](2026-10-07-g3-integration-roadmap-status.md)
>
> G4 판정: [G4 Frontend Semantic Integration Receipt](2026-10-07-g4-frontend-semantic-integration-receipt.json)

G4는 current Frontend와 reconciled HRIS Frontend를 의미 통합하고, G3에서 고정한 Backend
`f0a971eada612e6a267ece104707f0cab4191343`만을 생성 입력으로 사용했다. 충돌은 0건이며
Authorization v34, fixture, internal closure와 Gateway OpenAPI projection은 한 번 materialize한 뒤
모두 no-op check를 통과했다. Home 앱의 한글·영문 visible identity는 `HRIS`다.

## Gate 상태

| 단계 | 상태 | 다음 권한 |
| --- | --- | --- |
| G4 Frontend 의미 통합 | `COMPLETE` | G5 안정화·동결 실행 가능 |
| G5 통합 안정화·동결 | `IN_PROGRESS_REQUIRED_NO_WAIVER` | live OpenAPI parity, 기존 DB upgrade·persistence, source-size debt, clean install 및 결정론적 FE/BE candidate 검증 후에만 head 동결 |
| G6 W1 Successor | `NOT_RUN` | G5에서 동결한 정확한 FE/BE head pair로 한 번만 실행 |
| G7 Evidence Promotion·위임 | `NOT_AUTHORIZED` | G6 PASS와 successor module packet 발급 전까지 module-parallel authority는 `false` |

## G4 고정 결과

- Frontend semantic result: `51ab8a8df6bcc44266be7d7edc708a6b4d8ce081`.
- Authorization: v34, checksum
  `852d20e1e639e1a7170f02b5714d21d8c51a9eb8ff5ac32d8b7940b82d6be83b`,
  223 capabilities, 24 access policies, 17 entitlement expressions, 54 predicate policies,
  952 routes.
- Internal closure: 12/12 products, 60/60 attack cells, `COMPLETE`.
- Gateway OpenAPI: 1,665 paths, 1,905 operations, 3,591 schemas, Backend projection과 byte 동일.
- 변경 영향 검증: Vitest 106건 및 추가 48건, Node contract 26건 및 closure/readiness 38건,
  Chromium 영향 4건, mobile Chrome 18건 모두 PASS. 모바일 조건상 제외된 7건은 desktop-only test다.
- 브라우저 실패는 한 번에 수집해 잘못된 admin permission fixture와 WebKit 미설치 실행 설정으로
  분리했고, 수정 후 영향 범위만 재실행했다.

## G5 실행 경계

G5는 잠정 head에서 W1을 실행하지 않는다. 먼저 Auth·Platform isolated OpenAPI export,
People/PAY/TIM enabled-owner live parity, PAY/TIM existing-DB staged upgrade와 owner persistence,
production/test source-size exact gate, Node 24·Yarn immutable clean install, Backend/Frontend 전체
결정론적 candidate gate를 각각 한 번 완료한다. 실패는 동일 cluster에서 일괄 수정하고 그 영향
범위부터 재검증한다. 공유 contract, runtime topology 또는 frozen head가 바뀌지 않으면 이미 통과한
G4 전체를 반복하지 않는다.

G5가 끝나기 전 `scripts/hris-w1-checkpoint-core.mjs`의 active Authorization binding을 v34와 exact
checksum으로 맞추고 checksum 환경변수를 fail-closed allowlist에 포함해야 한다. 또한 Frontend
OpenAPI check는 official Backend absolute path를 명시하여 fallback skip을 허용하지 않는다.

이 문서는 G5 실행을 승인하지만 모듈별 병렬 개발, 고객 활성화 또는 production release는
승인하지 않는다.
