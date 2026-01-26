# Admin 모니터링 Summary API 스펙

> **API**: `GET /api/admin/monitoring/summary`  
> **목적**: 프론트엔드에서 각 응답 필드의 의미를 해석하고 올바르게 표시하기 위한 필드별 설명 문서.  
> **문서 위치**: `docs/api-spec` (본 저장소). BE 협업 시 FE 전달용으로 복사 가능.

---

## 1. 요청

| 항목 | 내용 |
|------|------|
| **Method** | GET |
| **Path** | `/api/admin/monitoring/summary` |
| **Query (optional)** | `from`, `to` (ISO-8601 UTC), `compareFrom`, `compareTo` (비교 기간) |
| **Header** | `X-Tenant-ID` 필수, JWT 인증 |

- `from`/`to` 미지정 시: **to** = 현재, **from** = to 기준 30일 전.
- `compareFrom`/`compareTo` 미지정 시: **현재 조회 기간과 동일 길이**의 직전 기간으로 자동 계산하여 delta에 사용.

---

## 2. 공통 응답 구조

```json
{
  "status": "SUCCESS",
  "message": "요청이 성공적으로 처리되었습니다.",
  "data": { ... },
  "timestamp": "ISO-8601",
  "success": true
}
```

- **data**: 이하 모든 필드는 `data` 내부 값.

---

## 3. data 최상위 필드 (KPI 외)

| 필드 | 타입 | 의미 |
|------|------|------|
| **pv** | Long | 조회 기간 동안의 **페이지뷰(Page View)** 총 건수. |
| **uv** | Long | 조회 기간 동안의 **순 방문자 수(Unique Visitor)**. |
| **events** | Long | 조회 기간 동안의 **이벤트 로그** 총 건수. |
| **apiErrorRate** | Double | **전체 API 요청 대비 4xx+5xx 비율(%)**. (조회 기간 기준) |
| **pvDeltaPercent** | Double | 이전 비교 기간 대비 PV 증감 **백분율(%)**. (예: 100 = 100% 증가) |
| **uvDeltaPercent** | Double | 이전 비교 기간 대비 UV 증감 **백분율(%)**. |
| **eventDeltaPercent** | Double | 이전 비교 기간 대비 이벤트 수 증감 **백분율(%)**. |
| **apiErrorDeltaPercent** | Double | 이전 비교 기간 대비 API 에러율 증감 **백분율(%)**. |
| **kpi** | Object | 가용성·지연·트래픽·에러 4종 KPI 세부 객체. (아래 4절 참고) |

- **표시 권장**: 수치가 없을 때 `-` 대신 **0** 또는 기획된 기본값을 사용할 수 있도록, 백엔드는 가능한 한 null 대신 숫자를 내려줍니다.

---

## 4. data.kpi — 4종 KPI 상세

### 4.1. availability (가용성)

| 필드 | 타입 | 의미 |
|------|------|------|
| **successRate** | Double | **(성공 요청 수(2xx+3xx) / 전체 API 요청 수) × 100** (%)<br>• 전체 요청이 **0건이면 100.0**을 반환(시스템 정상으로 간주). |
| **sloTargetSuccessRate** | Double | **가용성 SLO 목표 성공률(%)**. DB `sys_monitoring_configs`의 **AVAILABILITY_SLO_TARGET** 조회값(코드로 관리, 초기 99.9). 현재 성공률과 함께 목표 대비 비교용. |
| **criticalThreshold** | Double | **Critical 임계치(%)**. DB **AVAILABILITY_CRITICAL_THRESHOLD** 조회값(코드 관리, 초기 99.0). **successRate가 이 값 미만일 때만** Critical 배지·빨간색 UI 노출. |
| **successCount** | Long | 조회 기간 동안 **2xx·3xx** 응답 수. |
| **totalCount** | Long | 조회 기간 동안 **전체 API 요청** 수. |
| **downtimeMinutes** | Integer | **1분 단위**로 집계했을 때, **분당 요청 수 ≥ MIN_REQ_PER_MINUTE** 이면서 **5xx 에러율이 ERROR_RATE_THRESHOLD%를 초과한 분**의 개수 합. (설정은 테넌트별 `sys_monitoring_configs`, 없으면 1 / 5.0 Fallback) 데이터 없으면 **0**. |
| **uptimeMinutes** | Long | **가동 시간(분)** = 조회 기간 전체 분 − downtimeMinutes. 프론트 **Uptime** 표시용. |
| **downtimeIntervals** | Array | **장애 구간 목록**. 위 기준을 만족하는 1분 버킷의 `{ start, end }` (ISO-8601 UTC). 차트 Red 영역 표시용. |
| **downtimeIntervals[].start** | String | 구간 시작 시각 (UTC). |
| **downtimeIntervals[].end** | String | 구간 종료 시각 (UTC, start + 1분). |
| **delta** | Object | 이전 비교 기간 대비 증감. |
| **delta.successRatePp** | Double | successRate의 **퍼센트포인트(p.p.)** 증감. (예: -3.59 = 3.59%p 감소) |
| **delta.downtimeMinutes** | Integer | downtimeMinutes 증감(분). |
| **topCause** | Object \| null | 해당 기간 **5xx가 가장 많이 발생한 경로** 1건. 데이터 없으면 **null** — 프론트는 null 체크 후 "데이터 없음" 등 표시. |
| **topCause.path** | String | API 경로 (예: `/admin/audit-logs`). |
| **topCause.statusGroup** | String | 항상 `"5xx"`. |
| **topCause.count** | Long | 해당 path에서 발생한 5xx 건수. |

- **모니터링 설정 (Backend)**  
  - 다운타임/장애 구간 판정 기준은 테넌트별 **sys_monitoring_configs**에서 조회하며, 없을 경우 **Fallback**: `MIN_REQ_PER_MINUTE`=1, `ERROR_RATE_THRESHOLD`=5.0, `AVAILABILITY_SLO_TARGET`=99.9, `AVAILABILITY_CRITICAL_THRESHOLD`=99.0, `LATENCY_SLO_TARGET`=500, `LATENCY_CRITICAL_THRESHOLD`=1500.  
  - 설정 키는 **sys_codes** 코드값으로 관리(MONITORING_CONFIG_KEY 그룹: MIN_REQ_PER_MINUTE, ERROR_RATE_THRESHOLD, AVAILABILITY_SLO_TARGET, AVAILABILITY_CRITICAL_THRESHOLD, **LATENCY_SLO_TARGET**, **LATENCY_CRITICAL_THRESHOLD**). 다운타임 쿼리는 HAVING COUNT(*) >= 설정값 유지.  
- **UI 활용**: 가용성 카드에 successRate(현재 성공률), sloTargetSuccessRate(목표), criticalThreshold(이 값 미만 시 Critical·빨간색 UI), uptimeMinutes(Uptime), downtimeMinutes(다운타임) 표시. topCause는 “가장 많은 5xx 원인” 요약용.

---

### 4.2. latency (지연 시간)

| 필드 | 타입 | 의미 |
|------|------|------|
| **avgLatency** | Long | **현재 평균 지연 시간**(ms). 해당 기간 API 호출 이력의 latency_ms 평균. 데이터 없으면 **0**. |
| **p50Latency** | Long | **50%ile 중간값**(ms). p50Ms와 동일 값. |
| **p50Ms** | Long | 응답 지연 시간 **50%ile (중앙값)** (ms). |
| **p95Ms** | Long | 응답 지연 시간 **95%ile** (ms). |
| **p99Latency** | Long | **99%ile 최악값**(ms). p99Ms와 동일 값. |
| **p99Ms** | Long | 응답 지연 시간 **99%ile** (ms). |
| **sloTarget** | Long | **지연 SLO 목표(ms)**. DB `sys_monitoring_configs`의 **LATENCY_SLO_TARGET** 조회값(코드 관리, 초기 500 = 0.5초 이내). 프론트가 목표 대비 상태를 동적으로 판단할 때 사용. |
| **criticalThreshold** | Long | **지연 Critical 임계치(ms)**. DB **LATENCY_CRITICAL_THRESHOLD** 조회값(코드 관리, 초기 1500 = 1.5초). **초과 시 심각(장애)** 배지·빨간색 UI 등 표시용. |
| **prevAvgLatency** | Long | **전일(또는 비교 기간) 평균 지연(ms)**. 변동률(예: (avgLatency - prevAvgLatency) / prevAvgLatency × 100) 계산용. 비교 기간 데이터 없으면 0. |
| **delta** | Object | 이전 비교 기간 대비 증감. |
| **delta.p95Ms** | Long | p95 지연 시간 증감(ms). |
| **delta.p99Ms** | Long | p99 지연 시간 증감(ms). |
| **topSlow** | Object \| null | 해당 기간 **p95가 가장 큰 API 경로** 1건. 없으면 **null** — 프론트 null 체크 필수. |
| **topSlow.path** | String | API 경로 (예: `/auth/login`). |
| **topSlow.p95Ms** | Long | 해당 path의 p95 지연(ms). |

- **표시**: 지연 시간은 모두 **밀리초(ms)**. 데이터 없으면 0으로 내려와 `-` 대신 0 표시 가능.
- **동적 판단**: 프론트는 `sloTarget`(목표), `criticalThreshold`(장애 임계치)와 `avgLatency`/`p99Latency` 등을 비교해 SLO 달성·경고·Critical 배지 표시.

---

### 4.3. traffic (트래픽)

| 필드 | 타입 | 의미 |
|------|------|------|
| **rpsAvg** | Double | **평균 RPS**: (조회 기간 전체 API 요청 수) / (조회 기간 초). **소수점 2자리** (낮은 값에서 0.0 고착 방지). |
| **rpsPeak** | Double | **피크 RPS**: 조회 기간을 **1분 단위 버킷**으로 나눈 뒤, 각 버킷의 RPS(해당 분 요청 수/60) 중 **최댓값**. 소수점 2자리. |
| **requestCount** | Long | 조회 기간 **전체 API 요청** 수. (상위 data와 동일 기간 기준) |
| **pv** | Long | **data.pv와 동일**. 페이지뷰 총 건수. (한 번에 접근하기 위해 중복 제공) |
| **uv** | Long | **data.uv와 동일**. 순 방문자 수. |
| **delta** | Object | 이전 비교 기간 대비 증감. |
| **delta.rpsAvg** | Double | rpsAvg 증감 (소수점 2자리). |
| **delta.requestCount** | Long | requestCount 증감. |
| **delta.pv** | Long | pv 절대 증감. |
| **delta.uv** | Long | uv 절대 증감. |
| **delta.pvDeltaPercent** | Double | 이전 기간 대비 PV 증감 **백분율(%)**. 트래픽 카드 배지용. |
| **delta.uvDeltaPercent** | Double | 이전 기간 대비 UV 증감 **백분율(%)**. |
| **topTraffic** | Object \| null | 해당 기간 **요청 수가 가장 많은 API 경로** 1건. 없으면 **null** — 프론트 null 체크 필수. |
| **topTraffic.path** | String | API 경로 (예: `/monitoring/event`). |
| **topTraffic.requestCount** | Long | 해당 path의 요청 수. |

- **참고**: `rpsAvg`가 0.0이어도 `requestCount`가 0이 아니면, 조회 기간(초)이 매우 길어서 평균이 작게 나온 경우일 수 있음.

---

### 4.4. error (오류) 및 budget (에러 예산)

| 필드 | 타입 | 의미 |
|------|------|------|
| **rate4xx** | Double | **전체 API 요청 대비 4xx 비율(%)**. 소수점 2자리. |
| **rate5xx** | Double | **전체 API 요청 대비 5xx 비율(%)**. 소수점 2자리. |
| **count4xx** | Long | 조회 기간 **4xx** 발생 건수. |
| **count5xx** | Long | 조회 기간 **5xx** 발생 건수. |
| **delta** | Object | 이전 비교 기간 대비 증감. |
| **delta.rate5xxPp** | Double | rate5xx의 **퍼센트포인트(p.p.)** 증감. |
| **delta.count5xx** | Long | count5xx 증감. |
| **budget** | Object | SLO 기반 **에러 예산(Error Budget)**. |
| **budget.period** | String | **조회 기간과 연동**: `"1H"`(≤1h), `"24H"`(≤24h), `"7D"`(≤7d), `"WEEK"`(그 이상). |
| **budget.sloTargetSuccessRate** | Double | SLO 목표 성공률 (예: **99.9** = 99.9%). |
| **budget.consumedRatio** | Double | **소진율** = min(rate5xx/0.1, **1.0**). **최대 1.0(100%)으로 제한**되어 Progress Bar 깨짐 방지. 0.27 = 27% 소진. |
| **topError** | Object \| null | 해당 기간 **가장 많이 발생한 에러** 1건 (path + statusCode 조합). 없으면 **null** — 프론트 null 체크 필수. |
| **topError.path** | String | API 경로 (예: `/auth/permissions`). |
| **topError.statusCode** | Integer | HTTP 상태 코드 (예: 401). |
| **topError.count** | Long | 해당 path+statusCode 조합의 발생 건수. |

- **consumedRatio**: 백엔드에서 **1.0 초과 시 1.0으로 cap**. 프론트는 0~1 구간으로 Progress Bar 표시하면 됨. (rate5xx 1%면 이론상 10.0이 되지만, **항상 최대 1.0** 반환.)

---

## 5. 프론트엔드 표시 가이드

1. **수치가 없을 때**  
   - 백엔드는 가용성·지연·트래픽·에러 모두 **데이터 없음 시 0 또는 100.0(가용성)** 등을 사용합니다.  
   - 프론트에서는 `null`/`undefined` 대신 **숫자 0 또는 기획된 기본값**을 사용하면 `-` 대신 일관된 수치 표시가 가능합니다.

2. **Delta (증감)**  
   - `delta`는 **현재 기간 − 비교 기간**의 절대/비율 증감입니다.  
   - `successRatePp`, `rate5xxPp`는 **퍼센트포인트**이므로, “전기 대비 N%p 증가/감소” 형태로 표시하면 됩니다.

3. **topCause / topSlow / topTraffic / topError**  
   - 각각 **해당 기간 1위**만 제공됩니다. **없으면 null**이므로, **프론트는 반드시 null 체크** 후 접근하고, null일 때는 “데이터 없음” 등으로 표시해 크래시를 방지해야 합니다. (빈 객체 `{}`는 반환하지 않음.)

4. **트래픽 rpsAvg와 requestCount**  
   - 조회 구간이 길면 `requestCount`는 크지만 `rpsAvg`는 작게 나올 수 있으므로, 두 값 모두 표시해 주는 것이 좋습니다.

---

## 6. 항목별 계산 로직 요약

백엔드에서 각 값이 어떤 로직으로 산출되는지 간략 정리합니다.

### 6.1. data 최상위

| 항목 | 계산 로직 |
|------|-----------|
| **pv** | 조회 기간(`from`~`to`) 내 **페이지뷰 이벤트** 테이블의 건수 집계 (tenant 기준). |
| **uv** | 조회 기간 내 **페이지뷰 이벤트**의 **유저(방문자) ID 기준 중복 제거 건수**. |
| **events** | 조회 기간 내 **이벤트 로그** 테이블 건수 집계 (tenant 기준). |
| **apiErrorRate** | `(4xx 건수 + 5xx 건수) / 전체 API 요청 수 × 100`. API 호출 이력 테이블에서 status_code 4xx·5xx 집계. |
| **pvDeltaPercent, uvDeltaPercent, eventDeltaPercent, apiErrorDeltaPercent** | `(현재 기간 값 - 비교 기간 값) / 비교 기간 값 × 100`. 비교 기간 값이 0이면 현재 > 0일 때 100, 아니면 0. |

### 6.2. availability (가용성)

| 항목 | 계산 로직 |
|------|-----------|
| **successRate** | `(2xx+3xx 건수 / 전체 API 요청 수) × 100`, 소수 둘째 자리 반올림. **전체 요청 0건이면 100.0** 반환. |
| **sloTargetSuccessRate** | **sys_monitoring_configs**의 **AVAILABILITY_SLO_TARGET** 조회값(코드 관리, 초기 99.9). 없으면 99.9. |
| **criticalThreshold** | **sys_monitoring_configs**의 **AVAILABILITY_CRITICAL_THRESHOLD** 조회값(코드 관리, 초기 99.0). successRate < 이 값이면 Critical·빨간색 UI. |
| **successCount** | API 호출 이력에서 **status_code 200~399** 건수 집계. |
| **totalCount** | API 호출 이력에서 조회 기간 내 **전체 건수**. |
| **downtimeMinutes** | 테넌트 설정(`sys_monitoring_configs`)에서 **MIN_REQ_PER_MINUTE**, **ERROR_RATE_THRESHOLD** 조회 (없으면 1, 5.0). **1분 버킷** 중 **버킷 요청 수 ≥ MIN_REQ_PER_MINUTE** 이고 **(5xx/버킷전체)×100 > ERROR_RATE_THRESHOLD** 인 버킷 개수 합. 데이터 없으면 0. |
| **uptimeMinutes** | **조회 기간 전체(분) − downtimeMinutes** (0 미만이면 0). |
| **downtimeIntervals** | 위 HAVING 조건을 만족하는 1분 버킷의 **시작 시각** 목록 조회 후, 각각 `start`(UTC ISO), `end = start + 1분`(UTC ISO) 로 배열 반환. |
| **delta.successRatePp** | 현재 기간 successRate − 비교 기간 successRate (퍼센트포인트). |
| **delta.downtimeMinutes** | 현재 기간 downtimeMinutes − 비교 기간 downtimeMinutes. |
| **topCause** | API 호출 이력에서 **status_code 500~599**만 필터 후 **path별 건수** 집계 → 건수 기준 1위 1건 (path, count). 없으면 null. |

### 6.3. latency (지연 시간)

| 항목 | 계산 로직 |
|------|-----------|
| **avgLatency** | API 호출 이력의 **latency_ms** 컬럼에 대해 **AVG(latency_ms)** (NULL 제외). 해당 기간 유효 데이터 0건이면 **0**. |
| **p50Latency, p50Ms, p95Ms, p99Latency, p99Ms** | **latency_ms**에 대해 PostgreSQL `percentile_cont(0.5)`, `(0.95)`, `(0.99)` WITHIN GROUP (ORDER BY latency_ms). p50Latency=p50Ms, p99Latency=p99Ms. 해당 기간 유효 데이터 0건이면 **0**. |
| **sloTarget** | **sys_monitoring_configs**의 **LATENCY_SLO_TARGET** 조회값(코드 관리, 초기 500). 없으면 500. |
| **criticalThreshold** | **sys_monitoring_configs**의 **LATENCY_CRITICAL_THRESHOLD** 조회값(코드 관리, 초기 1500). 없으면 1500. |
| **prevAvgLatency** | **비교 기간(compareFrom~compareTo)** 에서 계산한 **평균 지연(ms)**. 변동률 계산용. 비교 기간 데이터 없으면 0. |
| **delta.p95Ms, delta.p99Ms** | 현재 기간 p95/p99 − 비교 기간 p95/p99 (ms). |
| **topSlow** | **path별**로 p95(latency_ms) 계산 후 **p95 최대인 path 1건** (path, p95Ms). |

### 6.4. traffic (트래픽)

| 항목 | 계산 로직 |
|------|-----------|
| **rpsAvg** | `조회 기간 전체 API 요청 수 / max(조회 기간 초, 1)`, **소수점 2자리** 반올림 (매우 낮을 때 0.0 고착 방지). |
| **rpsPeak** | 조회 기간을 **1분 단위**로 나눈 뒤, 각 1분 버킷의 `(버킷 내 요청 수 / 60)` 계산 → 그중 **최댓값**, 소수점 2자리 반올림. |
| **requestCount** | 조회 기간 **전체 API 요청** 건수 (summary 최상위와 동일 소스). |
| **pv, uv** | **data.pv**, **data.uv**와 동일 값 매핑 (중복 제공). |
| **delta** | rpsAvg/requestCount/pv/uv 절대 증감 + **pvDeltaPercent**, **uvDeltaPercent** (이전 대비 %). |
| **topTraffic** | API 호출 이력 **path별 건수** 집계 → **건수 1위** path 1건. 없으면 null. |

### 6.5. error (오류) 및 budget

| 항목 | 계산 로직 |
|------|-----------|
| **rate4xx** | `(4xx 건수 / 전체 API 요청 수) × 100`, 소수 둘째 자리. 전체 0건이면 0. |
| **rate5xx** | `(5xx 건수 / 전체 API 요청 수) × 100`, 소수 둘째 자리. 전체 0건이면 0. |
| **count4xx, count5xx** | API 호출 이력에서 **status_code 400~499**, **500~599** 각각 건수 집계. |
| **delta.rate5xxPp** | 현재 기간 rate5xx − 비교 기간 rate5xx (퍼센트포인트). |
| **delta.count5xx** | 현재 기간 count5xx − 비교 기간 count5xx. |
| **budget.consumedRatio** | `min(rate5xx / 0.1, 1.0)`. 소수 둘째 자리 반올림. **최대 1.0**으로 제한. 예: 0.7 → 70% 소진. |
| **budget.period** | 조회 기간(초) 기준: ≤3600 → `"1H"`, ≤86400 → `"24H"`, ≤604800 → `"7D"`, 그 외 `"WEEK"`. |
| **budget.sloTargetSuccessRate** | `99.9`. |
| **topError** | API 호출 이력에서 **status_code ≥ 400**만 필터 후 **(path, status_code)별 건수** 집계 → **건수 1위** 1건. 없으면 null. |

---

## 7. 데이터 정합성 및 UX 보완 (백엔드 보장 사항)

| 항목 | 보완 내용 |
|------|-----------|
| **가용성 Fallback** | 데이터 0건이어도 `successRate`는 **100.0**, `downtimeMinutes`는 **0**을 반환. null/undefined 없이 숫자로 내려가므로 프론트에서 `-` 대신 숫자 표시 가능. |
| **Error Budget 소진율** | `consumedRatio`는 **최대 1.0(100%)** 로 제한. rate5xx가 1%여도 10.0이 되지 않고 1.0으로 cap. Progress Bar는 0~1 구간으로만 표시하면 됨. |
| **Error Budget period** | 상단 필터 기간과 연동: 1h → `1H`, 24h → `24H`, 7d → `7D`, 그 외 → `WEEK`. |
| **Traffic delta 퍼센트** | `kpi.traffic.delta`에 **pvDeltaPercent**, **uvDeltaPercent** 포함. 트래픽 카드 배지에 % 표시 시 일관성 유지. |
| **차트 장애 구간** | `availability.downtimeIntervals`: 5xx 에러율 5% 초과 1분 버킷의 `{ start, end }`(UTC ISO) 배열. Red 영역을 정확히 그림. |
| **RPS 소수점** | `rpsAvg`, `rpsPeak`는 **소수점 2자리** 반올림. 매우 낮은 값(예: 0.004)도 0.0으로 고착되지 않음. |
| **Top 데이터 null** | `topCause`, `topSlow`, `topTraffic`, `topError`는 **데이터 없으면 null**. 빈 객체 미제공. 프론트는 **null 체크 필수** 후 "데이터 없음" 등 처리. |

---

## 8. 프론트엔드 반영 요약 (KPI 카드·차트 안정화)

스펙 및 기획 가이드 기준으로 FE에 반영된 동작입니다.

| 항목 | FE 반영 내용 |
|------|----------------|
| **Fallback** | kpi null/수치 없음 시 가용성 **100.00%**, Downtime **0m** / Latency **0ms** / Traffic **0.0 RPS** / Error **0.00%**, 4xx·5xx **0** |
| **포맷** | successRate·rate5xx 소수점 **2자리**, RPS 소수점 **1자리**, 지연 **ms** 단위 |
| **Delta 배지** | 양수 ▲ / 음수 ▼, 기획색(Error는 상승 시 Red, Traffic 등은 상승 Green·하락 Red) |
| **드릴다운** | Availability → Error 차트 + statusGroup=5xx / Latency → Latency 차트 + 응답시간 내림차순 / Traffic → Traffic 차트 + 최신순 / Error → Error 차트 + statusGroup=4xx,5xx |
| **Red Area** | 우측 차트 장애 영역은 **Error 또는 Availability** 모드일 때만 노출, Traffic/Latency 시 제거 |
| **차트 제목** | `시간대별 API / Traffic` · `시간대별 API / Latency` · `시간대별 API / Error` |
| **시간대 필터** | 좌측 PV/UV 차트 **포인트 클릭** 시** 해당 구간 from/to로 API 히스토리 재조회 (브러시 드래그는 미구현) |
| **Error Budget Bar** | `budget.consumedRatio` 0~1 사용, **≥1.0이면 100% 고정 + 강렬한 Red** 시각 경고 |
| **Traffic delta** | `data.pvDeltaPercent` 우선, 없으면 `kpi.traffic.delta.pvDeltaPercent` 사용 |
| **로딩** | `useMonitoringSummaryQuery` isLoading 시 카드 Skeleton 적용 |
| **Zero 데이터** | 트래픽 스파크라인 값 전부 0일 때 바닥 직선(플랫 라인) 표시 |

---

## 9. 문서 이력

| 날짜 | 내용 |
|------|------|
| 2026-01-26 | 최초 작성 — Summary 응답 필드별 의미 및 표시 가이드 정리 |
| 2026-01-26 | 문서 위치를 `docs/frontend-src/docs/api-spec` 로 통일, **항목별 계산 로직 요약** 섹션 추가 |
| 2026-01-26 | **데이터 정합성·UX 보완** 반영: 가용성 fallback, consumedRatio 1.0 cap, budget.period 기간 연동, traffic.delta 퍼센트, downtimeIntervals, RPS 2자리, top null 명세 |
| 2026-01-26 | **§8 프론트엔드 반영 요약** 추가 — KPI 카드·차트 안정화 기준으로 스펙 대비 FE 동작 정리 |
| 2026-01-26 | **모니터링 설정·가용성 보강**: `sys_monitoring_configs` 기반 동적 다운타임 기준(MIN_REQ_PER_MINUTE, ERROR_RATE_THRESHOLD), **uptimeMinutes** 응답 추가, §4.1·§6.2 및 모니터링 설정 설명 반영 |
| 2026-01-26 | **AVAILABILITY_CRITICAL_THRESHOLD** 추가: 코드·시드(99.0), **kpi.availability.criticalThreshold** 응답 필드, successRate 미만 시 Critical 배지·빨간색 UI 용도 명세 반영 |
| 2026-01-26 | **지연 시간 SLO/Critical**: `LATENCY_SLO_TARGET`(500), `LATENCY_CRITICAL_THRESHOLD`(1500) 코드·시드 추가. **kpi.latency** 확장: avgLatency, p50Latency, p99Latency, sloTarget, criticalThreshold, prevAvgLatency. §4.2·§6.3·설정 Fallback 반영. |
| 2026-01-26 | **FE 정합성 검토**: 백엔드 반영 문서 기준으로 타입·카드·차트 확인. `libs/shared-utils` 타입(§4.1~4.4), 카드(sloTarget/criticalThreshold, p50/p99, delta.p95Ms, prevAvgLatency, consumedRatio, traffic delta), 문서 경로(`docs/api-spec`) 반영. |
