# PER 실제 계층 적용과 개인정보 경계 수정

2026-09-14 20:12 KST. 전체 G3 시작 승인이 아닌 실제 PER 시작 화면의 제한적 준비 검증이다.

- 기존 flat baseline 고유36개를 UTC10:39:07.197–10:39:14.046에 실제 실행하여 모두 통과했다. API/hooks/model/components/pages/testing/public-index로 실제 적용한 뒤 동일36 이름이 UTC10:43:20.632–10:43:26.522에 모두 통과했다. 각각 전체 원문과 feature UTF8·전후 SHA/ns를 별도 보존했다.
- 수정 전에 개인정보·잘못된 원천·civil DATE·unmount 22개를 추가했다. UTC11:05:52.913–11:05:59.325/6.412초에 실제58 중 기존36 PASS/추가22 FAIL/skip0이었다. `frontend-performance-privacy-root-actual-fail-before-2026-09-14.json`의 전체 9 ACK 청크·원본 stdout/stderr·58 case·10 source UTF8·17 SHA/ns manifest를 복원 검증했다.
- `selectPerformancePersonalGoals`는 unknown 원천에서 허용된 employee displayName/organizationName, goal의7개 필드만 새 불변 객체로 복사한다. adjacent-domain·계좌·privateReview·원천 객체 alias를 저장하지 않는다. 비primitive·NaN/Infinity·범위 밖 진행률·unsafe/fractional/negative version·중복ID·sparse 배열·문자열 boolean·잘못된 Gregorian 날짜를 값 노출 없이 거부한다. 불명확한 상태는 기존 읽기 전용 동작을 유지하고 100% 진행률을 자동 완료 상태로 바꾸지 않는다.
- 읽기와 기존 governed mutation 반환값 모두 query/mutation cache에 저장하기 전에 동일 projection을 거친다. 원본 DTO cache와 혼동하지 않도록 `personal-goals-v2`와 전체 native scope identity를 cache key에 둔다. 화면 unmount 또는 scope 변경 후 성공·실패 UI/cache settlement를 차단한다. 서버에서 이미 실행된 mutation 취소까지 보장한다는 뜻은 아니다.
- goal dueDate는 공개 `formatCivilDate`로 표시하여 America/Los_Angeles 등의 지역 timezone이 날짜-only 값을 전날로 바꾸지 않는다. 실제 Instant formatter는 변경하지 않는다. provenance는 화면 metadata이며 native authorization/source attestation이 아니다. 관측 REFERENCE는 declared SOURCE로 승격할 수 없다.
- UTC11:10:49.489–11:10:58.346/8.857초에 동일58 이름 모두 PASS/0error,skip 및17 SHA/ns 전후 동일이었다. 원36의 employee identity assertion은 필요한 두 필드 equality와 nonalias assertion으로 강화하고 scope-change cache equality2개는 정확한 privacy view model로 교체했다. 기능 expectation을 약화하거나 이러한3개 privacy expectation 변경을 원문 무변경으로 주장하지 않는다. 새22 기대값은 동일하다.
- `readback_performance_privacy_2026_09_14.py`의 saved-file readback도 실제 exit0이다. 압축/원문 SHA·byte 수·9 ACK 순서·원본 콘솔·58 unique case identity·전후 manifest·10 UTF8 및 after 현행 source를 확인했다. before archive SHA `01f3885a701358e1a1ee964ed4d4978fbafa9927cf2d8f96661a1a0273e728e4`, after `6dae5cbd803e6b1b849344c09681fe94016866b9a972b55e356892b9bfcba924`.

한계: API/권한은 명시 mock이고 native source 호출0이다. 새 PER 변경 포함 전체 TypeScript/품질/실제 AST 계층 검사·독립 전문가 재검토·현재 browser와 전체 shell 접근성·G4 전체 성과 메뉴는 아직 이 결과로 승인하지 않는다. G3 CLOSED_FAIL_SAFE / five NO_G3_START / G4 whole not started / G6 unauthorized.
