# 디자인 목표와 실제 구현 확인표

2026-09-09 현재 라이브 Stitch 프로젝트를 사용자 중단 전에 직접 감사해 보관 manifest와 같은 **18/18 노드**를 확인했다. 현재 제품은 **6개 메뉴·6개 경로**와 Work 소유 계약을 유지하며, Meeting 출처 배정 업무의 목록·상세·명령·복구·반응형 변형을 추가로 닫았다. [현재 완료 보고](../2026-09-09-stitch-completion-remediation.md) · [라이브 감사](../implementation-evidence/2026-09-08-stitch-completion/live-stitch-audit.json) · [현재 검증 상태](../implementation-evidence/2026-09-08-stitch-completion/validation.json)

중단 뒤 라이브 UI 재확인은 잠긴 Mac 때문에 실행하지 못했으며, 감사 기록은 중단 전 완료한 직접 대조만 근거로 한다. `pixelPerfect=false`, `liveTenant=false`, `productionDeploy=false`이고 controlled fictional fixtures를 사용한다. 200% 증거는 CSS zoom 근사이며 axe는 `main` 범위 critical/serious 위반 0만 판정한다. 최종 검증은 전체 Work·교차 제품 브라우저 346건, 전체 단위 4,459건, backend 배정 42건, 타입·build·정적 gate·형식·무결성을 통과했다. CREATE/by-source와 REASSIGN은 현재 Meeting authority·People 대상자 적격성·안전한 선택 계약이 없어 외부 **NO-GO**이며 디자인이나 Work UI 구현 누락으로 세지 않는다.

## 2026-09-08 기록 스냅샷

2026-09-08 **WORK_OWNED_COMPLETE**. 기록 스냅샷의 제품 계약과 최종 성공 실행으로 검증했다. 승인 디자인 기준은 **18개 참조 프레임**이고 기록 스냅샷의 Work 탐색은 **6개 메뉴·6개 경로**다. 01–12는 프롬프트 묶음 번호로서 프레임 수와 다르다.

검증 범위는 2026-09-08 기록 소스 스냅샷(`4cdc185b3d2e0040720a45a21691878a2c48ef6a6f5fa9e1bf1f359fea8f68f2`)이다. `WORK_OWNED_COMPLETE`는 이 스냅샷에서의 Work 완료 상태이며, 동결 해제 이후 변경된 작업 트리까지 검증했다는 뜻은 아니다. 스냅샷 검증 상태: `PASS_AT_RECORDED_WORKTREE_SNAPSHOT`.

[2026-09-08 기록 스냅샷 18프레임 갤러리](../implementation-evidence/2026-09-07-resume/owned-scope-final/gallery-2026-09-08/index.html) · [최종 검증 JSON](../implementation-evidence/2026-09-07-resume/owned-scope-final/validation.json) · [마감 기록](../2026-09-07-owned-scope-closeout.md)

[2026-09-07 화면 구현 정정·검증](../2026-09-07-design-remediation.md), [실행 갤러리](../implementation-evidence/2026-09-07/index.html), [검증 manifest](../implementation-evidence/2026-09-07/manifest.json)는 **HISTORICAL / SUPERSEDED** 증거다. 그 안의 캡처와 해시는 2026-09-07 당시 산출물만 식별하며 2026-09-08 기록 스냅샷의 UI를 증명하지 않는다.

| 묶음 | 기록 스냅샷의 구현 계약                                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------- |
| 01   | 독립 6개 메뉴·경로, 역할별 목록, 검색·필터·정렬·밀도·계획 선택과 실제 조작                                                      |
| 02   | 결재 근거·결재선·양식·이력을 풍부한 읽기 전용 상세로 제공하고 검증된 Approvals 원본으로 handoff. Work 승인·반려·보완 요청 없음  |
| 03   | 접근권한 근거·사유·고정된 미리보기·최신 권한/버전 재검증·제출과 정확히 결속된 응답·결정 및 반영 상태                            |
| 04   | 서비스 요청·보완 근거·현재 상태를 풍부한 읽기 전용 상세로 제공하고 검증된 Services 원본으로 handoff. Work 서비스 응답·제출 없음 |
| 05   | 개인 상태·내용·복수 원천·체크리스트·삭제 확인·정확한 PERSONAL_TASK Activity 기록과 포커스 복귀                                  |
| 06   | 개인 업무 생성/캡처/편집 양식·우선순위·기한·체크리스트·원천 검색·입력 보존·원문 없는 v2 생성 복구 저장소                        |
| 07   | 독립 오늘 계획, 실제 지표·계획/후보·필터·순서 변경·버전 충돌 복구·직렬 생성/계획 경쟁·PUT 직전 재검증·정상 초기 null timestamp  |
| 08   | Calendar와 수행 시간 검토, event/link 분리·부분 성공 복구·최신 capability/관계 버전 재검증                                      |
| 09   | 원천별 상태·범위·재조회와 지원 항목의 v3 일괄 결과·제한적 재시도·aggregate/source 장애 시 변경 차단과 읽기 전용 복구            |
| 10   | 공유 Home이 소유하는 Flow contribution에 개인 업무·계획 진입을 제공하고 Work와 왕복. 독립 Work Flow 화면이 아님                 |
| 11   | 선택 업무 AI 답변 읽기·출처 확인·복사·대화 이어가기. Work 폼으로 초안을 직접 적용하거나 원천 명령을 실행하지 않음               |
| 12   | M1 권한 검토 결정, M2 390/320px 입력 높이 축소·키보드·포커스 여정                                                               |

원본의 실제 모바일은 01–05 및 M1/M2이다. 실제 320px, dark, forced-colors, 200% 프레임은 디자인 세트에 제출되지 않았다. 예시 수치·첨부·권한 반영·AI 자동 실행을 운영 사실로 하드코딩하지 않는다. [2026-09-07 서비스 응답 권한 활성화 자료](../2026-09-07-service-response-activation.md)는 폐기된 Work 서비스 응답 경로의 과거 검토 기록이며 현재 릴리스 조건이 아니다.

최종 갤러리는 Chromium의 실제 React 캡처 18개(데스크톱 11·모바일 폭 7)이며 전체 13 spec의 Chromium/iPhone 13 WebKit 실행이 통과한 같은 실행에서 추출했다. 모든 원본·구현 PNG와 manifest의 SHA256·치수를 검증했다. `pixelPerfect=false`, `liveTenant=false`이며 controlled fictional fixtures를 사용했다. 200% 및 키보드 축소 검증의 근사 방식과 명시적 skip 범위는 최종 validation에 기록했다.
