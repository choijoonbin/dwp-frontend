# 업무 앱: 통합업무함 고도화

기준일: 2026-09-07. 사용자가 승인한 디자인 기준은 **18개 프레임과 6개 업무 메뉴**다.

업무 앱은 여러 원천에 흩어진 내 처리 책임을 모아 검토와 실행으로 연결한다. 개인 할 일·체크리스트·오늘 계획과 Access Review는 Work가 소유한다. 결재·서비스 요청은 Work가 명령을 복제하지 않고 검증된 원본 URL로 문서 handoff하며 각 소유 앱에서 실행한다. Calendar는 수행 시간을, Flow는 요약과 진입을, DWAI·ON은 분석과 초안을 담당한다.

## 현재 제공 구조

- 통합업무함 `/work/queue`
- 내 조치 대기 `/work/action-required`
- 오늘 계획 `/work/day-plan`
- 진행 중 `/work/in-progress`
- 응답 대기 `/work/awaiting-response`
- 완료된 업무 `/work/completed`

이 메뉴와 별개로 결재·접근권한·서비스·개인 업무 상세, 생성/편집, Calendar 연결, 원천 상태·일괄 결과, 선택 업무 AI가 실제 데이터·명령 흐름으로 이어진다. 모바일에서는 전체 상세와 하단 탐색·더보기를 제공한다.

## 구현과 확인 자료

- [업무 앱 자체 고도화 최종 마감 및 외부 작업 요청](2026-09-07-owned-scope-closeout.md)
- [중단 작업 재개·최종 개발 및 검증 보고](2026-09-07-resume-closeout.md)
- [2026-09-07 구현 정정·18개 화면 추적표](2026-09-07-design-remediation.md)
- [최신 원본과 실행 화면 대조 갤러리](implementation-evidence/2026-09-07-resume/index.html)
- [최종 검증 결과](implementation-evidence/2026-09-07-resume/validation.json)
- [업무 자체 범위 최종 검증 결과](implementation-evidence/2026-09-07-resume/owned-scope-final/validation.json)
- [원본 18개 프레임의 출처·치수](design-reference/manifest.json)
- [서비스 보완 제출의 정식 권한 활성화 검토 자료](2026-09-07-service-response-activation.md)

2026-09-04의 단일 메뉴 결정과 디자인 완료 판정은 폐기했다. 당시 문서는 변경 원인과 과거 실행 증거를 보존하는 기록이며 현재 구현 기준이 아니다. 모든 운영 연결 및 픽셀 오차 0%를 완료로 주장하지 않는다. 원천 API 미제공 데이터, Flow 전체 외형 차이, 서비스 v6 활성화 대기는 위 정정 문서에 구분했다.
