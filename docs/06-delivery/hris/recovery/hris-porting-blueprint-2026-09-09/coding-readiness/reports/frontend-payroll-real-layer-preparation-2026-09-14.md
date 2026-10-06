# 실제 급여 시작 화면 계층 정리 — 2026-09-14

상태: ROOT AUTHOR / 실제 PAY pilot 리팩터링·선택 검증 통과 / 독립 전문가 검토 전 / 전체 G3 CLOSED.

Integration frontend의 기존 급여 조회 시작 화면을 실제 `api / hooks / model / pages / testing`으로 분리했다. 별도 샘플이나 검증기 예외를 추가한 것이 아니다. 사용자 요청의 디자인 교체 전 기능 중심 구현 방향을 유지했으며 문구·레이아웃·API 경로·native APP.HCM identity·조회/다운로드 경계는 보존했다.

## 구현 경계

- 기존7파일 중6파일을 역할별 디렉터리로 이동하고 root index의 공개 계약은 유지했다. 조회 훅1개를 추가했다. 외부 route는 `features/hris/payroll` 공개 진입점을 계속 사용한다.
- API adapter만 공유 Gateway 클라이언트를 사용한다. 훅은 기존 current request scope 전체의 cache key/meta/AbortSignal/ready 조건과60초 staleTime을 유지한다. 화면에서 raw query/API/transport DTO를 사용하지 않는다.
- 순수 모델은 transport type alias 대신 표시를 위한 명시적 입력·출력 타입을 갖는다. employee·금액·계좌 필드가 없고, cycle은 선언된10필드만 복사한다. 원천의 추가 필드나 객체 참조가 화면에 전파되지 않는다. 이는 서버의 실제 필드 권한·PII 검증을 대신하지 않는다.
- 조회 캐시에는 화면 모델을 보관하며 현재 저장소에서 동일 cache-key family를 공유하는 다른 consumer가 없는 것을 읽기 검색했다. 화면 내부 다운로드 상태는 전체 authority key 변경 시 새로 생성한다. 제공되지 않은 보안 다운로드 handler를 성공 기능으로 표시하지 않는다.
- runtime tests는 내부 구현을 직접 import하지 않고 공개 barrel을 사용한다. API mock은 실제 내부 adapter 모듈 경로를 지정하지만 새 transport/우회 권한을 만들지 않는다.

## 실제 검증 — 서로 합산하지 않음

| 실행 | 실제 결과 | UTC |
| --- | --- | --- |
| 첫 baseline 잠금 대기 | timeout/실행0, PASS 제외 | 별도 실패 원문 보존 |
| 변경 전3 test files | 고유23/성공23/실패·skip0, source48 SHA/ns 안정 | 09:04:28.580–09:04:33.169 |
| 변경 후3 test files | 고유25/성공25/실패·skip0, source50 SHA/ns 안정 | 09:07:38.056–09:07:46.062 |
| 현재 whole TypeScript compile | `tsc --noEmit` exit0 | 09:08:58.648 시작/8.03초 |
| 기존 quality checks7개 | feature/API/cycle/source-size/maintenance-size/unused-export/focused ESLint 모두 exit0 | 전체 batch09:08:58.648–09:09:34.890 |
| 새 HRIS 계층 전체 AST | PAY 오류0, 전체 exit1/32미분류/45오류 | current actual repository scan |

추가2개는 민감 extra·source reference 차단과, 다음 authority의 fresh cache가 있을 때 이전 다운로드 오류 상태 제거다. 기존23을 제거하거나 기대값을 약화하지 않았다. quality batch의 SHA/ns는 PAY/config/checker18파일 범위이며 whole TypeScript source 모두의 manifest 검증으로 확대하지 않는다. 기존 ratchet의 source1000행/test-tool1000행 및 exact legacy exceptions는 변경0이다.

원본 argv·stdout/stderr gzip·각 case ID·pre/post pins는 `frontend-payroll-layer-existing-baseline-2026-09-14.json`, `frontend-payroll-real-layer-author-replay-2026-09-14.json`, `frontend-payroll-real-layer-quality-author-replay-2026-09-14.json` 및 `frontend-payroll-real-layer-current-ast-scan-2026-09-14.json`에 저장했다. 잠금 실패 원문은 `frontend-payroll-layer-baseline-lock-timeout-2026-09-14.json`에 남겼다.

## 미완료

독립 전문가 source 검토·같은25의 새 재실행, 나머지 People/Performance/Time/Shell actual layering, 각 feature 공개 API/소유 경계 및 전체 layered 검증, current catalog/SBOM/common publication/canonical fanout/session runtime과 두 global Gate 검증이 남는다. 현재2035 source scan의 classified9/layered7은 PAY와 기존 공개 barrel의 실제 상태이지 전체5모듈 정리 완료가 아니다. native 권한·payroll 계산/확정/지급 또는 전체 급여 기능 개발은 이 작업 범위에서 구현했다고 주장하지 않는다.
