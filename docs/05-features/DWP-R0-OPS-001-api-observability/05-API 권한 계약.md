# 05 API 권한 계약

## 수집

내부 Collector는 관측 Token과 선언 Service Header를 요구하며 Batch 크기는 1~200건이다.
선언 Service와 모든 Event의 `serviceName`이 일치하지 않으면 Batch 전체를 거부한다.

## 조회

관리 API는 신뢰된 Gateway Service Identity, 검증된 User·Tenant Header와 관리자 Role을
요구한다. UI와 Navigation은 `ADMIN.API_MONITORING:VIEW` Resource Grant를 요구한다.
상세 조회는 URL의 ID만 신뢰하지 않고 현재 Tenant 조건으로 다시 조회한다.

Cursor는 Tenant, 시간, ID, Filter Fingerprint와 만료시각을 HMAC 서명하여 다른 Tenant나
Filter에 재사용할 수 없다.
