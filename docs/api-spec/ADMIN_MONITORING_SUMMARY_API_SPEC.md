# Admin 모니터링 Summary API 스펙

> **API**: `GET /api/admin/monitoring/summary`  
> **목적**: 프론트엔드에서 각 응답 필드의 의미를 해석하고 올바르게 표시하기 위한 필드별 설명 문서.  
> **문서 위치**: `docs/frontend-src/docs/api-spec` (FE 전달·협업 시 사용).

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
- **data.kpi**: 가용성·지연·트래픽·에러 4종 KPI 블록. (§4 상세)

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
| **monitoringConfig** | Object | **dwp_auth.public.sys_monitoring_configs** 현재 DB 설정값. key=config_key(코드값), value=config_value. 테넌트별 조회, 없으면 기본값 맵 반환. **각 config key가 어떤 KPI 카드에서 쓰이는지는 아래 표 참고.** |

**monitoringConfig — config_key별 사용 카드·설명**

각 설정값이 **어떤 KPI 카드에서 쓰이는지** 아래 표를 참고합니다. **data.kpi** 내 각 블록(availability/latency/traffic/error)에는 해당 KPI에서 사용하는 설정값을 필드로도 내려줍니다.

| config_key | 기본값(예시) | 설명 | 사용 카드 |
|------------|--------------|------|-----------|
| **AVAILABILITY_MIN_REQ_PER_MINUTE** | 1 | 분당 최소 요청 건수. 이 값 이상일 때만 해당 분을 다운타임 판정 대상으로 둠. | **가용성** |
| **AVAILABILITY_ERROR_RATE_THRESHOLD** | 5.0 | 5xx 에러율이 이 값(%)을 초과하면 해당 1분을 장애 분으로 집계. | **가용성** |
| **AVAILABILITY_CRITICAL_THRESHOLD** | 99.0 | 가용성(성공률)이 이 값(%) 미만이면 Critical 배지·빨간색 UI 노출. | **가용성** |
| **AVAILABILITY_SLO_TARGET** | 99.9 | 가용성 SLO 목표 성공률(%). 목표 대비 비교·Health Dots WARNING/UP 판정에 사용. | **가용성** |
| **LATENCY_SLO_TARGET** | 500 | 지연 SLO 목표(ms). 0.5초 이내 응답 목표. | **지연** |
| **LATENCY_CRITICAL_THRESHOLD** | 1500 | 지연이 이 값(ms) 초과 시 장애(심각). 1.5초 초과 시 Critical·빨간색 UI. | **지연** |
| **TRAFFIC_SLO_TARGET** | 100 | 트래픽(RPS) 정상 범위 상한. 이 값 이하면 정상으로 간주. | **트래픽** |
| **TRAFFIC_CRITICAL_THRESHOLD** | 200 | 트래픽 서버 수용 한계 RPS. 초과 시 Critical·서버 증설 신호(Red). | **트래픽** |
| **TRAFFIC_PEAK_WINDOW_SECONDS** | 60 | Peak RPS 집계 윈도우(초). 60=1분 버킷, 10=10초 버킷 등. **kpi.traffic.trafficPeakWindowSeconds**로 동일값 반환. | **트래픽** |
| **ERROR_RATE_SLO_TARGET** | 0.5 | 목표 에러율(%). 5xx 비율을 이 값 미만으로 유지할 목표. Error Budget·burnRate 계산에 사용. **kpi.error.errorRateSloTarget**으로 반환. | **에러** |
| **ERROR_BUDGET_TOTAL** | 100 | 기준 기간 내 에러 예산 총량. **kpi.error.errorBudgetTotal**로 반환. | **에러** |

- **표시 권장**: 수치가 없을 때 `-` 대신 **0** 또는 기획된 기본값을 사용할 수 있도록, 백엔드는 가능한 한 null 대신 숫자를 내려줍니다.

---

## 4. data.kpi — 4종 KPI 상세

**data.kpi 구조 개요**

| 블록 | 키 | 대표 필드·용도 |
|------|-----|----------------|
| **가용성** | `availability` | successRate, sloTargetSuccessRate, criticalThreshold, downtimeMinutes, uptimeMinutes, **statusHistory**(Health Dots), downtimeIntervals, topCause |
| **지연** | `latency` | avgLatency, p50Ms, p95Ms, p99Ms, sloTarget, criticalThreshold, prevAvgLatency, topSlow |
| **트래픽** | `traffic` | rpsAvg, rpsPeak, currentRps, prevRps, totalPv, totalUv, sloTarget, criticalThreshold, **loadPercentage**, delta.rpsDeltaPercent, topTraffic |
| **에러** | `error` | rate4xx, rate5xx, **errorRate**, **errorCounts**, **errorBudgetRemaining**, **burnRate**, budget.consumedRatio, topError |

### 4.1. availability (가용성)

| 필드 | 타입 | 의미 |
|------|------|------|
| **successRate** | Double | **(성공 요청 수(2xx+3xx) / 전체 API 요청 수) × 100** (%)<br>• 전체 요청이 **0건이면 100.0**을 반환(시스템 정상으로 간주). |
| **sloTargetSuccessRate** | Double | **가용성 SLO 목표 성공률(%)**. DB `sys_monitoring_configs`의 **AVAILABILITY_SLO_TARGET** 조회값(코드로 관리, 초기 99.9). 현재 성공률과 함께 목표 대비 비교용. |
| **criticalThreshold** | Double | **Critical 임계치(%)**. DB **AVAILABILITY_CRITICAL_THRESHOLD** 조회값(코드 관리, 초기 99.0). **successRate가 이 값 미만일 때만** Critical 배지·빨간색 UI 노출. |
| **availabilityMinReqPerMinute** | Integer | **AVAILABILITY_MIN_REQ_PER_MINUTE** 설정값. 분당 최소 요청 건수 이상일 때만 다운타임 판정. (해당 KPI에서 사용하는 설정) |
| **availabilityErrorRateThreshold** | Double | **AVAILABILITY_ERROR_RATE_THRESHOLD** 설정값(%). 5xx 에러율이 이 값 초과 시 해당 1분을 장애로 집계. (해당 KPI에서 사용하는 설정) |
| **successCount** | Long | 조회 기간 동안 **2xx·3xx** 응답 수. |
| **totalCount** | Long | 조회 기간 동안 **전체 API 요청** 수. |
| **downtimeMinutes** | Integer | **1분 단위**로 집계했을 때, **분당 요청 수 ≥ AVAILABILITY_MIN_REQ_PER_MINUTE** 이면서 **5xx 에러율이 AVAILABILITY_ERROR_RATE_THRESHOLD%를 초과한 분**의 개수 합. (설정은 테넌트별 `sys_monitoring_configs`, 없으면 1 / 5.0 Fallback) 데이터 없으면 **0**. |
| **uptimeMinutes** | Long | **가동 시간(분)** = 조회 기간 전체 분 − downtimeMinutes. 프론트 **Uptime** 표시용. |
| **downtimeIntervals** | Array | **장애 구간 목록**. 위 기준을 만족하는 1분 버킷의 `{ start, end }` (ISO-8601 UTC). 차트 Red 영역 표시용. |
| **downtimeIntervals[].start** | String | 구간 시작 시각 (UTC). |
| **downtimeIntervals[].end** | String | 구간 종료 시각 (UTC, start + 1분). |
| **statusHistory** | Array | **타임라인 히트맵(Health Dots)**용. 버킷별 `{ timestamp, status, availability }` 목록. 버킷 크기: 1h=2분(30 도트), 3h=5분(36 도트), 6h=10분(36 도트), 24h=30분(48 도트), 7d=6시간(28 도트), 30d=24시간(30 도트). |
| **statusHistory[].timestamp** | String | 버킷 시작 시각 (ISO-8601 UTC). |
| **statusHistory[].status** | String | **UP** \| **WARNING** \| **DOWN** \| **NO_DATA**. (산출 로직은 아래 참고) |
| **statusHistory[].availability** | Double | 해당 버킷 가용성(%) = (2xx+3xx)/전체×100. NO_DATA면 0. |
| **delta** | Object | 이전 비교 기간 대비 증감. |
| **delta.successRatePp** | Double | successRate의 **퍼센트포인트(p.p.)** 증감. (예: -3.59 = 3.59%p 감소) |
| **delta.downtimeMinutes** | Integer | downtimeMinutes 증감(분). |
| **topCause** | Object \| null | 해당 기간 **5xx가 가장 많이 발생한 경로** 1건. 데이터 없으면 **null** — 프론트는 null 체크 후 "데이터 없음" 등 표시. |
| **topCause.path** | String | API 경로 (예: `/admin/audit-logs`). |
| **topCause.statusGroup** | String | 항상 `"5xx"`. |
| **topCause.count** | Long | 해당 path에서 발생한 5xx 건수. |

- **모니터링 설정 (Backend)**  
  - 다운타임/장애 구간 판정 기준은 테넌트별 **sys_monitoring_configs**에서 조회하며, 없을 경우 **Fallback**: `AVAILABILITY_MIN_REQ_PER_MINUTE`=1, `AVAILABILITY_ERROR_RATE_THRESHOLD`=5.0, `AVAILABILITY_SLO_TARGET`=99.9, `AVAILABILITY_CRITICAL_THRESHOLD`=99.0, `LATENCY_SLO_TARGET`=500, `LATENCY_CRITICAL_THRESHOLD`=1500, `TRAFFIC_SLO_TARGET`=100, `TRAFFIC_CRITICAL_THRESHOLD`=200, **TRAFFIC_PEAK_WINDOW_SECONDS**=60.  
  - 설정 키는 **sys_codes** 코드값으로 관리(MONITORING_CONFIG_KEY 그룹: AVAILABILITY_MIN_REQ_PER_MINUTE, AVAILABILITY_ERROR_RATE_THRESHOLD, AVAILABILITY_SLO_TARGET, AVAILABILITY_CRITICAL_THRESHOLD, LATENCY_SLO_TARGET, LATENCY_CRITICAL_THRESHOLD, TRAFFIC_SLO_TARGET, TRAFFIC_CRITICAL_THRESHOLD, **TRAFFIC_PEAK_WINDOW_SECONDS**, ERROR_RATE_SLO_TARGET, ERROR_BUDGET_TOTAL). 다운타임 쿼리는 HAVING COUNT(*) >= 설정값 유지.  
- **UI 활용**: 가용성 카드에 successRate(현재 성공률), sloTargetSuccessRate(목표), criticalThreshold(이 값 미만 시 Critical·빨간색 UI), uptimeMinutes(Uptime), downtimeMinutes(다운타임) 표시. topCause는 “가장 많은 5xx 원인” 요약용.
- **statusHistory (타임라인 히트맵 / Health Dots) — 산출 로직**  
  - **버킷**: 조회 기간에 따라 동적 조정.  
    - **1h (3600초)**: 120초(2분) 버킷 → **30 도트**  
    - **3h (10800초)**: 300초(5분) 버킷 → **36 도트**  
    - **6h (21600초)**: 600초(10분) 버킷 → **36 도트**  
    - **24h (86400초)**: 1800초(30분) 버킷 → **48 도트**  
    - **7d (604800초)**: 21600초(6시간) 버킷 → **28 도트**  
    - **30d (2592000초)**: 86400초(24시간=1일) 버킷 → **30 도트**  
    - 조회 기간이 **1h~6h 사이**인 경우, 도트 개수가 최소 30개 내외가 되도록 **2~10분 사이 버킷 크기를 유동적으로 조정**.  
    - 전체적으로 최대 40~50개 도트 이내로 제한하여 UI 가독성 유지.  
  - **도트 색상 결정 — 에러율 임계치·지속 시간**  
    - **DOWN(적색)**  
      - **에러율 임계치**: **5xx 에러율 &gt; AVAILABILITY_ERROR_RATE_THRESHOLD**(sys_monitoring_configs, 기본 **5.0%**).  
      - **지속 시간**: **1분** 단위로만 판정. 해당 도트 버킷(2분~24시간) 안에, **“분당 요청 수 ≥ AVAILABILITY_MIN_REQ_PER_MINUTE(기본 1)”** 이면서 **“(5xx/분당 전체)×100 &gt; AVAILABILITY_ERROR_RATE_THRESHOLD”** 인 **1분**이 **한 번이라도** 있으면 DOWN.  
    - **WARNING(황색)**  
      - **에러율 임계치**: 해당 도트 **버킷 전체**의 **성공률(2xx+3xx/전체)&lt; AVAILABILITY_SLO_TARGET(기본 99.9%)**. 즉 실패율 &gt; 0.1% 이면 WARNING.  
      - **지속 시간**: **도트 버킷 전체**의 집계(버킷 내 전체 요청 기준 합산 후 비율 계산).  
    - **UP(녹색)**  
      - **에러율 임계치**: **성공률 ≥ AVAILABILITY_SLO_TARGET(99.9%)**.  
      - **지속 시간**: 도트 버킷 전체.  
    - **NO_DATA(회색)**  
      - 해당 도트 버킷의 **API 요청(totalCount)이 0건**인 경우.

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
| **rpsAvg** | Double | **평균 RPS**: (조회 기간 전체 API 요청 수) / (조회 기간 초). **소수점 2자리**. |
| **rpsPeak** | Double | **피크 RPS**: 조회 기간 내 **TRAFFIC_PEAK_WINDOW_SECONDS**(기본 60초) 버킷별 요청 수 중 최댓값을 윈도우(초)로 나눈 값. 소수점 2자리. |
| **currentRps** | Double | **실시간 RPS**: **최근 10초**간 평균 초당 요청 수. 메인 지표·실시간 활성도 표시용. |
| **prevRps** | Double | **전일 동시간대 RPS**: 24시간 전 동일 10초 구간 평균. 변동률 산출 근거. |
| **totalPv** | Long | **선택 기간(from~to) 내 총 API 호출 수**. (requestCount와 동일) |
| **totalUv** | Long | **선택 기간 내 중복 제거 클라이언트 수**: IP 또는 User ID 기준 UV. |
| **peakRps** | Double | **기간 내 Peak RPS**. rpsPeak와 동일값(설정 윈도우 기준). 명시용. |
| **sloTarget** | Double | **트래픽 SLO 목표(RPS)**. DB `sys_monitoring_configs` **TRAFFIC_SLO_TARGET** (초기 100). 정상 범위 상한으로, currentRps와 비교해 시스템 부하 상태 판단. |
| **criticalThreshold** | Double | **트래픽 Critical 임계치(RPS)**. DB **TRAFFIC_CRITICAL_THRESHOLD** (초기 200). 서버 수용 한계로, 초과 시 심각(경고)·서버 증설 신호(Red) 표시. |
| **loadPercentage** | Double | **부하율(%)**: (currentRps / criticalThreshold) × 100. 소수점 2자리. 100 초과 가능. 상태 컬러링·SLO 칩·Red 배지 판단용. |
| **trafficPeakWindowSeconds** | Integer | **TRAFFIC_PEAK_WINDOW_SECONDS** 설정값(초). Peak RPS 집계 윈도우. 60=1분 버킷. (해당 KPI에서 사용하는 설정) |
| **requestCount** | Long | 조회 기간 **전체 API 요청** 수. (totalPv와 동일) |
| **pv** | Long | **data.pv와 동일**. 페이지뷰 총 건수. |
| **uv** | Long | **data.uv와 동일**. 순 방문자 수(페이지뷰 기준). |
| **delta** | Object | 이전 비교 기간 대비 증감. |
| **delta.rpsAvg** | Double | rpsAvg 증감 (소수점 2자리). |
| **delta.requestCount** | Long | requestCount 증감. |
| **delta.pv** | Long | pv 절대 증감. |
| **delta.uv** | Long | uv 절대 증감. |
| **delta.pvDeltaPercent** | Double | 이전 기간 대비 PV 증감 **백분율(%)**. |
| **delta.uvDeltaPercent** | Double | 이전 기간 대비 UV 증감 **백분율(%)**. |
| **delta.rpsDeltaPercent** | Double | **전일 동시간대 대비 RPS 변동률(%)**. (currentRps − prevRps) / prevRps × 100. 트래픽 카드 변동률 배지용. |
| **topTraffic** | Object \| null | 해당 기간 **요청 수가 가장 많은 API 경로** 1건. 없으면 **null**. |
| **topTraffic.path** | String | API 경로. |
| **topTraffic.requestCount** | Long | 해당 path의 요청 수. |

- **Peak RPS 윈도우**: **TRAFFIC_PEAK_WINDOW_SECONDS**(sys_monitoring_configs, 기본 60)로 집계 단위를 설정. 60이면 1분 버킷 기준 Peak, 10이면 10초당 최대 요청 수 기준으로 더 정밀한 Peak RPS 산출 가능.
- **참고**: `rpsAvg`가 0.0이어도 `requestCount`가 0이 아니면, 조회 기간(초)이 길어 평균이 작게 나온 경우일 수 있음.
- **스파크라인**: Timeseries API `metric=API_TOTAL` 요청 시, 프론트의 **interval**(1m, 5m, 1h, 1d)에 맞춰 **시간대별 평균 RPS**(각 버킷의 요청 건수/버킷초) 배열이 반환되므로, 별도 계산 없이 그대로 스파크라인으로 그리면 됨.
- **상태 기반 컬러링·SLO 칩**: `loadPercentage`(부하율 %)와 `sloTarget`·`criticalThreshold`로 가용성/지연 카드와 동일한 패턴 적용. currentRps &lt;= sloTarget → 정상, sloTarget &lt; currentRps &lt;= criticalThreshold → 주의, currentRps &gt; criticalThreshold(또는 loadPercentage &gt; 100) → Critical(Red, 서버 증설 신호).

---

### 4.4. error (오류) 및 budget (에러 예산)

| 필드 | 타입 | 의미 |
|------|------|------|
| **rate4xx** | Double | **전체 API 요청 대비 4xx 비율(%)**. 소수점 2자리. |
| **rate5xx** | Double | **전체 API 요청 대비 5xx 비율(%)**. 소수점 2자리. |
| **count4xx** | Long | 조회 기간 **4xx** 발생 건수. |
| **count5xx** | Long | 조회 기간 **5xx** 발생 건수. |
| **errorRate** | Double | **현재 실시간 에러율(%)** — 5xx 비율과 동일. Error 카드 메인 지표. |
| **errorRateSloTarget** | Double | **ERROR_RATE_SLO_TARGET** 설정값(%). 목표 에러율 미만 유지 목표. Error Budget·burnRate 계산에 사용. (해당 KPI에서 사용하는 설정) |
| **errorBudgetTotal** | Double | **ERROR_BUDGET_TOTAL** 설정값. 기준 기간 내 에러 예산 총량. (해당 KPI에서 사용하는 설정) |
| **errorCounts** | Object | 4xx·5xx **각각의 합계** (`count4xx`, `count5xx`). |
| **errorCounts.count4xx** | Long | 조회 기간 4xx 건수. |
| **errorCounts.count5xx** | Long | 조회 기간 5xx 건수. |
| **errorBudgetRemaining** | Double | **남은 에러 버짓(%)**. 0 미만이면 0. 버짓 넉넉(Blue)·주의(Yellow)·소진(Red) 판정용. |
| **burnRate** | Double | **버짓 소진 속도**. 1.0 이상이면 위험(Red). |
| **delta** | Object | 이전 비교 기간 대비 증감. |
| **delta.rate5xxPp** | Double | rate5xx의 **퍼센트포인트(p.p.)** 증감. |
| **delta.count5xx** | Long | count5xx 증감. |
| **budget** | Object | SLO 기반 **에러 예산(Error Budget)**. |
| **budget.period** | String | **조회 기간과 연동**: `"1H"`(≤1h), `"24H"`(≤24h), `"7D"`(≤7d), `"WEEK"`(그 이상). |
| **budget.sloTargetSuccessRate** | Double | SLO 목표 성공률 (%) = 100 − **ERROR_RATE_SLO_TARGET** (DB 설정, 기본 99.5). |
| **budget.consumedRatio** | Double | **소진율** = min(rate5xx / ERROR_RATE_SLO_TARGET, **1.0**). **최대 1.0** 제한. 0.27 = 27% 소진. |
| **topError** | Object \| null | 해당 기간 **가장 많이 발생한 에러** 1건 (path + statusCode 조합). 없으면 **null** — 프론트 null 체크 필수. |
| **topError.path** | String | API 경로 (예: `/auth/permissions`). |
| **topError.statusCode** | Integer | HTTP 상태 코드 (예: 401). |
| **topError.count** | Long | 해당 path+statusCode 조합의 발생 건수. |

- **에러 설정 (Backend)**  
  - **ERROR_RATE_SLO_TARGET**: 목표 에러율(%) 미만 유지 (sys_monitoring_configs, 기본 **0.5**).  
  - **ERROR_BUDGET_TOTAL**: 기준 기간 내 허용 에러 관련값 (sys_monitoring_configs, 기본 **100**).  
  - 소진율·잔여 버짓·burnRate는 ERROR_RATE_SLO_TARGET 기준으로 계산. (consumedRatio = rate5xx/target, errorBudgetRemaining = (1−consumedRatio)×100, burnRate = rate5xx/target.)
- **consumedRatio**: 백엔드에서 **1.0 초과 시 1.0으로 cap**. 프론트는 0~1 구간으로 Progress Bar/게이지 표시.

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
| **monitoringConfig** | **dwp_auth.public.sys_monitoring_configs** 테넌트별 조회. config_key → config_value 맵. DB에 없으면 기본값 맵(AVAILABILITY_MIN_REQ_PER_MINUTE=1, AVAILABILITY_ERROR_RATE_THRESHOLD=5.0, AVAILABILITY_SLO_TARGET=99.9 등) 반환. |

### 6.2. availability (가용성)

| 항목 | 계산 로직 |
|------|-----------|
| **successRate** | `(2xx+3xx 건수 / 전체 API 요청 수) × 100`, 소수 둘째 자리 반올림. **전체 요청 0건이면 100.0** 반환. |
| **sloTargetSuccessRate** | **sys_monitoring_configs**의 **AVAILABILITY_SLO_TARGET** 조회값(코드 관리, 초기 99.9). 없으면 99.9. |
| **criticalThreshold** | **sys_monitoring_configs**의 **AVAILABILITY_CRITICAL_THRESHOLD** 조회값(코드 관리, 초기 99.0). successRate < 이 값이면 Critical·빨간색 UI. |
| **successCount** | API 호출 이력에서 **status_code 200~399** 건수 집계. |
| **totalCount** | API 호출 이력에서 조회 기간 내 **전체 건수**. |
| **downtimeMinutes** | 테넌트 설정(`sys_monitoring_configs`)에서 **AVAILABILITY_MIN_REQ_PER_MINUTE**, **AVAILABILITY_ERROR_RATE_THRESHOLD** 조회 (없으면 1, 5.0). **1분 버킷** 중 **버킷 요청 수 ≥ AVAILABILITY_MIN_REQ_PER_MINUTE** 이고 **(5xx/버킷전체)×100 > AVAILABILITY_ERROR_RATE_THRESHOLD** 인 버킷 개수 합. 데이터 없으면 0. |
| **uptimeMinutes** | **조회 기간 전체(분) − downtimeMinutes** (0 미만이면 0). |
| **downtimeIntervals** | 위 HAVING 조건을 만족하는 1분 버킷의 **시작 시각** 목록 조회 후, 각각 `start`(UTC ISO), `end = start + 1분`(UTC ISO) 로 배열 반환. |
| **statusHistory** | 조회 기간을 **버킷**으로 나누어, 버킷별 total·success 집계 후 `timestamp`(버킷 시작 ISO-8601 UTC), `status`, `availability`(%) 반환. 버킷 크기: **1h=2분(30 도트)**, **3h=5분(36 도트)**, **6h=10분(36 도트)**, **24h=30분(48 도트)**, **7d=6시간(28 도트)**, **30d=24시간(30 도트)**. 조회 기간이 1h~6h 사이인 경우 도트 개수가 최소 30개 내외가 되도록 2~10분 사이 버킷으로 조정하며, 전체적으로 최대 40~50개 도트로 제한. **DOWN**=해당 버킷 내 downtimeMinutes에 해당하는 1분이 1분이라도 존재, **WARNING**=가용성 &lt; AVAILABILITY_SLO_TARGET(99.9%)이지만 DOWN 아님, **UP**=가용성 ≥ SLO, **NO_DATA**=해당 구간 API 요청(totalCount) 0건. |
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
| **rpsAvg** | `조회 기간 전체 API 요청 수 / max(조회 기간 초, 1)`, **소수점 2자리** 반올림. |
| **rpsPeak, peakRps** | **TRAFFIC_PEAK_WINDOW_SECONDS**(기본 60) 초 단위 버킷별 요청 수를 구한 뒤 그중 **최댓값 / 윈도우(초)**. 즉 `maxCountInWindow / TRAFFIC_PEAK_WINDOW_SECONDS`. 소수점 2자리. (동일값) |
| **currentRps** | **요청 시점 기준** 최근 10초 구간 API 요청 건수 / 10. 실시간 RPS. |
| **prevRps** | **요청 시점 24시간 전** 동일 10초 구간 API 요청 건수 / 10. 변동률 분모. |
| **totalPv, requestCount** | 조회 기간 **전체 API 요청** 건수 (동일 소스). |
| **totalUv** | 조회 기간 API 호출 이력에서 **COALESCE(ip_address, 'u_' \|\| user_id)** 기준 **COUNT(DISTINCT)**. |
| **sloTarget** | **sys_monitoring_configs**의 **TRAFFIC_SLO_TARGET** 조회값(코드 관리, 초기 100). 없으면 100.0. |
| **criticalThreshold** | **sys_monitoring_configs**의 **TRAFFIC_CRITICAL_THRESHOLD** 조회값(코드 관리, 초기 200). 없으면 200.0. |
| **loadPercentage** | `(currentRps / criticalThreshold) × 100`, 소수점 2자리. criticalThreshold가 0이면 분모 1로 대체. 100 초과 가능. |
| **pv, uv** | **data.pv**, **data.uv**와 동일 (페이지뷰 이벤트 기반). |
| **delta** | rpsAvg/requestCount/pv/uv 절대 증감 + **pvDeltaPercent**, **uvDeltaPercent**, **rpsDeltaPercent**. |
| **delta.rpsDeltaPercent** | `(currentRps − prevRps) / prevRps × 100`. prevRps=0이면 currentRps>0일 때 100, 아니면 0. |
| **topTraffic** | API 호출 이력 **path별 건수** 집계 → **건수 1위** path 1건. 없으면 null. |

### 6.5. error (오류) 및 budget

| 항목 | 계산 로직 |
|------|-----------|
| **rate4xx, rate5xx** | `(4xx|5xx 건수 / 전체 API 요청 수) × 100`, 소수 둘째 자리. 전체 0건이면 0. |
| **count4xx, count5xx** | API 호출 이력에서 **status_code 400~499**, **500~599** 각각 건수 집계. |
| **errorRate** | **rate5xx**와 동일. 현재 실시간 에러율(%). |
| **errorCounts** | `{ count4xx, count5xx }` — 위 count4xx, count5xx와 동일값. |
| **errorBudgetRemaining** | `max(0, (1 − consumedRatio) × 100)`, 소수 둘째 자리. |
| **burnRate** | `rate5xx / ERROR_RATE_SLO_TARGET`. 1.0 이상이면 위험. |
| **delta.rate5xxPp** | 현재 기간 rate5xx − 비교 기간 rate5xx (퍼센트포인트). |
| **delta.count5xx** | 현재 기간 count5xx − 비교 기간 count5xx. |
| **budget.consumedRatio** | `min(rate5xx / ERROR_RATE_SLO_TARGET, 1.0)`. **최대 1.0** 제한. (설정 기본값 0.5%) |
| **budget.period** | 조회 기간(초) 기준: ≤3600 → `"1H"`, ≤86400 → `"24H"`, ≤604800 → `"7D"`, 그 외 `"WEEK"`. |
| **budget.sloTargetSuccessRate** | `100 − ERROR_RATE_SLO_TARGET` (DB 설정, 기본 99.5). |
| **topError** | API 호출 이력에서 **status_code ≥ 400**만 필터 후 **(path, status_code)별 건수** 집계 → **건수 1위** 1건. 없으면 null. |

- **Timeseries (metric=API_ERROR)**  
  - `GET /api/admin/monitoring/timeseries?metric=API_ERROR&interval=1m|5m|1h|1d` 요청 시, 프론트의 **interval**에 맞춰 **시간대별 에러 발생 건수**(4xx+5xx) 배열을 반환.

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
| **Error Budget Bar** | **errorBudgetRemaining** 기준 잔여량 프로그레스 바. 색상: Green(≥80%), Yellow(20~80%), Red(&lt;20%). 라벨 `Error Budget Remaining: N%`. consumedRatio ≥1.0이면 100% 고정 + 강렬한 Red 시각 경고. |
| **Traffic delta** | `data.pvDeltaPercent` 우선, 없으면 `kpi.traffic.delta.pvDeltaPercent` 사용. 트래픽 카드 변동률은 **delta.rpsDeltaPercent** 우선 표시. |
| **로딩** | `useMonitoringSummaryQuery` isLoading 시 카드 Skeleton 적용 |
| **Zero 데이터** | 트래픽 스파크라인 값 전부 0일 때 바닥 직선(플랫 라인) 표시. 에러 스파크라인도 전부 0일 때 **Zero-filling**(바닥 직선)으로 표시. |
| **Traffic 카드 레이아웃** | SLO 칩 **Target &lt; 100 RPS**는 **메인 수치(0.0 RPS) 좌측** 배치. 하단 지표는 **PV · UV · Peak (Load%)** 한 줄 통합, 구분선 위 좌측 정렬. 배경 스파크라인 **max-height: 35%**, **bottom: 0** 밀착. |
| **Error 카드 레이아웃** | SLO 칩 **Target &lt; 0.5%**는 **메인 수치 우측 상단**(타이틀 행 우측) 배치. 하단 **4xx · 5xx** 한 줄 통합 + Error Budget Remaining 프로그레스 바. 배경 스파크라인 **max-height: 35%**, 에러 발생 시에만 Spike, 없으면 Zero-filling. |
| **가용성 Health Dots·Top Cause** | **statusHistory** 있으면 버킷별 도트(UP=녹색, WARNING=황색, DOWN=적색, NO_DATA=회색), 툴팁에 timestamp·availability 표시. 없으면 기존 타임시리즈 기반 48도트 폴백. **topCause** 있으면 `⚠️ 주요 장애 원인: {path} (5xx: {count}건)` 한 줄, null이면 "현재 보고된 주요 장애 원인 없음". 타임라인 하단·좌측 정렬, caption(11~12px), 말줄임. |

---

## 9. 문서 이력

| 날짜 | 내용 |
|------|------|
| 2026-01-26 | 최초 작성 — Summary 응답 필드별 의미 및 표시 가이드 정리 |
| 2026-01-26 | 문서 위치를 `docs/frontend-src/docs/api-spec` 로 통일, **항목별 계산 로직 요약** 섹션 추가 |
| 2026-01-26 | **데이터 정합성·UX 보완** 반영: 가용성 fallback, consumedRatio 1.0 cap, budget.period 기간 연동, traffic.delta 퍼센트, downtimeIntervals, RPS 2자리, top null 명세 |
| 2026-01-26 | **§8 프론트엔드 반영 요약** 추가 — KPI 카드·차트 안정화 기준으로 스펙 대비 FE 동작 정리 |
| 2026-01-26 | **모니터링 설정·가용성 보강**: `sys_monitoring_configs` 기반 동적 다운타임 기준(MIN_REQ_PER_MINUTE, AVAILABILITY_ERROR_RATE_THRESHOLD), **uptimeMinutes** 응답 추가, §4.1·§6.2 및 모니터링 설정 설명 반영 |
| 2026-01-26 | **AVAILABILITY_CRITICAL_THRESHOLD** 추가: 코드·시드(99.0), **kpi.availability.criticalThreshold** 응답 필드, successRate 미만 시 Critical 배지·빨간색 UI 용도 명세 반영 |
| 2026-01-26 | **지연 시간 SLO/Critical**: `LATENCY_SLO_TARGET`(500), `LATENCY_CRITICAL_THRESHOLD`(1500) 코드·시드 추가. **kpi.latency** 확장: avgLatency, p50Latency, p99Latency, sloTarget, criticalThreshold, prevAvgLatency. §4.2·§6.3·설정 Fallback 반영. |
| 2026-01-26 | **FE 정합성 검토**: 백엔드 반영 문서 기준으로 타입·카드·차트 확인. `libs/shared-utils` 타입(§4.1~4.4), 카드(sloTarget/criticalThreshold, p50/p99, delta.p95Ms, prevAvgLatency, consumedRatio, traffic delta), 문서 경로(`docs/api-spec`) 반영. |
| 2026-01-26 | **트래픽 카드 확장**: currentRps(최근 10초), prevRps(전일 동시간대), totalPv/totalUv/peakRps, delta.rpsDeltaPercent. totalUv=API 이력 IP/UserId 기준 distinct. Timeseries metric=API_TOTAL 시 interval(1m,5m,1h,1d)에 맞춰 시간대별 요청 건수 반환. |
| 2026-01-26 | **트래픽 SLO/임계치**: `TRAFFIC_SLO_TARGET`(100), `TRAFFIC_CRITICAL_THRESHOLD`(200) 코드·시드 추가. **kpi.traffic**에 **sloTarget**, **criticalThreshold** 응답. 시스템 부하 상태(정상/경고/Critical) 판단용. |
| 2026-01-26 | **트래픽 부하율·스파크라인**: **loadPercentage** (currentRps/criticalThreshold×100) 추가 — 상태 컬러링·서버 증설 신호(Red) 용. Timeseries **metric=API_TOTAL**은 interval에 맞춰 **시간대별 평균 RPS**(버킷당 RPS) 배열 반환으로 변경하여 스파크라인 직접 사용. |
| 2026-01-26 | **Error 카드·버짓**: **ERROR_RATE_SLO_TARGET**(0.5), **ERROR_BUDGET_TOTAL**(100) 코드·시드 추가. **kpi.error** 확장: **errorRate**, **errorCounts**(count4xx/count5xx), **errorBudgetRemaining**, **burnRate**. budget.consumedRatio·sloTargetSuccessRate를 설정 기반으로 계산. Timeseries **metric=API_ERROR** 시 interval에 맞춰 시간대별 에러 건수(4xx+5xx) 배열 반환. |
| 2026-01-26 | **Peak RPS 윈도우 설정**: **TRAFFIC_PEAK_WINDOW_SECONDS**(기본 60) 코드·시드 추가. rpsPeak = (조회 기간 내 N초 버킷별 요청 수 최댓값) / N. N=10이면 10초당 최대 RPS 기준으로 정밀 관제 가능. |
| 2026-01-26 | **§8 FE 반영 요약 보강**: Traffic 카드 SLO 칩 메인 수치 좌측, 하단 PV·UV·Peak(Load%) 한 줄·좌측 정렬, 차트 35%·bottom 밀착. Error 카드 SLO 칩 우측 상단, 4xx·5xx 한 줄 + 잔여 버짓 바, errorBudgetRemaining 기반 Green/Yellow/Red 색상·라벨, 스파크라인 35%·Zero-filling. |
| 2026-01-26 | **가용성 타임라인(Health Dots)**: **kpi.availability.statusHistory** 추가. 버킷(24h 이내 30분, 7일 6h, 그 외 24h)별 `timestamp`, `status`(UP\|WARNING\|DOWN\|NO_DATA), `availability`(%) 반환. 최대 40~50개 도트로 제한(30일 기준 30 도트). DOWN=버킷 내 downtime 1분 포함, WARNING=가용성&lt;SLO이면서 DOWN 아님, NO_DATA=요청 0건. |
| 2026-01-27 | **Health Dots 해상도 고도화**: 1h~6h 단기 조회 구간에 대해 버킷 크기를 2~10분으로 세분화하여 최소 30개 내외 도트가 그려지도록 개선(1h=2분, 3h=5분, 6h=10분). statusHistory 관련 설명 및 버킷 크기/도트 개수 스펙 업데이트. |
| 2026-01-27 | **statusHistory 도트 색상**: DOWN/WARNING/UP/NO_DATA 결정을 위한 **에러율 임계치**(AVAILABILITY_ERROR_RATE_THRESHOLD 5%, AVAILABILITY_SLO_TARGET 99.9%) 및 **지속 시간**(DOWN=1분 단위, WARNING/UP=도트 버킷 전체) 로직 명시. |
| 2026-01-27 | **data.monitoringConfig**: data 최상위에 **dwp_auth.public.sys_monitoring_configs** 현재 DB 설정값(config_key→config_value 맵) 추가. |
| 2026-01-27 | **monitoringConfig config_key별 사용 카드**: 각 config_key가 **가용성/지연/트래픽/에러** 카드 중 어디에서 쓰이는지, 기본값·설명과 함께 표로 명시. |
| 2026-01-26 | **KPI API 변경사항 통합**: 문서 위치 `docs/frontend-src/docs/api-spec` 명시. §4 앞에 **data.kpi 구조 개요** 표 추가(가용성·지연·트래픽·에러 4블록 및 statusHistory·loadPercentage·errorRate·errorCounts·errorBudgetRemaining·burnRate 등 현행 필드 반영). |
| 2026-01-26 | **프론트 정합성**: §8에 가용성 **Health Dots·Top Cause** FE 반영 내용 추가. 문서 위치 표기를 실제 경로 **docs/api-spec**으로 통일(.cursorrules·FE_BE_API_SPEC_WORKFLOW 기준). |