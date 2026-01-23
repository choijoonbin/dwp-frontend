# 프론트엔드 → 백엔드 API 개발 요청 템플릿

## 📋 사용 방법

이 템플릿을 사용하여 백엔드 팀에 API 개발 요청을 전달하세요.

**권장 전달 방식**:
1. **마크다운 파일**로 작성 (이 템플릿 사용)
2. 파일명: `docs/api-spec/FRONTEND_API_REQUEST_{기능명}.md`
3. 또는 이슈 트래커(Jira/GitHub Issues)에 이 형식으로 작성

---

## 📝 API 개발 요청 템플릿

```markdown
# [기능명] API 개발 요청

## 1. 개요

### 요청 배경
<!-- 이 API가 필요한 이유, 비즈니스 요구사항 -->

### 우선순위
- [ ] P0 (긴급)
- [ ] P1 (높음)
- [ ] P2 (보통)
- [ ] P3 (낮음)

### 예상 완료일
<!-- 예: 2026-02-01 -->

### 관련 이슈/티켓
<!-- Jira 티켓 번호, GitHub Issue 번호 등 -->

---

## 2. API 명세

### 2.1 엔드포인트 정보

**Base URL**: `http://localhost:8080/api/{서비스명}`

**엔드포인트**: `{HTTP_METHOD} /api/{경로}`

**예시**:
- `GET /api/admin/users`
- `POST /api/auth/login`
- `PATCH /api/admin/users/{id}`

---

### 2.2 요청 (Request)

#### Headers
```yaml
필수:
  - Authorization: Bearer {JWT}
  - X-Tenant-ID: {tenantId}
  - Content-Type: application/json

선택:
  - X-User-ID: {userId}
  - X-Agent-ID: {agentId}
```

#### Path Parameters
```yaml
{id}: Long
  - 설명: 사용자 ID
  - 예시: 123
```

#### Query Parameters
```yaml
page: Integer (optional, default: 1)
  - 설명: 페이지 번호
  - 예시: 1

size: Integer (optional, default: 20)
  - 설명: 페이지 크기
  - 예시: 20

keyword: String (optional)
  - 설명: 검색 키워드 (이름/이메일 통합 검색)
  - 예시: "홍길동"

status: String (optional)
  - 설명: 사용자 상태 (ACTIVE, INACTIVE, SUSPENDED)
  - 예시: "ACTIVE"
```

#### Request Body
```json
{
  "userName": "홍길동",
  "email": "hong@example.com",
  "departmentId": 1,
  "roleIds": [1, 2],
  "status": "ACTIVE"
}
```

**필드 설명**:
| 필드명 | 타입 | 필수 | 설명 | 제약 조건 |
|--------|------|------|------|-----------|
| userName | String | ✅ | 사용자 이름 | 2-50자 |
| email | String | ✅ | 이메일 | 이메일 형식 |
| departmentId | Long | ❌ | 부서 ID | 존재하는 부서 ID |
| roleIds | List<Long> | ❌ | 역할 ID 목록 | 최대 10개 |
| status | String | ❌ | 사용자 상태 | ACTIVE, INACTIVE, SUSPENDED |

---

### 2.3 응답 (Response)

#### 성공 응답 (200 OK)
```json
{
  "status": "SUCCESS",
  "success": true,
  "message": "요청이 성공적으로 처리되었습니다.",
  "data": {
    "comUserId": 1,
    "userName": "홍길동",
    "email": "hong@example.com",
    "departmentId": 1,
    "departmentName": "개발팀",
    "status": "ACTIVE",
    "createdAt": "2026-01-22T00:00:00",
    "updatedAt": "2026-01-22T00:00:00"
  },
  "timestamp": "2026-01-22T00:00:00"
}
```

#### 에러 응답 (400 Bad Request)
```json
{
  "status": "ERROR",
  "success": false,
  "message": "입력값 검증에 실패했습니다.",
  "errorCode": "E4000",
  "timestamp": "2026-01-22T00:00:00"
}
```

#### 에러 응답 (404 Not Found)
```json
{
  "status": "ERROR",
  "success": false,
  "message": "요청한 리소스를 찾을 수 없습니다.",
  "errorCode": "E1004",
  "timestamp": "2026-01-22T00:00:00"
}
```

**응답 필드 설명**:
| 필드명 | 타입 | 설명 |
|--------|------|------|
| status | String | SUCCESS 또는 ERROR |
| success | Boolean | 성공 여부 (true/false) |
| message | String | 사용자 메시지 |
| data | Object | 실제 응답 데이터 (제네릭 타입) |
| errorCode | String | 에러 코드 (에러 시에만) |
| timestamp | String | 응답 생성 시각 (ISO 8601) |

---

### 2.4 권한 요구사항

**필수 권한**:
- 리소스: `menu.admin.users`
- 권한 코드: `VIEW` (조회), `CREATE` (생성), `UPDATE` (수정), `DELETE` (삭제)

**권한 체크 방식**:
- [ ] 서버 측 권한 체크 필요 (`@PreAuthorize` 또는 `PermissionEvaluator`)
- [ ] 프론트엔드에서만 체크 (서버 측 체크 불필요)

---

### 2.5 멀티테넌시

**테넌트 격리**:
- [ ] 필수 (`X-Tenant-ID` 헤더 필수)
- [ ] 선택 (테넌트 정보 없이도 동작)

**테넌트 필터링**:
- [ ] 모든 조회에 `tenant_id` 필터 적용
- [ ] 생성 시 `tenant_id` 자동 설정 (JWT에서 추출)

---

## 3. 비즈니스 로직

### 3.1 검증 규칙
1. 이메일 중복 체크 (같은 테넌트 내)
2. 사용자 이름 2-50자 제한
3. 부서 ID 존재 여부 확인
4. 역할 ID 목록 유효성 검증

### 3.2 트랜잭션 처리
- [ ] 단일 트랜잭션으로 처리
- [ ] 여러 트랜잭션으로 분리 (상세 설명 필요)

### 3.3 부가 기능
- [ ] 감사 로그 기록 (`com_audit_logs`)
- [ ] 이벤트 발행 (Redis Pub/Sub)
- [ ] 알림 발송 (이메일/SMS)

---

## 4. 성능 요구사항

### 4.1 응답 시간
- 목표: 200ms 이하
- 최대 허용: 500ms

### 4.2 페이징
- 기본 페이지 크기: 20
- 최대 페이지 크기: 100

### 4.3 캐싱
- [ ] 캐싱 필요 (TTL: ?초)
- [ ] 캐싱 불필요

---

## 5. 테스트 요구사항

### 5.1 테스트 케이스
1. 정상 케이스: 유효한 요청 → 성공 응답
2. 검증 실패: 필수 필드 누락 → 400 에러
3. 권한 없음: 권한 없는 사용자 → 403 에러
4. 리소스 없음: 존재하지 않는 ID → 404 에러

### 5.2 테스트 데이터
```sql
-- 필요한 시드 데이터
INSERT INTO com_users (tenant_id, user_name, email) VALUES (1, '테스트 사용자', 'test@example.com');
```

---

## 6. 참고 자료

### 6.1 관련 API
- `GET /api/admin/users` - 사용자 목록 조회 (기존)
- `GET /api/admin/users/{id}` - 사용자 상세 조회 (기존)

### 6.2 관련 문서
- [Admin Users CRUD API](./USER_ADMIN_CRUD_API.md)
- [RBAC Enforcement 가이드](../reference/SECURITY_RBAC_ENFORCEMENT.md)

### 6.3 UI/UX 링크
<!-- Figma 링크, 스크린샷 등 -->

---

## 7. 추가 요청 사항

### 7.1 우선순위 조정
<!-- 특정 기능을 먼저 구현해달라는 요청 -->

### 7.2 대안 제안
<!-- 백엔드 팀이 제안할 수 있는 대안 -->

### 7.3 질문/확인 사항
1. 기존 API와의 호환성은?
2. 마이그레이션 계획이 필요한가?
3. 프론트엔드에서 추가 작업이 필요한가?

---

## 8. 승인 및 진행 상황

### 백엔드 팀 확인
- [ ] 요청 검토 완료
- [ ] 개발 시작
- [ ] 개발 완료
- [ ] 테스트 완료
- [ ] 배포 완료

### 프론트엔드 팀 확인
- [ ] API 테스트 완료
- [ ] 통합 완료
- [ ] 배포 승인

---

## 9. 변경 이력

| 날짜 | 변경자 | 변경 내용 |
|------|--------|----------|
| 2026-01-22 | 프론트엔드 | 초기 요청 작성 |

---

## 📌 체크리스트 (백엔드 팀용)

### 개발 전
- [ ] 요청 사항 명확화 (필요 시 미팅)
- [ ] 기존 코드 재사용 가능 여부 확인
- [ ] DB 스키마 변경 필요 여부 확인
- [ ] Flyway 마이그레이션 계획 수립

### 개발 중
- [ ] ApiResponse<T> 엔벨로프 사용
- [ ] 표준 헤더 7개 전파 확인
- [ ] 멀티테넌시 격리 보장
- [ ] 권한 체크 적용
- [ ] GlobalExceptionHandler로 에러 처리

### 개발 후
- [ ] 단위 테스트 작성
- [ ] 통합 테스트 작성 (Testcontainers)
- [ ] OpenAPI 문서 확인 (`/v3/api-docs`)
- [ ] API 스펙 문서 업데이트 (`docs/api-spec/`)
- [ ] 프론트엔드 팀에 완료 알림
```

---

## 📌 간단 버전 (빠른 요청용)

간단한 API 요청의 경우 다음 형식도 사용 가능합니다:

```markdown
# [기능명] API 개발 요청 (간단 버전)

## 요청 배경
<!-- 한 문단으로 요약 -->

## API 명세

**엔드포인트**: `{METHOD} /api/{경로}`

**요청**:
- Headers: `Authorization: Bearer {JWT}`, `X-Tenant-ID: {id}`
- Query/Path/Body: (간단히 설명)

**응답**:
- 성공: `ApiResponse<{DTO}>`
- 에러: 표준 에러 응답

## 우선순위
- [ ] P0 | [ ] P1 | [ ] P2 | [ ] P3

## 예상 완료일
<!-- 날짜 -->
```

---

## 📌 Jira/이슈 트래커 형식

이슈 트래커를 사용하는 경우, 다음 필드를 채워주세요:

**제목**: `[API 요청] {기능명} - {엔드포인트}`

**설명**: 위 템플릿의 "2. API 명세" 섹션을 복사하여 붙여넣기

**라벨/태그**: `api-request`, `frontend`, `{서비스명}`

**우선순위**: P0/P1/P2/P3

**예상 완료일**: 날짜 지정

---

## ✅ 작성 가이드

### DO (권장)
- ✅ 명확한 엔드포인트 경로와 HTTP 메서드 명시
- ✅ Request/Response 예시 JSON 포함
- ✅ 필드별 타입, 필수 여부, 제약 조건 명시
- ✅ 에러 케이스 명시
- ✅ 권한 요구사항 명시
- ✅ 비즈니스 로직 설명

### DON'T (피해야 할 것)
- ❌ 모호한 설명 ("사용자 관련 API")
- ❌ 예시 없이 요청 ("사용자 생성 API 만들어주세요")
- ❌ 권한 요구사항 누락
- ❌ 멀티테넌시 고려 누락

---

## 📚 참고

- [기존 API 스펙 예시](./USER_ADMIN_CRUD_API.md)
- [프론트엔드 API 스펙](./FRONTEND_API_SPEC.md)
- [Admin API Quick Reference](../reference/ADMIN_API_QUICKREF.md)
- [RBAC Enforcement 가이드](../reference/SECURITY_RBAC_ENFORCEMENT.md)
