# FEAT-ACT-001 공통 실행·변경 이력 기반

2026-09-04. 기능 기반과 사용자가 전달한 Stitch 4개 화면의 제품 의도를 DWP 디자인 시스템으로 구현했다. 이는 로컬 개발·검증 완료 상태이며 운영 배포 승인을 의미하지 않는다.

활동을 별도 업무/일정/알림 앱으로 확대하지 않는다. Flow는 발견, Work는 업무 맥락, DWAI·ON은 AI 실행 원장, 공통 상세는 사실·현재 상태·근거·원본 연결을 담당한다.

## 문서

- [기획 정의](<01-기획 정의.md>)
- [화면 계약](<02-화면 설계서.md>)
- [디자인 인계](<03-디자인 정의.md>)
- [데이터 계약](<04-데이터 설계.md>)
- [API·권한 계약](<05-API 권한 계약.md>)
- [Agent 원천 계약](<06-AI Agent 계약.md>)
- [수용 테스트와 출시 조건](<07-수용 테스트.md>)
- [Stitch 구현 추적표](<08-Stitch 구현 추적표.md>)

구현 상세: [백엔드 계약](/Users/a10697/Work/DWP/dwp-backend/docs/workspace/activity-history-contract.md), [Agent 운영 게이트](/Users/a10697/Work/DWP/dwp_agent/docs/DWAI_ON_PRODUCTION_GATE.md).

디자인 전달물: [화면별 프롬프트](/Users/a10697/Work/DWP/output/activity-foundation-2026-09-04/design-prompts/README.md). 구현 결과: [검증 보고서](/Users/a10697/Work/DWP/output/activity-foundation-2026-09-04/implementation-report.md).

## 결정 기록

1. 원본 복제 원장을 새로 만들지 않는다. Workspace 변경은 해당 DB, Agent 실행은 실제 Agent 원장에서 읽는다.
2. 업무 변경 사건의 완료와 업무 자체의 완료를 분리한다. 과거 사건 수를 현재 실행 건수로 계산하지 않는다.
3. 원본 권한을 입증할 수 없는 외부 업무 projection은 이번 조회 범위에서 제외한다. 삭제하거나 권한을 확대하지 않는다.
4. Agent의 현재 snapshot을 불변 lifecycle 이력으로 표시하지 않는다. 기록되지 않은 과거 단계·결과·감사 ID를 합성하지 않는다.
5. 기존 활동 경로/저장뷰는 유지한다. Flow에는 현재 확인 신호를, Work에는 지원되는 네이티브 업무의 공통 이력 연결을 배치한다.
6. 운영 원장·공유 서비스에는 이 작업에서 직접 배포하지 않았다. 테스트용 DB는 격리했고, 커밋하지 않았다.
