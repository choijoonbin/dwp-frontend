# DWP-R0-SEC-001 AI Agent 계약

## 적용 여부

Not applicable.

Browser Session 발급, Rotation, Idle 판정과 폐기는 결정적 보안 기능이다. LLM·Agent가
정책을 해석하거나 Session을 발급·연장·폐기하지 않는다.

향후 위험 기반 인증에서 AI 이상탐지를 사용하더라도 탐지 결과는 별도 Signal이며,
최종 정책 판정과 Session 조치는 Versioned Rule과 사람 승인 계약을 따른다.
