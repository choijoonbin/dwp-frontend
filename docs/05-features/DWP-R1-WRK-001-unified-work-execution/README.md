# 업무 앱: 통합업무함 고도화

2026-09-09 **CURRENT REMEDIATION**. 사용자 중단 전 라이브 Stitch 프로젝트를 직접 감사해 보관 기준과 같은 18/18 노드를 확인했고, 6개 메뉴·6개 경로와 Work가 소유하는 현재 계약을 다시 대조했다. Meeting 출처 `WORK_ASSIGNMENT`의 역할별 목록·상세·수락/수행 두 상태 축·활성 명령·receipt/409/권한 회수 복구·반응형 접근성 보완을 완료했다. [현재 완료 보고](2026-09-09-stitch-completion-remediation.md) · [라이브 감사](implementation-evidence/2026-09-08-stitch-completion/live-stitch-audit.json) · [현재 검증 상태](implementation-evidence/2026-09-08-stitch-completion/validation.json)

최종 검증은 전체 Work·교차 제품 브라우저 346건(322 통과·명시적 중복 제외 24·실패/불안정 0), 전체 단위 546파일/4,459건, 비증분 TypeScript, 배정 backend 42건, production build·정적 gate·형식·소스 무결성을 모두 통과했다. CREATE/by-source와 REASSIGN은 Meeting authority·People 대상자 적격성·안전한 대상 선택 계약이 없어 외부 **NO-GO**이며 Work UI 누락이 아니다. 현재 판정도 `pixelPerfect=false`, `liveTenant=false`, `productionDeploy=false`다.

## 2026-09-08 기록 스냅샷

기준일: 2026-09-08. **WORK_OWNED_COMPLETE**. 승인 디자인 기준인 **18개 참조 프레임과 6개 업무 메뉴**의 Work 자체 구현·필수 로컬 검증을 마쳤다. 실제 테넌트 또는 픽셀 동일성 인증은 아니다.

검증 범위는 2026-09-08 기록 소스 스냅샷(`4cdc185b3d2e0040720a45a21691878a2c48ef6a6f5fa9e1bf1f359fea8f68f2`)이다. `WORK_OWNED_COMPLETE`는 이 스냅샷에서의 Work 완료 상태이며, 동결 해제 이후 변경된 작업 트리까지 검증했다는 뜻은 아니다. 스냅샷 검증 상태: `PASS_AT_RECORDED_WORKTREE_SNAPSHOT`.

업무 앱은 여러 원천에 흩어진 내 처리 책임을 모아 검토와 실행으로 연결한다. 개인 할 일·체크리스트·오늘 계획과 Access Review는 Work가 소유한다. 결재·서비스 요청은 Work의 풍부한 읽기 전용 원천 상세에서 검토한 뒤 검증된 원본 URL로 handoff하며, 승인·반려·서비스 응답은 각 소유 앱에서 실행한다. Calendar는 수행 시간을 연결하고, 공유 Home이 Flow 업무 기여를 소유한다. 선택 업무 AI는 답변 읽기·출처 확인·복사·대화 이어가기를 제공하며 Work 폼에 초안을 직접 적용하지 않는다.

## 기록 스냅샷의 제공 구조

- 통합업무함 `/work/queue`
- 내 조치 대기 `/work/action-required`
- 오늘 계획 `/work/day-plan`
- 진행 중 `/work/in-progress`
- 응답 대기 `/work/awaiting-response`
- 완료된 업무 `/work/completed`

결재·서비스 상세는 읽기 전용 원천 증거와 소유 앱 handoff를 제공한다. Work가 소유하는 접근권한·개인 업무 상세, 생성/편집, Calendar 연결, 원천 상태·지원 항목 일괄 결과는 각 계약에 맞는 데이터·명령 흐름으로 이어진다. 선택 업무 AI는 읽기·출처·복사·이어가기 범위다. 모바일에서는 전체 상세와 하단 탐색·더보기를 제공한다.

## 구현과 확인 자료

Work 단위 703개, 전체 단위 4235개, 브라우저 230개가 통과했다. 브라우저의 명시적 중복/프로젝트별 제외는 16개이며 실패·불안정은 0이다. 비증분 TypeScript·전체 및 Workspace build·정적 검사·형식 검증도 통과했다. 개인 업무에서도 원천을 정확히 지정한 Activity 기록과 원래 업무 포커스로 왕복한다.

- [2026-09-08 기록 스냅샷 18프레임 비교 갤러리](implementation-evidence/2026-09-07-resume/owned-scope-final/gallery-2026-09-08/index.html)
- [기록 갤러리 출처·치수·SHA256](implementation-evidence/2026-09-07-resume/owned-scope-final/gallery-2026-09-08/manifest.json)

- [업무 앱 자체 범위 마감 기록](2026-09-07-owned-scope-closeout.md)
- [2026-09-07 재개 개발·검증 기록 (HISTORICAL / SUPERSEDED)](2026-09-07-resume-closeout.md)
- [2026-09-07 구현 정정·18개 화면 과거 추적표](2026-09-07-design-remediation.md)
- [2026-09-07 원본과 실행 화면 대조 갤러리 (HISTORICAL / SUPERSEDED)](implementation-evidence/2026-09-07-resume/index.html)
- [2026-09-07 검증 스냅샷 (HISTORICAL / SUPERSEDED)](implementation-evidence/2026-09-07-resume/validation.json)
- [업무 자체 범위 최종 검증 결과](implementation-evidence/2026-09-07-resume/owned-scope-final/validation.json)
- [원본 18개 프레임의 출처·치수](design-reference/manifest.json)
- [폐기된 Work 서비스 응답 경로의 권한 활성화 검토 기록](2026-09-07-service-response-activation.md)

2026-09-04의 단일 메뉴 결정과 2026-09-07의 Work 직접 결재·서비스 응답 및 AI 초안 적용 판정은 폐기했다. 당시 문서·캡처·해시는 변경 원인과 과거 실행 증거를 보존하는 **HISTORICAL / SUPERSEDED** 기록이며 기록 스냅샷의 UI 증거가 아니다. 이 스냅샷의 기준은 6개 Work 경로, 결재·서비스 읽기 전용 상세와 소유 앱 handoff, 선택 업무 AI 읽기·출처·복사·이어가기, 공유 Home의 Flow contribution이다.
