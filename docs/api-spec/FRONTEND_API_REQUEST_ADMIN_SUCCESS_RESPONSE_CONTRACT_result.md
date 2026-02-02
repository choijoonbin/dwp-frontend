# Admin API 성공 응답 형식 약속 — BE 결과 (BE → FE)

- **작성일**: 2026-02-02
- **대상 요청**: `FRONTEND_API_REQUEST_ADMIN_SUCCESS_RESPONSE_CONTRACT.md`
- **목적**: Admin API 성공 시 FE가 동일한 기준으로 성공 여부를 판단할 수 있도록 확정된 규칙을 공유합니다.

---

## 1. 확정 규칙 (옵션 A 적용)

**성공 시 항상 `data`에 성공 여부를 명시합니다.**

- payload가 없는 API(삭제, 역할 저장 등)는 **`data: { "success": true }`** 를 반환합니다.
- payload가 있는 API(상세 조회, 생성 등)는 **`data`에 실제 payload**를 담고, 루트에 **`success: true`** 도 함께 내려갑니다.

### FE 성공 판단 기준 (권장)

다음 **둘 중 하나**를 만족하면 성공으로 처리하면 됩니다.

- `res.status === 'SUCCESS'`
- `res.data?.success === true`

두 조건 모두 만족하는 응답을 BE가 보장하므로, FE는 위 둘 중 편한 쪽으로 통일해 사용하시면 됩니다.

---

## 2. 응답 예시

### 2.1 payload 없는 성공 (삭제, 역할 저장 등)

```json
{
  "status": "SUCCESS",
  "message": "요청이 성공적으로 처리되었습니다.",
  "data": {
    "success": true
  },
  "success": true,
  "timestamp": "2026-02-02T18:00:00"
}
```

### 2.2 payload 있는 성공 (조회, 생성 등)

```json
{
  "status": "SUCCESS",
  "message": "요청이 성공적으로 처리되었습니다.",
  "data": {
    "comUserId": 1,
    "userName": "홍길동",
    "email": "user@example.com"
  },
  "success": true,
  "timestamp": "2026-02-02T18:00:00"
}
```

### 2.3 실패 (참고)

```json
{
  "status": "ERROR",
  "message": "엔티티를 찾을 수 없습니다.",
  "errorCode": "E3000",
  "success": false,
  "timestamp": "2026-02-02T18:00:00"
}
```

---

## 3. 적용된 API (payload 없음 → `data: { "success": true }`)

| 메서드 | 경로 | 비고 |
|--------|------|------|
| DELETE | `/api/admin/users/:userId` | 사용자 삭제(비활성화) |
| PUT | `/api/admin/users/:userId/roles` | 사용자 역할 할당 |
| DELETE | `/api/admin/users/:userId/roles/:roleId` | 사용자 역할 제거 |
| DELETE | `/api/admin/roles/:roleId` | 역할 삭제 |
| PUT | `/api/admin/roles/:roleId/members` | 역할 멤버 일괄 저장 |
| DELETE | `/api/admin/roles/:roleId/members/:memberId` | 역할 멤버 제거 |
| PUT | `/api/admin/roles/:roleId/permissions` | 역할 권한 저장 |
| DELETE | `/api/admin/departments/:departmentId` | 부서 삭제 |
| DELETE | `/api/admin/resources/:resourceId` | 리소스 삭제 |
| DELETE | `/api/admin/menus/:menuId` | 메뉴 삭제 |
| PUT | `/api/admin/menus/reorder` | 메뉴 정렬 |
| DELETE | `/api/admin/code-usages/:id` | 코드 사용 삭제 |

**비밀번호 초기화** `POST /api/admin/users/:userId/reset-password` 는 payload가 있으므로 기존처럼 `data`에 초기화 결과 객체를 반환합니다.

---

## 4. BE 변경 사항 요약

- **dwp-core** `ApiResponse`: payload 없는 성공용 **`ApiResponse.successOk()`** 추가 → `data: { "success": true }` 반환.
- **dwp-auth-server** Admin 컨트롤러: 위 표의 void 성공 API는 모두 **`ApiResponse.successOk()`** 로 통일.

이 규칙은 **Admin 영역**에서 “성공 시 다이얼로그 닫기 / 초록 토스트”가 필요한 모든 API에 동일하게 적용됩니다.

---

## 5. FE 측 정리 제안

- 성공 판단: **`res.status === 'SUCCESS'`** 또는 **`res.data?.success === true`** 중 하나로 통일.
- 삭제 호출: **`DELETE /api/admin/users/:userId`** (POST `/delete` 미지원).
- 위 규칙을 FE 공통 API 래퍼/인터셉터에 반영하면, Admin 전반에서 동일하게 동작합니다.
