# DWP-R1-AI-001 API·권한 계약

## 외부 계약

`POST /api/agent/v1/ask`

- Browser는 Session Cookie와 CSRF Token을 사용한다.
- Gateway는 Browser의 내부 Identity Header를 제거하고 Auth Service에서 확인한
  Tenant, User, Role, `APP.*` Permission과 Correlation ID를 주입한다.
- Agent는 Gateway Service Token이 없거나 다르면 `401`을 반환한다.

## 내부 조회 계약

Agent Runtime Token은 다음 두 읽기 경로에만 허용한다.

- `GET /v1/workspace/work-items`
- `GET /v1/workspace/productivity/items`

향후 추가되는 `/v1/workspace/**` 경로는 자동 허용하지 않는다. 각 Domain Controller는
전달된 Permission을 다시 검사하며 Runtime Token의 쓰기 요청은 거부한다.

## 응답 불변식

- `COMPLETED`: Policy `ALLOW`, Model `COMPLETED`, Confidence와 Citation 1개 이상
- 그 외 상태: Answer·Confidence·Citation 없음
- Citation 수는 조회 Source 수를 넘지 않음
- Browser도 동일 계약을 검증하고 모순된 응답은 `502` 수준의 계약 오류로 처리
