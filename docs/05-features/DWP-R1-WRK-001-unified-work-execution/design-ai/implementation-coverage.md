# 디자인 목표와 실제 구현 확인표

기준일: 2026-09-04. 대상: Stitch 01–12 결과를 반영한 현재 통합업무함 구현.

업무 앱은 여러 원천의 내 처리 책임을 모으되 원본 앱의 상태와 권한을 대신 소유하지 않는 실행 허브다. 현재 제품은 `/work/queue`를 canonical 경로로 사용하고 중복 업무 홈을 제거했다. 개인 할 일·오늘 계획·Calendar·AI는 별도 영구 메뉴가 아니라 같은 큐의 상세, 패널, 대화상자와 handoff로 제공한다.

## 현재 구현 범위

| 영역           | 사용자에게 제공되는 기능                                                                                                                                                               | 안전·소유권 경계                                                                                                                                                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 통합 조회      | Workspace·결재·서비스·개인 할 일 등 활성 원천을 병렬 조회하고 정확한 의무 단위로 중복을 제거한다. 검색·원천·상태·기한·오늘 계획 필터, 목록–상세 선택, URL 복귀를 제공한다.             | 부분·제한·실패·권한 없음과 정상 0건을 구분한다. 403 refresh는 해당 원천의 이전 내용을 제거하고, transport 실패만 명시적 stale/degraded 상태로 보존할 수 있다.                                                                                     |
| 개인 할 일     | 생성·편집, 시작·대기·완료·재개·보관, 원천 참조 표시·명시적 해제, 전체 paginated timeline, 충돌 뒤 최신본 재조회와 입력 보존을 제공한다.                                                | 개인 완료는 연결된 원본 완료가 아니다. 같은 불확실 명령만 동일 UUID·version으로 재시도하고, 새로 확인된 명령은 새 UUID를 사용한다.                                                                                                                |
| 오늘 계획      | 날짜 선택, 후보 추가·제거·순서 변경, 최대 100개 저장, optimistic concurrency와 409 최신본 복구를 제공한다.                                                                             | 계획은 원본 기한·상태·Calendar 일정과 독립이다. 저장된 `DAY_PLAN_SELECTION` token은 plan receipt의 source mapping으로만 해석하며 화면에 노출하지 않는다. 접근 불가 항목도 손실 없이 유지·이동·제거한다.                                           |
| Calendar 연결  | 권한이 있는 개인 업무의 비공개 집중시간을 생성하고 Work 관계를 저장한다. 연결 목록·일정 상태·상세 이동·확인 후 연결 해제를 제공한다.                                                   | Calendar VIEW와 Work UPDATE가 모두 있을 때만 생성한다. event 생성 결과 미확인과 link 저장 대기를 구분해 receipt를 보존하고, 재개 시 남은 link 단계만 시도한다. 조회 기간은 Calendar 계약의 상한 안으로 제한한다. link 해제는 event 취소가 아니다. |
| 원천 상세·행동 | 결재·권한 검토·서비스의 역할, 원천 상태, 확인 시각, 허용 행동과 원본 이동을 구분한다. Access Review와 Service는 기존 소유 앱 흐름으로 이어진다.                                        | 현재 owner 계약과 권한으로 검증된 행동만 실행한다. 일반 시작·완료·승인·보완 제출을 모든 원천에 합성하지 않는다. 충돌·권한 회수 뒤 최신 snapshot을 다시 읽는다.                                                                                    |
| 일괄 실행      | 선택 가능한 Workspace 항목만 대상으로 원자적 preview/요청을 만들고, 전체 요청이 확인되면 항목별 confirmed receipt를 표시한다. 응답이 불명확하면 모든 항목을 확인 필요 상태로 유지한다. | 필터 변경 시 선택을 비우며, 숨겨졌거나 preview에 없던 항목을 실행하지 않는다. 원천이 다른 항목을 공통 완료·승인으로 처리하지 않는다.                                                                                                              |
| 선택 업무 AI   | 선택한 한 건의 검토 가능한 최소 맥락과 질문을 DWAI·ON으로 전달하고 기존 AI 화면으로 이어 준다.                                                                                         | AI 응답은 분석·초안이며 원본 행동이나 완료가 아니다. 확인할 수 없는 원천, 오래된 version, 지원하지 않는 민감 projection은 전달하지 않는다.                                                                                                        |
| 반응형·접근성  | desktop 목록–상세, mobile full-detail 복귀, dialog focus, 가시적 focus, 상태 announcement, 긴 한영 문구, 390px·320px·200% reflow를 구현한다.                                           | 자동 검증은 실제 보조기기·모든 OS 가상 키보드의 운영 수용을 대신하지 않는다.                                                                                                                                                                      |

## 01–12 화면별 반영 판정

| 번호               | 구현 결과                                                                                                                          | Stitch에서 적용한 요소                                                                  | 계약에 맞게 변경하거나 제외한 요소                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 01 통합업무함      | `/work/queue`의 반응형 역할 중심 목록–상세, 검색·필터·정렬, source status, 부분 실패, 빈 상태, 선택 상세와 mobile 복귀를 구현했다. | 첫 viewport의 업무 밀도, 행의 원천·기한·상태 구분, desktop split pane, mobile 단일 흐름 | 6개 영구 하위 메뉴, 모든 원천 정상·실시간 단정, 원천 항목의 일반 완료    |
| 02 결재 상세       | 결재의 현재 역할·상태·근거 요약과 owner-specific action 또는 원본 handoff를 제공한다.                                              | 근거와 행동의 위계, 현재 사용자의 책임 강조                                             | 법적 효력·감사 로그·엔진 동기화 보장, 계약 없는 공통 직접 결정           |
| 03 접근권한 검토   | 기존 Access Review 상세·결정 흐름으로 정확히 이동하고 Work 큐의 상태·복귀 맥락을 유지한다.                                         | 대상→권한→근거→결정의 순서와 mobile full-detail                                         | 즉시 ERP 차단, 세션 알림, 모든 환경의 remediation 성공 보장              |
| 04 서비스 상세     | 요청 맥락과 내 역할을 표시하고 기존 Service 원본으로 이어 준다.                                                                    | 보완 필요 사유와 진행 상태의 구분                                                       | Work 안의 범용 보완 제출, 담당자 알림 전송, ITSM live/version 단정       |
| 05 개인 할 일 상세 | 설명·우선순위·기한·출처, 상태 행동, 편집, 계획, Calendar, AI, timeline을 한 상세에 구성했다.                                       | 상태 행동과 실행 지원의 그룹화, desktop/mobile 상세 구조                                | ERP 잔액·승인 완료·하위 작업 등 fixture 전용 필드                        |
| 06 생성·캡처·편집  | create/edit dialog, validation, dirty-close 확인, source reference 유지·해제, create-and-plan을 구현했다.                          | 집중형 form, 저장·취소·오류의 명확한 순서                                               | Mail·Messaging 캡처 진입, Markdown·메시지 ID·preset을 연결 완료로 단정   |
| 07 오늘 계획       | 같은 큐에서 날짜·후보·선택 목록, 추가·제거·순서와 저장 충돌 복구를 제공한다.                                                       | 원본 목록과 개인 계획의 분리, 순서 조정                                                 | 예상 소요·성공 확률·AI 자동 배치·추천                                    |
| 08 Calendar 연결   | 시간대·시작·종료를 검토한 event 생성, link receipt, 부분 성공 복구, link 조회·해제를 구현했다.                                     | 대상과 시간 입력, event와 link 단계의 분리                                              | 가용성 자동 확인, `준비 완료`·Direct 성공 단정, link를 event 소유로 표현 |
| 09 원천·복구·일괄  | source status dialog, terminal/non-terminal 결과, atomic batch preview와 item receipt를 구현했다.                                  | 작은 inspector와 항목별 결과 목록                                                       | 모든 원천 공통 일괄 완료·승인, timeout의 임의 성공·실패 확정             |
| 10 Flow 업무 요약  | 중복 업무 홈을 제거하고 Flow의 compact contribution에서 통합업무함으로 이동하는 경계를 유지했다.                                   | 중요한 업무 발견과 큐 진입                                                              | 독립 업무 dashboard, KPI 카드·장식 차트, AI 자동 집계                    |
| 11 선택 업무 AI    | 맥락 preview, 질문 입력·길이 검증, DWAI·ON handoff와 안전 문구를 구현했다.                                                         | 전달 맥락과 질문을 제출 전에 확인                                                       | 실시간 분석·검증 완료 초안·자동 폼 반영·감사 기록 완료                   |
| 12 모바일·접근성   | 390px과 실제 320px, mobile detail 왕복, form/dialog, focus, forced-colors, dark, 200% 상태를 코드에서 처리했다.                    | M1/M2의 여정 순서와 touch/focus 요구                                                    | 디자인 자체의 WCAG·0px overflow 선언을 시험 증거로 사용                  |

## Stitch completeness와 사용 원칙

확보한 결과는 18개 `code.html`과 18개 `screen.png`다. 무결성·출처·실제 치수는 [design-reference README](../design-reference/README.md)와 [manifest](../design-reference/manifest.json)에 기록했다.

- 모든 desktop 제목은 1440px을 주장하지만 실제 ReactFlow 래퍼는 1280px이다.
- M2는 320px을 주장하지만 실제 래퍼·HTML·원본 PNG는 390px이다.
- 06–11의 개별 mobile, 실제 320px, dark, 강제 고대비, 200% 확대 프레임이 없다.
- 04·05 desktop HTML은 1280px 재렌더에서 가로 overflow가 발생한다.
- mockup의 `실시간 동기화`, 법적 효력, 감사 로그 완료, 엔진·브리지 버전, 92% 성공 확률, AI 자동 반영은 운영 사실이 아니다.
- 시안의 #2563EB, Geist, Material Symbols 대신 DWP color/type/icon token을 사용한다.

따라서 Stitch는 구성과 정보 위계의 참고 자료다. API·권한·상태·문구·메뉴와 접근성 완료의 정본은 저장소 계약, 구현, 검증 결과다.

## 확정 데이터·행동 계약

| 항목             | 정확한 의미                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| 개인 상태        | `OPEN / IN_PROGRESS / WAITING / COMPLETED / ARCHIVED`. 개인 완료는 연결된 원본 완료가 아니다.                        |
| 개인 입력        | 제목 필수·공백 불가·최대 500자, 설명 선택·최대 10,000자, 우선순위 `LOW / NORMAL / HIGH / URGENT`.                    |
| 변경·재시도      | 현재 version과 UUID Idempotency-Key를 사용한다. 응답 유실로 같은 명령을 재확인할 때만 기존 본문·키를 재사용한다.     |
| 원본 참조 해제   | update의 `sourceReference: null`은 기존 링크 유지다. `clearSourceReference: true`만 명시적 해제다.                   |
| 계획             | 날짜별 최대 100개, 동일 원본+의무 중복 금지, 전체 순서와 version 저장. 원본 기한·lifecycle·Calendar 시간과 독립이다. |
| 접근 불가 계획   | 불투명 `DAY_PLAN_SELECTION` 참조로 기존 선택을 보존한다. token은 사용자 표시·입력 대상이 아니다.                     |
| `AVAILABLE`      | 현재 원천 접근 가능성을 확인한 상태다. 모든 행동 권한의 자동 허용은 아니다.                                          |
| `REFERENCE_ONLY` | 개인 참조만 보유한다. 원본 권한·최신 내용 확인 전이며 임의 title/status/due/route를 만들지 않는다.                   |
| `UNAVAILABLE`    | 현재 원천을 확인할 수 없다. 정상 0건이나 완료로 바꾸지 않는다.                                                       |
| Calendar         | 개인 비공개·반복 없음·참석자 없음의 집중시간과 Work 관계다. 업무 상태·기한·계획을 변경하지 않는다.                   |
| AI               | 최신 한 건의 허용된 최소 맥락을 질문으로 전달한다. 원문 전체 열람·원본 행동 실행·최종 결정이 아니다.                 |

## 검증 증거의 해석

최종 전문가 보완까지 반영한 결과는 Work frontend 17개 파일·83개 테스트, backend 14개 suite·102개 테스트, desktop·mobile Work E2E 40개 통과와 조건상 불필요한 4개 의도적 skip, product-artifact runtime 6개 통과, Vite production compile 통과다. 자세한 실행 범위와 저장소 전체 공통 gate의 별도 잔여는 [디자인 구현 마감](../2026-09-04-design-implementation-closeout.md)의 최종 검증 표에 기록한다.

고정 fixture 브라우저 검증은 운영 Gateway, 고객 데이터, 실제 결재·서비스 원천, 실제 보조기기, 운영 배포를 증명하지 않는다. 외부 출시 증적 37건은 별도 gate에서 BLOCKED다.

## 미지원·NO-GO

- Meeting owner-source는 내부 resolve/read만 지원한다. CREATE는 `AUTHORITY_UNVERIFIED`, REASSIGN은 `TARGET_ELIGIBILITY_UNVERIFIED`이며 둘 다 **NO-GO**다.
- Mail·Messaging 원문에서 Work 할 일을 만드는 캡처 진입은 아직 제공하지 않는다.
- 모든 결재·서비스·권한 업무에 적용되는 범용 직접 승인·반려·보완·완료는 제공하지 않는다.
- 외부 운영 배포, 실제 고객 원천 연결과 출시 증적은 이 화면 구현 완료에 포함되지 않는다.

## 코드 근거

- 페이지·route: `apps/dwp/src/pages/work.tsx`, `apps/dwp/src/routes/work-routes.tsx`, route와 menu manifest.
- runtime·model: `apps/dwp/src/features/work-hub/use-work-hub-runtime.ts`, `work-hub-loader.ts`, `work-hub-model.ts`, `work-hub-controller.ts`, `work-hub-refresh-policy.ts`.
- 화면: 같은 폴더의 `work-hub-list.tsx`, `work-hub-detail-panel.tsx`, `work-task-dialog.tsx`, `work-today-plan-panel.tsx`, `work-hub-schedule-dialog.tsx`, `work-hub-schedule-links.tsx`, `work-hub-assist-dialog.tsx`, `work-hub-source-status-dialog.tsx`, `work-hub-batch-dialog.tsx`.
- 원천·명령: `work-hub-source-adapters.ts`, `work-hub-source-hydration.ts`, `work-hub-source-owned-detail.tsx`, `work-hub-actions.ts`, `use-work-hub-batch.ts`.
- 브라우저 여정: `e2e/work-hub-foundation.spec.ts`, `e2e/support/work-hub-foundation-fixtures.ts`, `e2e/product-artifact-runtime.spec.ts`.
