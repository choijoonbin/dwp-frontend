# HRM-012 Frontend module result

HRM-012의 비마운트 인력 데이터 품질 워크벤치를 실행 토큰의 경계 안에서 구현했습니다. 기능은 기본 OFF·tenant enrollment 0을 유지하며, 비활성 상태에서는 owner API를 호출하지 않습니다.

## 구현 범위

- IAQ-012 전용 GET 계약, 엄격한 request/projection parser, typed VIEW/MASK와 OMIT 비노출
- scope 또는 decision revision 변경 시 이전 projection, cursor history, as-of를 모두 폐기하는 read hook
- loading, complete, empty, partial, unavailable, denied, stale의 7개 상태
- 데스크톱 grid와 compact list를 공유하는 읽기 전용 list-detail inspector
- 1440/1280/390/320 레이아웃, 200% 텍스트 크기, light/dark, forced colors, reduced motion, keyboard focus, 긴 한국어·영어 문구 검증
- route/menu/shell/global i18n/tenant enrollment 변경 없음, POST/action/retry/replay UI 없음

## 검증 결과

- 계약 5개, API 3개, workbench 14개, slice 5개로 총 27개 논리 테스트를 제한된 표적 실행에서 통과했습니다.
- 최초 실패 뒤에는 통과한 대상을 다시 실행하지 않고, 영향을 받은 파일 또는 named case만 최소 재실행했습니다.
- 변경 root TypeScript, ESLint, Prettier와 `git diff --check`가 통과했습니다.
- 저장소 전체 테스트와 브라우저 route 검증은 실행하지 않았습니다. 이 기능은 중앙 승인 전까지 비마운트·기본 OFF 상태입니다.

## 인수조건 경계

- AC-01과 AC-02의 frontend 계약·노출 경계를 충족했습니다.
- AC-12의 7-state, responsive/accessibility, default-OFF zero-call 요구를 충족했습니다.
- AC-03~AC-11 및 corrective AC-13은 backend/V60 범위이므로 이 증적에서 완료로 주장하지 않습니다.

상세 기계 판독 증적은 `frontend-module-result.v1.json`에 기록했습니다.
