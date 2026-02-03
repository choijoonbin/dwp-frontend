# [Contract & Verification] SynapseX 전 메뉴 계약검증 + E2E 스모크 + Audit 의무 이벤트 검증

> **목적**: 프론트/백엔드가 Phase2~4를 동시에 끝내도 "붙였을 때 터지는" 일을 방지한다.  
> **OpenAPI 기준 Contract Test + PR merge blocking까지 연결.**

---

## 1. OpenAPI 계약 고정

### 1.1 Backend (Spring)

- Spring Controller에서 **OpenAPI 스펙 자동 생성** (springdoc-openapi 또는 Swagger)
- 노출 경로: `GET /openapi.json` (또는 `/v3/api-docs`)
- **버전 고정**: 스펙에 `info.version` 포함. breaking change 시 major bump.
- 필수 태그: `synapse-operations`, `synapse-data`, `synapse-knowledge`, `synapse-reporting`, `synapse-admin`, `synapse-audit`

### 1.2 Frontend

- OpenAPI 스펙으로 **TS 타입/클라이언트 자동 생성**
  - 도구: `openapi-typescript` 또는 `@hey-api/openapi-ts`
  - 생성 경로: `libs/shared-utils/src/api/generated/` (또는 별도 패키지)
- **breaking change 감지**: PR에서 `openapi.json` diff 시 CI에서 스펙 변경 여부 체크
- 생성 스크립트: `yarn generate:api` (package.json script)

### 1.3 Breaking Change 정책

| 변경 유형 | 허용 | PR Block |
|-----------|------|----------|
| 필드 추가 | ✅ | N |
| 필드 제거 | ❌ | Y |
| 타입 변경 (string→number 등) | ❌ | Y |
| endpoint 삭제 | ❌ | Y |
| query param 추가 | ✅ | N |
| query param 제거 | ❌ | Y |

---

## 2. Contract Tests (Backend)

### 2.1 공통 검증 항목

각 endpoint에 대해:

| 항목 | 검증 내용 |
|------|-----------|
| **status code** | 200/201/204 (성공), 400/401/403 (실패) |
| **ApiResponse 래퍼** | `{ status, message, data?, timestamp }` |
| **pagination schema** | 목록 API: `items` 또는 `content`, `total` 또는 `totalElements`, `pageInfo` 또는 `page/size/totalPages` |
| **필수 필드 존재** | DTO별 필수 필드 null/undefined 아님 |

### 2.2 X-Tenant-ID 정책

| 시나리오 | 기대 동작 | 테스트 |
|----------|-----------|--------|
| X-Tenant-ID **누락** | 400 Bad Request 또는 401 Unauthorized | ✅ 필수 |
| X-Tenant-ID **유효** (tenant=1) | 200 + data 또는 empty list | ✅ |
| X-Tenant-ID **무효** (존재하지 않는 tenant) | 403 Forbidden 또는 200 + empty | ✅ |

### 2.3 목록 endpoint 스키마 고정

목록 API 공통 스키마 (둘 중 하나):

**A) Spring Page 스타일**
```json
{
  "content": [...],
  "totalElements": 0,
  "totalPages": 0,
  "number": 0,
  "size": 20
}
```

**B) 커스텀 PageResponse**
```json
{
  "items": [...],
  "total": 0,
  "page": 0,
  "size": 20,
  "totalPages": 0
}
```

- **단일 소스**: 한 스타일로 통일. FE adapter가 `content`/`items` 모두 처리 가능하도록 유지.

---

## 3. Front Contract Validation

### 3.1 런타임 Zod Validate (개발 모드)

- `NODE_ENV=development` 또는 `VITE_DEV=true` 시에만 활성화
- API 응답 수신 후 `zod schema.safeParse(res.data)` 실행
- **mismatch 시**: `console.error` + (선택) Sentry `captureException`
- 위치: `libs/shared-utils` axios interceptor 또는 query wrapper

```ts
// 예시: 개발 모드에서만
if (import.meta.env.DEV) {
  const parsed = CaseListSchema.safeParse(res.data);
  if (!parsed.success) {
    console.error('[Contract] Case list schema mismatch', parsed.error);
  }
}
```

### 3.2 ApiResponse Unwrap 실패 표준화

- `status !== 'SUCCESS'` 또는 `status !== 'OK'` 시:
  - `throw new Error(res.message || 'API request failed')`
  - (선택) Sentry `captureMessage` with `res.errorCode`
- 모든 API 호출은 `ApiResponse<T>` 래퍼를 거치며, unwrap 실패 시 동일 패턴 적용

---

## 4. E2E Smoke (Playwright)

### 4.1 tenant=1 기준 최소 10개 시나리오

| # | 시나리오 | 경로 | 검증 내용 |
|---|----------|------|-----------|
| 1 | Cases 리스트 로드 | `/synapse/cases` | 테이블 렌더, empty 또는 row 존재 |
| 2 | Case 상세 3-panel | `/synapse/cases/:id` | 첫 row 클릭 → detail 3-panel 렌더 |
| 3 | View Lineage 이동 | case detail | "View Lineage" CTA → `/synapse/lineage?caseId=...` |
| 4 | Entity 이동 | `/synapse/entities` | 리스트 로드 → 첫 row 클릭 |
| 5 | Entity related docs 탭 | entity detail | "Related Docs" 탭 클릭 → 링크/empty |
| 6 | Action simulate | `/synapse/actions` | row 클릭 → drawer → Simulate 버튼 → 결과 표시 |
| 7 | Audit 필터링 | `/synapse/audit` | 필터(category/type 등) 적용 → 목록 갱신 |
| 8 | Audit 상세 열기 | `/synapse/audit` | 이벤트 row 클릭 → 상세 확장 |
| 9 | Documents 리스트 | `/synapse/documents` | 테이블/empty state |
| 10 | Anomalies 리스트 | `/synapse/anomalies` | KPI + 테이블 렌더 |
| 11 | Reconciliation 2탭 | `/synapse/reconciliation` | Ingestion Health / Integrity Report 탭 전환 |
| 12 | Action-recon Retry | `/synapse/action-recon` | (실패 row 있을 때) Retry 버튼 존재 |

### 4.2 실행 조건

- `E2E_STORAGE_STATE_PATH`: 인증 상태 (tenant=1 로그인)
- `baseURL`: `http://localhost:5173` (또는 env)
- seed 데이터: tenant=1에 최소 1 case, 1 entity, 1 document 권장

### 4.3 Empty State 허용

- seed가 없는 화면은 **empty-state 스냅샷**으로 통과
- **500 에러**는 절대 허용하지 않음 → 테스트 실패

---

## 5. Audit 의무 이벤트 체크 (자동)

### 5.1 의무 이벤트 목록

아래 액션 발생 시 `audit_event_log`에 기록되는지 **통합테스트**로 검증:

| 이벤트 타입 | 트리거 | 검증 |
|-------------|--------|------|
| `CASE_ASSIGN` | Case 담당자 변경 | ✅ |
| `CASE_STATUS_CHANGE` | Case 상태 변경 | ✅ |
| `CASE_COMMENT_CREATE` | Case 댓글 추가 | ✅ |
| `ACTION_SIMULATE` | Action 시뮬레이션 실행 | ✅ |
| `ACTION_APPROVE` | Action 승인 | ✅ |
| `ACTION_EXECUTE` | Action 실행 | ✅ |
| `POLICY_CHANGE` | 정책 변경 | ✅ |
| `GUARDRAIL_CHANGE` | 가드레일 변경 | ✅ |
| `DICTIONARY_CHANGE` | 사전 term 변경 | ✅ |
| `INTEGRATION_OUTBOX_ENQUEUE` | 아웃박스 enqueue | ✅ |
| `INTEGRATION_RESULT_UPDATE` | 연동 결과 업데이트 | ✅ |

### 5.2 테스트 방식

- **Backend 통합 테스트**: 각 API 호출 후 `audit_event_log` (또는 해당 테이블) 조회
- **검증**: `event_type`, `resource_id`, `actor` 등 필수 필드 존재
- **누락 시**: 테스트 실패 → **PR block**

### 5.3 FE 역할

- FE는 audit 이벤트를 직접 기록하지 않음 (BE가 API 호출 시 자동 기록)
- FE E2E에서 "Case 담당자 변경" 등 액션 수행 → BE 통합 테스트에서 audit 기록 확인

---

## 6. 데이터 시드/덤프

### 6.1 Phase용 Seed 스크립트

**tenant=1** 기준 최소 시드:

| 리소스 | 최소 수 | 비고 |
|--------|---------|------|
| documents | 5 | fi-doc-headers |
| open-items | 5 | fi-open-items |
| entities | 3 | entity list |
| cases | 3 | case list + detail |
| actions | 2 | action list + simulate |
| audit | 10 | audit_event_log (이벤트 종류 다양화) |

### 6.2 시드 스크립트 위치

- Backend: `scripts/seed/phase2-4-seed.sql` 또는 `SeedRunner.java`
- 실행: `./mvnw spring-boot:run -Dspring-boot.run.arguments=--seed=phase2-4` 또는 별도 스크립트

### 6.3 Empty State 정책

- seed가 없는 화면 → **empty-state** UI로 표시
- **500** 반환 금지 → E2E에서 empty state로 통과

---

## 7. CI/CD 연동

### 7.1 PR Merge Blocking 조건

| 체크 | 실패 시 |
|------|----------|
| `yarn nx test shared-utils -- synapse-contract` | PR block |
| `yarn playwright test e2e/synapse/` (Synapse smoke) | PR block |
| Backend: Contract tests | PR block |
| Backend: Audit event tests | PR block |
| OpenAPI diff (breaking change) | PR block |

### 7.2 권장 CI 단계

```
1. lint
2. build (FE)
3. unit tests (FE)
4. contract tests (FE: synapse-contract)
5. E2E smoke (Playwright) — optional on PR, required on main
6. Backend: contract + audit tests
```

### 7.3 실행 명령어

```bash
# FE Contract Test
yarn nx test shared-utils -- synapse-contract

# Synapse E2E Smoke (인증 파일 필요: yarn test:e2e:auth-setup)
yarn playwright test e2e/synapse/synapse-smoke.spec.ts

# Synapse E2E Verify — 로그인/테넌트, 10개 핵심 플로우, 실패 시나리오
yarn playwright test e2e/synapse/synapse-verify.spec.ts
```

---

## 8. 체크리스트 (구현 시)

### Backend

- [ ] OpenAPI 스펙 `/openapi.json` 노출
- [ ] X-Tenant-ID 누락 시 400/401 테스트
- [ ] 목록 API items/total/pageInfo 스키마 고정
- [ ] Audit 의무 이벤트 11종 통합 테스트
- [ ] Phase2-4 seed 스크립트

### Frontend

- [ ] OpenAPI → TS 타입/클라이언트 생성 파이프라인
- [ ] 개발 모드 zod validate (선택)
- [ ] ApiResponse unwrap 실패 시 Sentry/console 표준화
- [ ] Synapse E2E smoke 10+ 시나리오
- [ ] `e2e/utils/routes.ts`에 SYNAPSE_ROUTES 추가

### 공통

- [ ] PR에서 OpenAPI diff 감지
- [ ] CI에 contract + E2E 단계 추가
