# Work Stitch remaining-frame acceptance

검증 기준 ZIP은 SHA-256 `970a1f72bfb04783a611c67d9d08eaf6b6a51befc86bd947bbea56647055e570`의 `stitch_enterprise_grid_calendar_application.zip`이다. 이 문서는 D01, D03, D04, F01, R01, H01, A01의 Work 소유 범위를 해당 frozen ZIP의 `screen.png`와 `code.html`에 직접 대조한 결과다.

## 프레임별 결과

| 프레임                            | 기준 화면                                         | 구현·대조 결과                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 증거                                                                                                                                                              |
| --------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D01 Approval detail               | `dwp_02._1440px_wrk_d01`, `dwp_02._390px_wrk_d01` | 승인 문서 번호, 기안자·부서, 워크플로 단계, 위험 점수, 품의 값, 원천 이력, 원본 handoff를 구현했다. 데스크톱은 기준처럼 목록보다 상세를 넓게 배치하고 좁은 목록에서도 5열 정보 구조를 유지한다.                                                                                                                                                                                                                                                                      | `screens/remaining-frames/wrk-d01-1440.png`, `wrk-d01-390.png`                                                                                                    |
| D03 Service response              | `dwp_04._1440px_wrk_d03`, `dwp_04._390px_wrk_d03` | 원천 요청·보완 사유·현재 값·처리 이력과 실제 응답 양식을 한 상세 흐름으로 묶었다. 검토 전 POST 금지, 명시적 제출, 확정 receipt, 409 입력 보존·새 버전 재검토, exact-action 권한 회수 차단을 확인했다.                                                                                                                                                                                                                                                                | `wrk-d03-1440.png`, `wrk-d03-390.png`, `wrk-d03-review-1440.png`, `wrk-d03-receipt-1440.png`, `wrk-d03-conflict-390.png`                                          |
| D04 Personal task detail          | `dwp_05._1440px_wrk_d04`, `dwp_05._390px_wrk_d04` | 상태 단계, 우선순위·기한, 설명, 원문 연결, 체크리스트 진행률, 변경 이력, 편집·삭제·완료·보관·일정·활동을 상세 우선 배치로 구현했다.                                                                                                                                                                                                                                                                                                                                  | `wrk-d04-1440.png`, `wrk-d04-390.png`                                                                                                                             |
| F01 Messenger capture             | `dwp_06._1440px_wrk_f01`                          | A 새 업무/B 원천 연동/C 편집 진입 모드를 명시했다. B→A는 원천을 분리하고 A→B는 정확한 opaque source reference를 복구하며 C는 편집 때만 활성화된다. identity-only route state, owner/TTL/preflight, provenance 영속화와 현재 사용자 기준 재수화, deep link를 검증했다.                                                                                                                                                                                                | `screens/f01-exact/wrk-f01-ko-1440.png`, `wrk-f01-ko-390.png`, `wrk-f01-ko-320.png`                                                                               |
| R01 Source status + batch receipt | `dwp_09._1440px_wrk_r01`                          | 접근 가능한 Sources/Results 탭을 추가해 최초 진입은 Sources, 완료·재개는 Results에 맞췄다. 성공·충돌·권한·미확정·제외 집계, 부분 원천 장애, durable receipt, `UNKNOWN` receipt만 동일 idempotency key로 재확인하는 흐름을 검증했다.                                                                                                                                                                                                                                  | `wrk-r01-1440.png`, `wrk-r01-results-1440.png`, `wrk-r01-partial-unknown-390.png`, `wrk-r01-partial-unknown-sources-390.png`, `wrk-r01-partial-recovered-390.png` |
| H01 Home contribution             | `dwp_10._flow_1440px_wrk_h01`                     | 권한을 통과한 승인·권한 심사·개인 할 일·서비스 보완을 하나의 Work 카드에 합성한다. 전체/긴급 승인/권한 심사/개인 할 일 네 필터와 source identity 기반 CTA를 canonical route에 연결했다. 정확한 헤더 CTA `통합업무함 열기`는 `APP.WORK` 권한이 있을 때만 노출한다. 항목이 4개를 넘으면 stable priority로 중요한 보완 요청을 첫 네 건에 유지한다. 320px에서는 네 필터를 모두 보이고 200% 확대에서는 읽을 수 있는 단일 열로 전환한다. 다른 응답 카드의 중복도 제거했다. | `wrk-h01-1440.png`, `wrk-h01-390.png`, `wrk-h01-320.png`, `wrk-h01-zoom-200.png`, `wrk-h01-dark-390.png`, `wrk-h01-forced-colors-390.png`                         |
| A01 contextual assist             | `dwp_11._dwai_on_1440px_wrk_a01`                  | 기준의 상세+assistant 2열 구조, 선택 업무 identity, 추천 질문, 검증 답변, 근거, 복사, 전체 대화 전환, Service 보완 폼으로의 명시적 draft 적용을 구현했다. draft 적용만으로 원천 mutation은 발생하지 않는다.                                                                                                                                                                                                                                                          | `wrk-a01-1440.png`, `wrk-a01-draft-applied-1440.png`, `wrk-a01-390.png`, `wrk-a01-320.png`                                                                        |

## 반응형·접근성 대조

`work-detail-stitch-frames.spec.ts`는 D01/D03/D04를 1440, 1280, 390, 320, CSS 200%, dark 390, forced-colors 390에서 fixture-backed 실제 route로 캡처한다. 모든 변형에서 문서 가로 overflow가 1px 이하이고, 1440 상세 영역의 WCAG A/AA serious·critical 위반은 0건이다. 버튼 또는 입력의 실제 키보드 focus도 각 프레임에서 확인한다.

`work-stitch-design-sync.spec.ts`는 H01 canonical return과 A01 질문→답변→draft 적용→Service 검토→원천 receipt 흐름을 1440, 1280, 390, 320, 200%에서 실행하고 dark/forced-colors의 keyboard drawer와 접근성까지 확인한다. `work-source-batch-r01.spec.ts`는 R01을 같은 변형에서 실행한다.

`home-work-action-card.spec.ts`는 H01 카드의 네 필터 수치, 필터별 결과, 네 CTA와 canonical destination, exact header CTA, `APP.WORK` gate, 4개 초과 데이터의 stable priority와 서비스 보완 중복 제거를 검증한다. 1440, 390, 320, CSS 200%, dark, forced-colors에서 가로 넘침, 필터 가시성, 44px 탭 조작 영역을 확인하고, 키보드 탭 전환과 WCAG A/AA serious·critical 위반 0건을 함께 검증한다.

`work-source-batch-r01.spec.ts`는 Sources/Results 전환, 부분 장애와 복구, durable receipt 재개를 7/7로 검증한다. F01 대상 실행은 Messenger capture 6/6, A/B/C entry modes 6/6, canonical 1/1을 통과했다.

Q01/D01 공통 desktop list-detail 계층도 기준 화면의 약 5:7 비율로 고정했으며, 440px 이상의 desktop queue에서는 좁아져도 5열 목록 문맥을 유지한다. 수동 비교 후 갱신한 golden은 `screens/remaining-frames/wrk-q01-1440-golden.png`이고 `work-q01-p01-visual-parity.spec.ts` 6개 변형이 해당 결과를 재검증한다.

## 수동 비교 결론

직접 비교에서는 정보 계층, 넓은 화면의 목록/상세 비율, 모바일 단일 상세, 상태·기한·원천 표기, primary action 위치, assistant sidecar, batch receipt 집계가 기준 화면의 의도와 일치한다. 실제 제품은 공통 DWP shell, 동적 사용자·시각, tenant 구성, 권한 기반 action을 사용하므로 샘플 HTML의 문자열·고정 좌표를 그대로 복제하지 않는다.

첨부 frozen ZIP에 대한 현재 implementation 소유 범위에서 발견된 Work 소유 기능 누락과 열린 P0/P1/P2는 0건이며, 이 범위의 추가 제품 고도화는 필수가 아니다. 이 판정은 production release 승인과 별개다. 자동 픽셀 동일성, 디자이너 pixel sign-off, live tenant·외부 원천 검증, 배포 및 운영 smoke test는 별도 release acceptance가 필요하다.

## 실행 결과

- 최종 집중 Vitest: 30 files, 352 tests passed
- H01 집중 Vitest: 3 files, 28 tests passed; 위 352 tests의 부분 집합
- canonical Playwright: 46/46 passed
- H01 integrated: 7/7 passed; canonical과 1개 중복하므로 합산하지 않음
- R01 Sources/Results: 7/7 passed
- F01 Messenger capture: 6/6 passed
- F01 A/B/C entry modes: 6/6 passed
- F01 canonical: 1/1 passed; 대상 실행 간 중복이 있으므로 합산하지 않음
- `work-detail-stitch-frames.spec.ts`: 7 passed
- `work-q01-p01-visual-parity.spec.ts`: 6 passed
- backend Surefire: 208/208 passed
- Python devctl/service-boundary/OpenAPI-export: 88/88 passed
- OpenAPI: 9 services, 1043 Gateway paths
- screenshot decode/hash: 68/68 passed

원문 로그는 `logs/frontend-final-critical-e2e.log`, `logs/frontend-h01-final-integrated-e2e.log`, `logs/frontend-r01-tabs-e2e.log`, `logs/frontend-messenger-capture-e2e.log`, `logs/frontend-f01-entry-modes-e2e.log`, `logs/frontend-f01-exact-e2e.log`, `logs/frontend-remaining-detail-frames.log`에 보존한다.

## Production readiness 경계

내부 구현 증빙은 exact contracts 12/12, internal closure 12/12, PEP 60/60을 충족한다. 외부 release 증빙은 release-approved 0/12, product surfaces 0/37, incomplete 37, external evidence pending 18이다. 따라서 이 문서의 완료 판정은 implementation 소유 범위에 적용되며 실제 production 승인이나 배포 완료를 뜻하지 않는다.
