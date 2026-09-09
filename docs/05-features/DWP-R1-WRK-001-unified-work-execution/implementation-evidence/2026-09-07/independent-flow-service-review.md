# Flow 서비스 보완 진입 검토 — HISTORICAL / SUPERSEDED

이 문서는 2026-09-07 당시 폐기 전 Work 서비스 응답 경로를 검증한 과거 기록이다. 아래 테스트 결과와 `screens/10-*.png` 캡처·해시는 당시 산출물만 식별하며 현재 UI를 증명하지 않는다.

## 현재 제품 계약 · 2026-09-08

- Flow 업무 contribution은 Work가 아니라 공유 Home이 소유한다.
- 공유 Home에서 Work로 진입한 결재·서비스 원천 상세는 풍부한 읽기 전용 화면이다.
- 승인·반려·서비스 응답은 검증된 원본 URL로 소유 앱에 handoff한 뒤 실행한다. Work에는 승인·반려·서비스 응답 폼이나 제출 명령이 없다.

## 2026-09-07 과거 검증 기록

경로·아키텍처 전문 에이전트의 당시 검증 결과이며 root가 변경 코드와 브라우저 검증문을 재검토했다.

- `AWAITING_REQUESTER`만 Work VIEW 권한이 있는 RESPONSE 진입과 기존 Services REQUEST 대안을 갖는다.
- 원천 Services 권한을 provider 경계에서 먼저 확인한다. Work 권한이 없거나 명시적 DENY이면 기존 Services 상세를 유지한다.
- 같은 SERVICE 참조를 중복 제거해 최종 1개 링크를 표시한다. 일반 요청·종결 제외·부분 수신·개인정보 분류는 유지한다.
- 단위 테스트 3파일 33/33 PASS, 변경 파일 ESLint PASS.
- 4211 Chromium에서 당시 10 Flow E2E 1/1 PASS: 개인 업무/계획 왕복과 함께 서비스 링크 1개→정확한 Work item→현재는 폐기된 편집 가능 보완 사유 필드, 조회 중 mutation 0건을 확인했다.
- 이 결과는 현재 Work 서비스 응답 기능이나 정식 v6 권한 활성화의 증거가 아니다.

검증 파일: `home-contribution-provider-routing.test.ts`, `home-contribution-provider-registry.test.ts`, `flow-home-model.test.ts`, `e2e/work-stitch-design-sync.spec.ts`.
캡처는 과거 증거로 `screens/10-D.png`, `screens/10-D-full.png`, `screens/10-service-response.png`에 보존했다.
