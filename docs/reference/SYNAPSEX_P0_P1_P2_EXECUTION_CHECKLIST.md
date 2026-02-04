# SynapseX P0/P1/P2 실행 체크리스트 + DoD + 검증 시나리오

> DWP/SynapseX FE 분석 결과 기반 실행 PRD  
> Jira/Notion 붙여넣기용 완성 문서  
> 작성: 2026-02-04  
> **최종 검증**: `docs/reference/FE_FINAL_VERIFICATION_REPORT.md`

---

## (A) "FE만으로 해결 가능" vs "BE 의존(스펙/지원 필요)" 구분표

| 구분 | 항목 | 코드 근거(파일/함수/라인) | 비고 |
|------|------|---------------------------|------|
| **FE만** ✅ | P0-1 SSE X-User-ID 추가 | `use-synapse-agent-stream.ts` 101행 `getUserId()`, 118행 `...(userId && { 'X-User-ID': userId })` | **완료** |
| **FE만** ✅ | P0-2 Lineage mock fallback 차단 | `lineage/index.tsx` 50행 error/refetch 추출, 51~63행 steps `return []`, 88~98행 ErrorStateWithRetry, 100~125행 Empty | **완료** |
| **FE만** ✅ | P1-1 Documents 이중 필터 제거 | `use-documents-list.ts` — filteredItems 제거, apiData 직접 사용 | **완료** |
| **FE+BE** ✅ | P1-2 OpenItems BE 계약 파라미터 | `getFiOpenItems` bukrs, type, status, fromDueDate, toDueDate, partyId, lifnr, kunnr | **완료** |
| **BE 확인** ✅ | OpenItems belnr/gjahr | 숨김 유지. `OPEN_ITEMS_BELNR_GJAHR_BE_REQUEST.md` | **완료** |
| **BE 확인** | Lineage belnr/gjahr | `getLineage`(378~386행)는 caseId, docKey, partyId, rawEventId, asOf만 전달. belnr/gjahr/bukrs 미전달 | docKey가 `bukrs-belnr-gjahr` 형태면 충분할 수 있음 |
| **BE 확인** | HITL Aura↔Synapse 연동 | `hitl-api.ts`: `/api/aura/hitl/approve|reject/{requestId}`. SSE는 `/api/synapse/agent-tools/agents/finance/stream` | BE 연동 여부 확인 필요 |

---

## (B) 팀별 실행 체크리스트 (P0/P1/P2) — FE 관점

### P0 (차단)

#### P0-1: SSE X-User-ID 추가 ✅ 완료

| 항목 | 내용 |
|------|------|
| **완료 상태** | 101행 `getUserId()`, 118행 `...(userId && { 'X-User-ID': userId })` |
| **검증** | S0: DevTools Network → finance/stream → Request Headers에 X-User-ID 존재 |

#### P0-2: Lineage mock fallback 운영 차단 ✅ 완료

| 항목 | 내용 |
|------|------|
| **완료 상태** | 50행 error/refetch, 51~63행 steps `return []`, 88~98행 ErrorStateWithRetry, 100~125행 Empty |
| **검증** | S2: BE 500 시 mock 미표시, ErrorStateWithRetry 표시 |

---

### P1 (품질)

#### P1-1: Documents FE 이중 필터링 제거 ✅ 완료

| 항목 | 내용 |
|------|------|
| **완료 상태** | filteredItems 제거, apiData 직접 사용. BE 필터 신뢰 |
| **검증** | S3: querystring 1:1, FE 이중 필터 미적용 |

#### P1-2: OpenItems BE 계약표 파라미터 전달 ✅ 완료

| 항목 | 내용 |
|------|------|
| **완료 상태** | getFiOpenItems: bukrs, type, status, fromDueDate, toDueDate, partyId, lifnr, kunnr. URL params 연동 |
| **검증** | S4: querystring 포함, 서버 결과 변화 |

#### P1-2a: OpenItems belnr/gjahr 숨김 유지 ✅ 완료

| 항목 | 내용 |
|------|------|
| **완료 상태** | FilterBar/URL 미노출. `docs/reference/OPEN_ITEMS_BELNR_GJAHR_BE_REQUEST.md` |
| **검증** | S5: belnr/gjahr 미노출 |

---

### P2 (선택)

#### P2-1: SSE Last-Event-ID 기대 동작 정의

| 항목 | 내용 |
|------|------|
| **현재 상태(근거)** | `use-synapse-agent-stream.ts` 161~163행: `id:` 파싱 → lastEventIdRef.current 저장. 110행: 재연결 시 Last-Event-ID 헤더. 262~295행: attemptReconnect에서 lastEventIdRef.current 전달 |
| **문제** | Last-Event-ID 의미/제약 문서화 부족 |
| **해결 목표** | FE 기대 동작 문서화 |
| **변경 포인트** | docs/reference 또는 훅 주석에 "재연결 시 사용. HITL approve 후 resume과 무관" 명시 |
| **검증 항목** | — |

---

## (C) Definition of Done (DoD)

### P0-1: SSE X-User-ID 추가

| 항목 | 내용 |
|------|------|
| **코드 근거** | `libs/shared-utils/src/agent/use-synapse-agent-stream.ts` 104~110행. headers 객체에 X-User-ID 없음 |
| **변경 후 기대 동작** | `POST /api/synapse/agent-tools/agents/finance/stream` 요청 시 Request Headers에 `X-User-ID: {userId}` 포함. userId는 `getUserId()` (user-id-storage.ts 8행) — localStorage `dwp-user-id` |
| **실패 시 사용자 UX** | userId가 null이면 헤더 미포함. BE가 필수 요구 시 400/401. HITL approve 시 hitl-api.ts에서 `!finalUserId` throw → use-case-hitl.ts onError → toast error |
| **로깅/추적** | (선택) `process.env.NODE_ENV === 'development'` 시 `console.log('[SSE] connectStream headers', { hasUserId: !!userId })` |
| **QA 체크포인트** | DevTools Network → finance/stream 요청 선택 → Request Headers에 `X-User-ID` 존재 확인. 값이 localStorage `dwp-user-id`와 일치 |

---

### P0-2: Lineage mock fallback 운영 차단 + error/empty 분기

| 항목 | 내용 |
|------|------|
| **코드 근거** | `apps/remotes/synapsex/src/pages/lineage/index.tsx` 49~62행. `const { data: apiData }` — error 미사용. `apiData?.steps?.length` falsy 시 61행 `return mockLineageSteps` |
| **변경 후 기대 동작** | 1) API 500/timeout → ErrorStateWithRetry 표시. 2) lineageParams 없음 → Empty "caseId, docKey, partyId 중 하나 필요". 3) API 성공 + steps 빈 배열 → Empty "lineage 데이터 없음". 4) mockLineageSteps 미표시 |
| **실패 시 사용자 UX** | Error: ErrorStateWithRetry (title, message, onRetry). Empty: Icon + 메시지. ErrorStateWithRetry는 `apps/remotes/synapsex/src/components/ux/error-state-with-retry.tsx` (title, message, onRetry props) |
| **로깅/추적** | (선택) `if (error) console.warn('[Lineage] API error', error)`. 개발환경만 |
| **QA 체크포인트** | 1) `/lineage` (파라미터 없음) → Empty 안내. 2) `/lineage?caseId=xxx` + BE 500 강제 → ErrorStateWithRetry. mock 미표시. 3) BE 200 + steps:[] → Empty "데이터 없음" |

---

### P1-1: Documents FE 이중 필터링

| 항목 | 내용 |
|------|------|
| **코드 근거** | `apps/remotes/synapsex/src/pages/documents/hooks/use-documents-list.ts` 16~27행 API 전달. 29~62행 filteredItems useMemo로 클라이언트 필터 재적용 |
| **변경 후 기대 동작** | BE 필터 지원 시: filteredItems 제거, items = (apiData ?? []).slice(...). totalCount = apiData?.length. BE 미지원 시: 기존 유지 + 주석 |
| **실패 시 사용자 UX** | BE 미지원인데 FE 필터 제거 시: 필터 적용 안 됨. BE 스펙 확인 선행 필수 |
| **로깅/추적** | — |
| **QA 체크포인트** | dateFrom/dateTo/bukrs/status 적용 시 Network `fi-doc-headers` querystring에 해당 값 포함. 결과가 서버 기준으로 변화 |

---

### P1-2: OpenItems 필터 파라미터 전달

| 항목 | 내용 |
|------|------|
| **코드 근거** | `libs/shared-utils/src/api/synapse-data-api.ts` 273~278행. getFiOpenItems는 limit, page, size만. OpenItemsListParams(252~265행)에 dueFrom, dueTo, bukrs, partyId, docKey, itemType 등 |
| **변경 후 기대 동작** | BE 지원 파라미터가 querystring에 포함. FilterBar 또는 URL params 연동 |
| **실패 시 사용자 UX** | BE 미지원 파라미터 전달 시 BE 무시 또는 400 |
| **로깅/추적** | — |
| **QA 체크포인트** | bukrs/itemType/dueFrom/dueTo 적용 시 `fi-open-items` 요청 querystring에 파라미터 포함 |

---

### P1-2a: OpenItems belnr/gjahr (BE 미지원)

| 항목 | 내용 |
|------|------|
| **코드 근거** | OpenItemsListParams에 belnr, gjahr 없음. getFiOpenItems querystring에도 없음 |
| **변경 후 기대 동작** | 문서에 "현재 Open Items belnr/gjahr 필터는 BE 미지원" 명시. BE 요청안 작성 |
| **실패 시 사용자 UX** | BE 미지원 시 FE에서 belnr/gjahr 전달 불가. FilterBar에 해당 필터 숨김 또는 "준비 중" 표시 |
| **로깅/추적** | — |
| **QA 체크포인트** | — |

---

### P2-1: SSE Last-Event-ID 기대 동작

| 항목 | 내용 |
|------|------|
| **코드 근거** | `use-synapse-agent-stream.ts` 161~163행 id 파싱 → lastEventIdRef. 110행 Last-Event-ID 헤더. 262~295행 attemptReconnect에서 lastEventIdRef.current 전달 |
| **변경 후 기대 동작** | 문서화: "Last-Event-ID는 스트림 끊김 시 재연결용. HITL approve 후 resume과 무관(동일 연결 유지)" |
| **실패 시 사용자 UX** | — |
| **로깅/추적** | — |
| **QA 체크포인트** | — |

---

## (D) 수정/적용안: "코드가 아닌 변경 포인트 명세"

### 1) P0-1: SSE headers에 X-User-ID 추가

| 파일 | 위치 | 변경 내용 |
|------|------|-----------|
| `libs/shared-utils/src/agent/use-synapse-agent-stream.ts` | 상단 import | `import { getUserId } from '../auth/user-id-storage';` 추가 |
| 동일 | connectStream 내부 ~92행 (token/tenantId/agentId 다음) | `const userId = getUserId();` 추가 |
| 동일 | headers 객체 104~110행 | `...(userId && { 'X-User-ID': userId })` 추가 (Authorization 다음, Last-Event-ID 전) |

**X-User-ID Source of Truth**: `libs/shared-utils/src/auth/user-id-storage.ts` `getUserId()` — localStorage `dwp-user-id`. 로그인 시 Host가 저장. 비어 있으면 `null` 반환.

---

### 2) P0-2: Lineage mock 제거/차단, error 우선 분기, empty state 분기

| 파일 | 위치 | 변경 내용 |
|------|------|-----------|
| `apps/remotes/synapsex/src/pages/lineage/index.tsx` | 49행 | `const { data: apiData, error, isLoading, refetch } = useLineageQuery(lineageParams)` — error, refetch 추출 |
| 동일 | return 전 (88행 이전) | `if (error) return <ErrorStateWithRetry title="Failed to load lineage" message={error.message} onRetry={refetch} />` |
| 동일 | return 전 | `if (!lineageParams) return <EmptyState message="Provide caseId, docKey, or partyId in URL" />` (EmptyState 컴포넌트 또는 Box+Typography로 구현) |
| 동일 | 50~62행 steps useMemo | `if (apiData?.steps?.length)` ? map : `[]`. `return mockLineageSteps` 제거 |
| 동일 | import | ErrorStateWithRetry import 추가. mockLineageSteps import는 EvidencePanel 등 다른 용도로 사용 시 유지, steps fallback 용도만 제거 |

**ErrorStateWithRetry**: `apps/remotes/synapsex/src/components/ux/error-state-with-retry.tsx` — props: title, message, onRetry.

---

### 3) P1-1: Documents 이중 필터링 정책 결정안

| 옵션 | 조건 | 변경 내용 |
|------|------|-----------|
| **옵션 A (BE 필터 신뢰)** | BE가 dateFrom, dateTo, bukrs, status, xblnr, amountMin, amountMax 지원 확인됨 | `use-documents-list.ts` 29~62행 filteredItems useMemo 제거. `items = (apiData ?? []).slice(page*pageSize, page*pageSize+pageSize)`. totalCount = apiData?.length ?? 0 |
| **옵션 B (BE 미지원)** | BE 스펙 확인 결과 미지원 | 변경 없음. 주석 추가: "BE가 dateFrom/dateTo/bukrs/status 미지원 시 클라이언트 필터 유지. BE 스펙 확장 요청" |

**선택 기준**: `getFiDocHeaders`(synapse-data-api.ts 136~152행)는 이미 querystring에 dateFrom, dateTo, bukrs, status 등 전달. BE가 실제로 필터링하는지 OpenAPI/백엔드 확인. 확인됨 → 옵션 A. 미확인/미지원 → 옵션 B.

---

### 4) P1-2: OpenItems 쿼리스트링 추가 파라미터

| FE 파라미터 | BE querystring | getFiOpenItems 추가 | BE 지원 여부 |
|-------------|----------------|---------------------|--------------|
| dueFrom | dueFrom | 278행 이후 `if (params?.dueFrom) query.set('dueFrom', params.dueFrom)` | BE 확인 |
| dueTo | dueTo | 동일 | BE 확인 |
| bukrs | bukrs | 동일 | BE 확인 |
| partyId | partyId | 동일 | BE 확인 |
| docKey | docKey | 동일 | BE 확인 |
| itemType | itemType | 동일 | BE 확인 |
| cleared | cleared | 동일 | BE 확인 |
| paymentBlock | paymentBlock | 동일 | BE 확인 |
| disputeFlag | disputeFlag | 동일 | BE 확인 |
| belnr | belnr | — | **BE 미지원** (P1-2a) |
| gjahr | gjahr | — | **BE 미지원** (P1-2a) |

**적용 순서**: 1) BE OpenAPI 확인 2) 지원 파라미터만 추가 3) Open Items 페이지 FilterBar 또는 URL params 연동

---

### 5) P1-2a: belnr/gjahr 미지원 시 FE 대응 + BE 요청안

| 대응 | 내용 |
|------|------|
| **문서화** | `docs/reference/` 또는 Open Items 페이지 주석: "현재 Open Items belnr/gjahr 필터는 BE 미지원" |
| **UI** | FilterBar에 belnr/gjahr 필터 숨김. 또는 "준비 중" 비활성화 표시 |
| **BE 요청안** | "`GET /api/synapse/entities/fi-open-items` parameters에 belnr(전표번호), gjahr(회계연도) 추가 요청. FI 전표 단위 필터링에 필요" |

---

### 6) P2-1: Last-Event-ID 의미/제약

| 항목 | 내용 |
|------|------|
| **저장** | `use-synapse-agent-stream.ts` 161~163행. SSE `id:` 라인 파싱 → `lastEventIdRef.current = eventId` |
| **전송** | 110행. 재연결 시 `connectStream` 호출 시 `lastEventId` 파라미터 → headers `Last-Event-ID` |
| **재연결** | 262~295행 `attemptReconnect`. `connectStream({ lastEventId: lastEventIdRef.current })` 전달 |
| **의미** | 스트림 **끊김** 시 재연결 요청에 Last-Event-ID 포함 → BE가 해당 ID 이후 이벤트만 재전송. HITL approve/reject 후 resume과는 무관(동일 연결 유지) |

---

## (E) 검증 시나리오 (수동) + 네트워크 확인 포인트

### S0 (P0-1): Case Detail에서 finance/stream 요청 헤더에 X-User-ID 존재 확인

| 단계 | 절차 |
|------|------|
| 1 | 로그인 후 Case Detail 진입 (`/synapse/cases/{caseId}`) |
| 2 | "Start Analysis" 클릭 |
| 3 | DevTools → Network → `finance/stream` 요청 선택 |
| 4 | Request Headers 확인 |

**기대 결과**: `X-User-ID`, `X-Tenant-ID`, `Authorization`, `X-Agent-ID` 존재. X-User-ID 값이 localStorage `dwp-user-id`와 일치.

**실패 시**: X-User-ID 없음 → P0-1 미완료.

---

### S1 (HITL): HITL approve 후 기존 stream에서 이벤트가 계속 흐르고 [DONE]까지 완료

| 단계 | 절차 |
|------|------|
| 1 | Case Detail → Start Analysis |
| 2 | HITL 이벤트 발생 시 Drawer 자동 오픈 |
| 3 | Approve 클릭 |
| 4 | Network에서 `hitl/approve/{requestId}` 200 확인 |
| 5 | 동일 `finance/stream` 요청이 끊기지 않고 이어서 이벤트 수신 |
| 6 | `[DONE]` 또는 스트림 종료까지 대기 |

**기대 결과**: approve 200. stream 요청 상태 "pending" 또는 이벤트 수신 중. UI에 추가 thought/content 이벤트 표시.

**실패 시**: 스트림 끊김 또는 이벤트 없음 → BE Aura↔Synapse 연동 점검.

---

### S2 (P0-2): Lineage API 500/timeout 시 mock이 안 뜨고 ErrorStateWithRetry 표시

| 단계 | 절차 |
|------|------|
| 1 | `/lineage?caseId=xxx` 진입 (유효 caseId) |
| 2 | BE 500/timeout 강제 (프록시, BE 중단, 또는 mock 서버 500 반환) |
| 3 | 화면 확인 |

**기대 결과**: ErrorStateWithRetry 표시 ("Failed to load lineage" 등). mockLineageSteps(가짜 파이프라인) **미표시**.

**실패 시**: mock 표시 → P0-2 미완료.

---

### S3 (P1-1): Documents 필터 적용 시 querystring과 서버 결과 변화 확인 (이중필터 제거 시)

| 단계 | 절차 |
|------|------|
| 1 | `/documents` 진입 |
| 2 | FilterBar에서 dateFrom, dateTo, bukrs, status 설정 |
| 3 | Network → `fi-doc-headers` 요청 확인 |
| 4 | querystring에 dateFrom, dateTo, bukrs, status 포함 여부 확인 |
| 5 | (옵션 A 적용 시) 응답 결과가 서버 필터 기준으로만 변화하는지 확인 |

**기대 결과**: querystring에 필터 포함. FE 이중 필터 제거 시 결과가 서버 기준 1:1.

**실패 시**: querystring에 필터 없음 → API 호출부 확인. 결과가 필터와 무관 → BE 또는 FE 필터 로직 확인.

---

### S4 (P1-2): OpenItems에서 bukrs/type/status/dueFrom/to 등 전달 확인

| 단계 | 절차 |
|------|------|
| 1 | Open Items 페이지에 FilterBar 추가 후 (또는 URL `?bukrs=1000&itemType=AP&dueFrom=2025-01-01&dueTo=2025-12-31`) |
| 2 | `fi-open-items` 요청 확인 |
| 3 | querystring에 bukrs, itemType, dueFrom, dueTo 등 포함 여부 확인 |

**기대 결과**: limit, page, size 외 적용된 파라미터가 querystring에 포함.

**실패 시**: limit, page, size만 있음 → getFiOpenItems 수정 미적용.

---

## 실행 순서

**FE가 단독으로 닫을 수 있는 P0 2개를 먼저 처리해야 한다.**

1. **P0-1** (약 15분): SSE X-User-ID 추가 → S0 검증
2. **P0-2** (약 45분): Lineage mock 차단 + error/empty 분기 → S2 검증
3. **P1-1**: BE 스펙 확인 후 Documents 이중 필터 정책 결정 → S3 검증
4. **P1-2**: BE OpenAPI 확인 후 OpenItems 필터 전달 → S4 검증
5. **P1-2a**: belnr/gjahr 문서화 + BE 요청
6. **P2-1**: Last-Event-ID 문서화 (선택)

P0 완료 후 S0, S2 검증 통과 시 배포 가능. P1/P2는 BE 협의 후 순차 진행.
