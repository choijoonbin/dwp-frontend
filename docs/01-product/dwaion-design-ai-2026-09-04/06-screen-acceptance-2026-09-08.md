# DWAI·ON 21개 제품 화면 · Live Stitch 35개 프레임 수용 기록 · 2026-09-08

> **이 문서의 전체 수용·완료 판정은 2026-09-09에 철회되었다.** 아래 테스트와 캡처는
> 당시 라우트 렌더링, 접근성, 반응형 및 일부 기능 계약을 확인한 과거 실행 기록이다.
> Stitch 원본과의 화면별 시각 일치나 현재 작업 트리의 전체 기능 완료를 증명하지 않는다.
> 현재 판정은
> [Stitch 재검증 원장](implementation-evidence/2026-09-09/stitch-remediation-ledger.md)과
> [기능·API·권한 독립 감사](08-functional-api-permission-audit-2026-09-09.md)를 따른다.

이 문서는 [Stitch 구현 원장](03-stitch-implementation-matrix.md)의 U01–U10, X01–X03,
A01–A08을 실제 메뉴·API·화면 검증에 연결한다. 제품 구조는 18개 메뉴에 대화 답변, 제안
상세, 전역 도우미라는 문맥 화면 3개가 결합된 21개 화면이다. Live Stitch 프로젝트에는
반응형·실패 변형을 포함한 핵심 32개 프레임과 Work·Activity 교차 제품 3개 프레임이 있어
총 35개다. 커밋·푸시·운영 배포는 수행하지 않는다.

이 기록은 2026-09-08 당시 수행한 검증의 보존 문서다. 브라우저 결과는 해당 시점의 독립
검증 사본에만 적용되며, 현재 구현의 최종 수용 판정으로 사용하지 않는다. 과거 진단·수리
실행을 현재 PASS 수에 합산하지 않는다.

## 화면별 구현과 계약

구현 파일은 `apps/dwp/src/features/dwaion/`, API 어댑터는
`libs/shared-utils/src/api/` 기준이다. 도우미만 `apps/dwp/src/components/dwaion-assistant/`에 있다.

| ID  | 경로·문맥                                | 구현 정본                                      | API·데이터 정본                                                           | 정상·빈 상태·실패·권한 검증 내용                                                                                          |
| --- | ---------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| U01 | `/dwaion/home`                           | `dwaion-home.tsx`, `dwaion-home-proposals.tsx` | 업무 큐, 대화 목록, ACTIVE 제안 최대 2건, registry, actions               | 실제 제안 내용과 정확한 UUID 링크, 0건, 부분 403/503, 독립 업무 영역 유지                                                 |
| U02 | `/dwaion/new`                            | workspace start/composer/studio rail           | Ask stream, 업무 큐                                                       | 실제 sourceScopes, 최소 1개 소스, 질문 길이, 입력 보존, 조회 실패와 질문 입력 분리                                        |
| U03 | `/dwaion/conversations/:id` 및 질문 결과 | workspace answer/context/action shelf          | 대화 detail, Ask stream, plan preview·handoff, artifact 결속              | 결과 1회 알림, 출처 링크·근거 없음, agent/source binding, 검증된 답변의 결과물 전환, 모바일 근거 대화상자·포커스 복귀     |
| U04 | `/dwaion/conversations`                  | conversations/archive list·controls            | 대화 목록·detail·rename·delete                                            | 현재 조회 범위, 제목 검색·기간·정렬, 재개, 이름 변경, 삭제 확인·legal hold·조회 403                                       |
| U05 | `/dwaion/proposals`                      | proposals/list/controls, selection hook        | Proposal inbox·analysis·preferences·clear                                 | paging, 소스 부분 실패, 실제 제안 0건, view·선택 URL, 존재하지 않는 ID의 대체 금지                                        |
| U06 | U05의 `?proposal=<UUID>`                 | proposal detail/model/evidence                 | 결정 receipt·revision·만료·snooze                                         | 정확한 근거·발생 시각, 만료 후 결정 금지, timezone/DST, 409 재조회, clear 후 캐시 제거                                    |
| U07 | `/dwaion/agents`                         | agents/catalog inspector·copy                  | Platform runtime registry                                                 | 실제 2개 Agent의 capability·한계·owner·revision, 목록/상세, opaque 질문 시작, 조회 실패·권한 거부                         |
| U08 | `/dwaion/actions` 및 답변 shelf          | actions/catalog inspector, action shelf        | Action catalog, plan preview, 원본 앱 handoff                             | 입력·권한·위험·검토 위치, 명시 CTA 인계, preview와 최종 업무 완료 분리, 오류·권한 거부                                    |
| U09 | `/dwaion/activity`                       | activity orchestration·view                    | 사용자 실행 목록·detail                                                   | 질문 원문 없이 실행 메타데이터, 목록·필터·선택 보존, 부분 조회 실패, 상세 drawer                                          |
| U10 | 전역 launcher·assistant                  | launcher/global host/voice controls            | Voice STT/TTS, 지원 목적지, Ask                                           | 업로드 전 고지·폐기, 전사 검토 후 수동 전송, 재생 종료·오류 정리, 320px header containment                                |
| X01 | `/dwaion/routines`                       | routines/ 하위 모듈                            | Routine·consent·dry-run 원장                                              | 동의 기본 OFF, revision 결속 dry-run, pause/archive, `DRY_RUN_ONLY` 경계, 오류·독립 권한                                  |
| X02 | `/dwaion/personal-controls`              | personal controls 및 하위 모듈                 | Source preference·memory·runtime consent·privacy                          | 저장/답변 적용 독립 동의, 권한별 영역 분리, cached memory 403 회수, 삭제 요청 영수증                                      |
| X03 | `/dwaion/artifacts`                      | artifacts/artifact-studio 하위 모듈            | 대화 결속 생성·Draft·immutable version·reference·preflight·export request | 서버 검증 대화 출처, 직렬 autosave, revision 충돌, stale preflight 무효화, selected detail 권한 회수, request-only export |
| A01 | `/dwaion/admin/overview`                 | admin overview                                 | `admin/overview?period_days=`                                             | 기간 URL·재조회·생성 시각, 완료 표본/전체/실패, 미측정 지연과 0 구분, 허용 메뉴 drilldown                                 |
| A02 | `/dwaion/admin/agents`                   | admin agents/registry/history                  | Platform registry·revision history·lifecycle                              | 메타데이터 검색·목록/상세, draft 편집, 게시/중지 확인, 취소 무변경, 권한·오류·비어 있음                                   |
| A03 | `/dwaion/admin/sources`                  | admin sources/source dialog                    | `admin/sources` 정책·expectedVersion                                      | 설정과 health 분리, enabled/BLOCKED, 현재/변경 비교·사유, 409 최신 버전 재검토                                            |
| A04 | `/dwaion/admin/actions`                  | admin actions/action dialog                    | `admin/actions` 정책·expectedVersion                                      | 실제 action key·소유 앱·권한·위험·확정 위치, 변경 비교·사유, 409 초안 보존·재검토                                         |
| A05 | `/dwaion/admin/safety`                   | admin safety                                   | `admin/safety`                                                            | 불변 원칙과 편집 설정 분리, 명명된 입력, version 결속 저장, 실패·view-only·미측정                                         |
| A06 | `/dwaion/admin/evaluation`               | admin evaluation/history/results               | Evaluation set·case·run                                                   | 실제 완료 규칙 검사 표본, 기대 단어·근거 여부, 비교 조건 없는 정확도·추세 제거, 403 stale 결과 차단                       |
| A07 | `/dwaion/admin/gates`                    | admin gates/registry/GateDialogHost            | Operational gate evidence·decision                                        | 실제 scope·eligibility·expiry·revision, 자기 승인 차단, 모바일 상세, 실패·권한별 CTA                                      |
| A08 | `/dwaion/admin/audit`                    | admin audit 및 retention                       | Audit search/paging/export, retention                                     | 본문 없는 감사 메타데이터, export 응답 limit/truncated, 보존 권한 독립·legal hold·조회 실패                               |

## Stitch 원본 대조

[Stitch 프로젝트](https://stitch.withgoogle.com/projects/13391261371843159731)의 UI ZIP export에서
DWAI 핵심 원본 32개 프레임과 HTML 32개를 추출했다. [파일·SHA-256 원장](../../../../output/dwaion-design-2026-09-08/reference/stitch/manifest.json)으로
원본을 구별한다. U01–U10의 데스크톱·모바일, U01 부분 실패, X01–X03 및 A01–A08 원본이다.
2026-09-08에 Live 프로젝트를 다시 열어 35개 노드를 직접 열거했으며, ZIP 정본 밖의 교차
제품 3개는 다음과 같이 연결된다.

| Live Stitch 프레임             | node ID                            | 구현 경로·정본                                                                             | 검증 경계                                                                                                |
| ------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| WRK-A01 선택 업무 DWAI·ON 지원 | `941feb59256e4dc79f0586cd40f80618` | `/work/queue?work=…`, `work.tsx`, `work-hub-assist-dialog.tsx`, selected-work typed stream | 읽기·질문·출처·복사·저장된 대화 이어가기. 소유 서비스 변경 계약이 없는 Work 폼 직접 적용은 제공하지 않음 |
| DWAI·ON Activity desktop       | `aeaa8d7c29584294870c5e6d77983f10` | `/dwaion/activity?run=<UUID>`, `dwaion-activity.tsx`, `dwaion-activity-view.tsx`           | 실제 실행 목록·exact run 상세·관련 대화 복귀. 시안의 고정 건강도·추론 수치를 운영 사실처럼 표시하지 않음 |
| DWAI·ON Activity mobile        | `038415e19b844e319754f2f8e46619ec` | 같은 반응형 경로의 모바일 전체 화면 상세                                                   | 선택 보존·drawer·권한 회수·포커스 복귀                                                                   |

원본의 질문→근거→검토 흐름, 목록과 선택 상세, 개별 동의·보존 설정의 구조를 대조했다.
화면 스타일은 DWP 디자인 시스템을 사용한다. API가 제공하지 않는 정확도·상시 실행·연결
건강도·자동 진단·물리 삭제 완료·승인 상태는 원본에 있어도 구현하지 않는다.
모바일 상세는 공통 포커스 복귀 규칙에 맞춰 전체 화면 대화상자로 제공한다.

[21개 화면 API 계약 감사](07-api-contract-audit-2026-09-08.md)에서 frontend 호출과 실제 backend 경로,
fixture 및 외부 실행기와의 계약 경계를 확인했다.

## 브라우저 증거 묶음

- U01: `e2e/dwaion-home-design.spec.ts` — ACTIVE 제안 최대 2건 조회, 부분 실패, opaque 질문 시작과 반응형.
- U02~U04: `e2e/dwaion-conversation-design.spec.ts`, `e2e/dwaion-selected-conversation.spec.ts`,
  `e2e/dwaion-conversation-controls.spec.ts`, `e2e/dwaion-conversation-route.spec.ts` —
  sourceScopes, 답변/근거, 대화 목록과 selected-work 신원 결속, 서버 검증 답변→결과물 전환.
- U05~U06: `e2e/dwaion-proposal-selection.spec.ts`, `e2e/dwaion-proposal-review.spec.ts`,
  `e2e/dwaion-agentic-work-os.spec.ts` — deep link, 결정·만료·보류·삭제, 음성·계획 인계.
- U07~U08: `e2e/dwaion-catalogs.spec.ts`, `e2e/dwaion-bound-action-review.spec.ts` —
  Agent/Action 정상 데이터와 inspector, 답변에 결속된 검토·명시적 원본 앱 인계 경계.
- U09~U10: `e2e/dwaion-activity-list-detail.spec.ts`, `e2e/dwaion-launcher.spec.ts`,
  `e2e/dwaion-launcher-header-contract.spec.ts`, `e2e/activity-stitch-visual-quality.spec.ts`.
  [수용 기록·캡처](implementation-evidence/2026-09-08/u09-u10/verification.md).
- X01~X03: `e2e/dwaion-personal-intelligence.spec.ts`,
  `e2e/dwaion-personal-intelligence-visual.spec.ts`,
  `e2e/dwaion-personal-access-revalidation.spec.ts` — 기능·권한 회수·만료·회귀 baseline.
- A01–A08: `e2e/dwaion-stitch-coverage.spec.ts`, `e2e/dwaion-admin-conflicts.spec.ts` —
  정상·빈/미측정·503·view 거부·409 초안 보존 및 늦은 응답 격리,
  desktop/mobile·dark·forced-colors·200%·키보드·axe.
  [관리자 수용 기록](05-admin-acceptance-2026-09-08.md).
- 메뉴 계약: `e2e/menu-route-contract.spec.ts` 및 DWAI product manifest/navigation 단위 검사.
- 교차 제품 WRK-A01: `e2e/work-selected-assist-contract.spec.ts`,
  `e2e/work-stitch-design-sync.spec.ts` — 1440/1280/390/320px, 200% reflow, 선택 변경·권한
  회수·늦은 응답 격리 및 원천 변경 버튼 부재.

화면 fixture는 실제 API 필드와 오류 계약을 재현하는 브라우저 시험 입력이다. fixture의 성공
응답이나 이미지가 운영 연결, 모델 품질, 실제 공급자 검증의 증거가 되지는 않는다.

## 현재 제공 범위와 외부 운영 조건

제안 수락은 사용자의 결정 영수증이다. 원본 앱 초안 인계는 발송·제출 완료가 아니다.
Agent 게시나 source 설정은 live health가 아니며, 평가 통과는 해당 run의 제한된 규칙 검사다.

루틴 scheduler·위임 토큰·알림 전달 worker, connector 원본 검증기, 조직 DLP, 파일 export
worker, 승인된 물리 삭제 실행기, managed KMS 운영 승인 증거는 환경별 후속 조건이다.
해당 계약이 없는 환경에서는 활성·완료·안전 통과로 표시하지 않는다. V32의 명시적 답변 표현
개인화는 구현되어 있으며, 저장 동의와 답변 적용 동의를 둘 다 별도로 확인한다.

## 2026-09-08 기준선 검증 결과

Node 24와 독립 검증 사본 `/tmp/dwaion-final-checkout-20260908`에서 다음 최종 브라우저
보고서 3개를 확인했다. 각 행은 별개의 실행이며, 같은 파일·제목·프로젝트의 case를 중복
합산하지 않았다.

| 최종 실행   | 실제 검증 범위                                    | 결과         | 시작 시각 · UTC     | 원본 보고서 사본                                                                  |
| ----------- | ------------------------------------------------- | ------------ | ------------------- | --------------------------------------------------------------------------------- |
| Chromium v3 | DWAI·ON Chromium 전체, 관리자 93개 포함           | 291/291 PASS | 2026-09-08 11:49:10 | [run-1.json](implementation-evidence/2026-09-08/final-gallery/reports/run-1.json) |
| Mobile v1   | 개인 화면 visual baseline 3개와 DWAI·ON 메뉴 18개 | 21/21 PASS   | 2026-09-08 12:02:59 | [run-2.json](implementation-evidence/2026-09-08/final-gallery/reports/run-2.json) |
| Quality v2  | 기존 Activity 품질 범위                           | 5/5 PASS     | 2026-09-08 12:04:59 | [run-3.json](implementation-evidence/2026-09-08/final-gallery/reports/run-3.json) |

고유 **317/317개**가 모두 `expectedStatus=passed`, `resultStatus=passed`다.
retry, flaky, skip, globalErrors는 각각 **0**이다. Mobile 21개는 모든 화면의 모바일 기능
여정 21개를 뜻하지 않으며, Quality 5개도 21개 화면 전체의 모든 품질 조합을 뜻하지 않는다.

[최종 갤러리](implementation-evidence/2026-09-08/final-gallery/index.html)와
[갤러리 manifest](implementation-evidence/2026-09-08/final-gallery/manifest.json)는
원본 SHA-256을 보존한 **218개 PNG**와 위 보고서 3개를 연결한다. **21개 ID의
missingPrimary=0, missingContext=0**이며, 화면별 파일·문맥·폭은
[최종 증거 지도](../../../../output/dwaion-design-2026-09-08/final-screen-evidence-map.md)와
[지도 JSON](../../../../output/dwaion-design-2026-09-08/final-screen-evidence-map.json)에 기록했다.
Stitch 원본은 위의 원본 manifest로 구별하며, 관리자 계약과 API 존재 감사는 각각
[05 관리자 수용 기록](05-admin-acceptance-2026-09-08.md),
[07 API 계약 감사](07-api-contract-audit-2026-09-08.md)를 따른다.

X01–X03의 320px·768px·200% text·dark·forced-colors 등 특수 상태 테스트는 통과했지만,
해당 변형 PNG는 생성하지 않았다. 갤러리의 정상 desktop/mobile 및 권한 회수·만료 캡처를
모든 특수 상태의 시각 증거로 확대하지 않는다. 기본 화면·필수 문맥의 누락 0과 변형 PNG의
부재는 서로 다른 범위다.

정적·단위 검사는 다음 실행 시점과 소스 범위로 확인했다.
[최종 검증 원장](implementation-evidence/2026-09-08/final-validation/manifest.json)에 연결된
각 `.result.json`과 `.log`가 명령·cwd·시각·종료 코드 및 원본 SHA-256을 보존한다.

| 소스 범위 · 검사명                                                                                                                    | 검사                                   | 결과                         | 실행 시각 · UTC              |
| ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------- | ---------------------------- |
| 공유 병합 snapshot · [shared-unit-final](implementation-evidence/2026-09-08/final-validation/shared-unit-final.result.json)           | 전체 단위 테스트                       | 519 files / 4,239 tests PASS | 2026-09-08 11:03:23–11:05:38 |
| 공유 병합 snapshot · [shared-type-final](implementation-evidence/2026-09-08/final-validation/shared-type-final.result.json)           | non-incremental typecheck              | PASS                         | 2026-09-08 11:09:05–11:10:48 |
| 공유 병합 snapshot · [shared-workspace-final](implementation-evidence/2026-09-08/final-validation/shared-workspace-final.result.json) | `dwp-workspace:build`                  | PASS                         | 2026-09-08 11:05:22–11:05:28 |
| 독립 최종 사본 · [private-type-final-v1](implementation-evidence/2026-09-08/final-validation/private-type-final-v1.result.json)       | non-incremental typecheck              | PASS                         | 2026-09-08 12:07:05–12:07:32 |
| 독립 최종 사본 · [private-build-final-v3](implementation-evidence/2026-09-08/final-validation/private-build-final-v3.result.json)     | 전체 production build 및 bundle budget | PASS · exit 0 · 95.66초      | 2026-09-08 12:11:19–12:12:55 |

대화→결과물 결속 보완 이전 DWAI UI·assistant·Agent API의 non-test **116개 파일**은 공유
병합본과 독립 사본의 SHA-256
불일치가 **0**이다. 최대 **489줄**, 전부 **500줄 미만**이며,
[소스 인벤토리 영수증](implementation-evidence/2026-09-08/final-validation/dwaion-product-inventory-final-receipt.json)이
선택 범위와 비교 결과를 보존한다.

공유 전체 작업 트리는 위 snapshot 이후에도 별도의 Work·Meetings 작업으로 변경된다.
따라서 독립 Chromium v3와 독립 최종 빌드 결과는 해당 사본 및 일치가 확인된 DWAI 제품
범위에 대한 증거다. 공유 작업 트리의 그 이후 Work·Meetings 변경까지 검증한 결과로
해석하지 않는다.

## 2026-09-09 최신 완료 보완 검증

위 기준선 이후 발견한 대화 답변→결과물의 사용자 동작과 서버 출처 결속을 구현하고, 사용자가
지적한 새 대화·내 대화 화면의 별도 최대 너비를 제거했다. 따라서 291/291·317/317 및 116개
파일 수치는 과거 기준선으로 보존하고 현재 완료 판단에는 아래 최신 실행을 사용한다.

| 최신 실행                      | 실제 검증 범위                                        | 결과                                         |
| ------------------------------ | ----------------------------------------------------- | -------------------------------------------- |
| DWAI·ON current                | 현재 19개 DWAI E2E spec                               | **280/280 PASS**, failure·skip·flaky·retry 0 |
| DWAI menu current              | 18개 메뉴의 Chromium·mobile route/권한/화면 계약      | **36/36 PASS**                               |
| Conversation spacing current   | 새 대화·내 대화의 1920px 공통 캔버스 경계             | **2/2 PASS**, 좌우 32px                      |
| WRK-A01 cross-product current  | 1440·1280·390·320px 및 200% reflow                    | **5/5 PASS**                                 |
| Activity quality current       | light·dark·forced colors·200% root text, 4개 viewport | **4/4 PASS**                                 |
| Frontend focused unit/static   | 20 files / 114 tests, typecheck·lint·format·OpenAPI   | **PASS**                                     |
| Frontend production bundle     | Vite 5,200 modules 및 전체 bundle budget              | **PASS**, initial raw 1,063.4/1,074.2 KiB    |
| Agent current                  | 출처 결속 10, 관련 API 27, clean PostgreSQL 전체 472  | **모두 PASS**                                |
| Platform authorization current | DWAI 개인 기능 권한 migration 단위·PostgreSQL         | **2/2 PASS**                                 |

최신 소스 인벤토리는 **117개 파일**, 최대 **491줄**, 500줄 이상 0건이다. 현재 Stitch 35개
프레임, 18개 메뉴, 3개 문맥 화면 및 현재 서버가 안전하게 지원하는 기능의 완료 판단과 보고서·캡처·
SHA-256은 [Live 35 최신 완료 검증](implementation-evidence/2026-09-09/live-35-completion/verification.md)을
정본으로 사용한다. 서로 겹치는 실행 수치는 합산하지 않는다.

최신 Activity 보고서의 200%는 root font 확대다. 환경 변수로 선택 실행하는 native browser zoom
extension case는 이 4개에 포함하지 않았고 실행하지 않은 case를 통과로 기록하지 않는다. 운영
공급자·scheduler·managed KMS·connector 검증·DLP·실제 export·물리 삭제 실행과 승인 증거는 계속
운영 조건이며 제품 UI 구현 완료와 구분한다.
