# 백엔드 API 응답 구조 수정 요청

## 문제 상황

프론트엔드에서 `/api/admin/roles` API를 호출할 때, 응답 구조가 프론트엔드 타입 정의와 일치하지 않아 오류가 발생하고 있습니다.

## 현재 백엔드 응답 구조

```json
{
    "status": "SUCCESS",
    "message": "요청이 성공적으로 처리되었습니다.",
    "data": {
        "items": [
            {
                "comRoleId": 1,
                "roleCode": "ADMIN",
                "roleName": "Administrator",
                "description": "Full system access",
                "createdAt": "2026-01-21T11:41:27.559529"
            }
        ],
        "page": 1,
        "size": 200,
        "totalItems": 1,
        "totalPages": 1
    }
}
```

## 프론트엔드에서 기대하는 응답 구조

프론트엔드의 `RoleSummary` 타입 정의:

```typescript
export type RoleSummary = {
  id: string;                    // 필수: 역할의 고유 식별자 (문자열)
  roleName: string;              // 필수: 역할 이름
  roleCode: string;              // 필수: 역할 코드
  description?: string | null;   // 선택: 역할 설명
  status: 'ACTIVE' | 'INACTIVE'; // 필수: 역할 상태
  createdAt: string;            // 필수: 생성일시 (ISO 8601)
  memberCount?: number;          // 선택: 멤버 수
};
```

## 수정 요청 사항

### 1. 필드명 변경: `comRoleId` → `id`

**현재**: `comRoleId: 1` (숫자)  
**요청**: `id: "1"` (문자열)

**이유**: 
- 프론트엔드 타입 정의에서 `id`는 `string` 타입입니다.
- REST API 표준에서 리소스 ID는 문자열로 표현하는 것이 일반적입니다.
- 다른 엔드포인트(`/api/admin/roles/:roleId`)와의 일관성을 위해 문자열로 통일해야 합니다.

### 2. 필수 필드 추가: `status`

**요청**: `status: 'ACTIVE' | 'INACTIVE'` 필드 추가

**이유**:
- 프론트엔드에서 역할의 활성/비활성 상태를 표시하고 필터링하는 데 필요합니다.
- UI에서 상태에 따라 다른 색상의 Chip을 표시합니다.

**예시**:
```json
{
    "id": "1",
    "roleCode": "ADMIN",
    "roleName": "Administrator",
    "status": "ACTIVE",  // 추가 필요
    "description": "Full system access",
    "createdAt": "2026-01-21T11:41:27.559529"
}
```

### 3. 선택 필드 추가: `memberCount` (권장)

**요청**: `memberCount?: number` 필드 추가 (선택 사항)

**이유**:
- 프론트엔드 UI에서 역할 목록에 멤버 수를 표시합니다.
- 없으면 기본값 `0`으로 처리하지만, 있으면 더 정확한 정보를 제공할 수 있습니다.

**예시**:
```json
{
    "id": "1",
    "roleCode": "ADMIN",
    "roleName": "Administrator",
    "status": "ACTIVE",
    "description": "Full system access",
    "createdAt": "2026-01-21T11:41:27.559529",
    "memberCount": 5  // 선택 사항
}
```

## 수정 후 예상 응답 구조

```json
{
    "status": "SUCCESS",
    "message": "요청이 성공적으로 처리되었습니다.",
    "data": {
        "items": [
            {
                "id": "1",                    // comRoleId → id (문자열로 변환)
                "roleCode": "ADMIN",
                "roleName": "Administrator",
                "status": "ACTIVE",            // 추가 필요
                "description": "Full system access",
                "createdAt": "2026-01-21T11:41:27.559529",
                "memberCount": 5              // 선택 사항 (권장)
            }
        ],
        "page": 1,
        "size": 200,
        "totalItems": 1,
        "totalPages": 1
    }
}
```

## 영향 범위

이 변경사항은 다음 API 엔드포인트에도 영향을 미칠 수 있습니다:
- `GET /api/admin/roles` (목록 조회)
- `GET /api/admin/roles/:roleId` (상세 조회) - 응답 구조도 동일하게 수정 필요
- `POST /api/admin/roles` (생성) - 응답 구조도 동일하게 수정 필요
- `PUT /api/admin/roles/:roleId` (수정) - 응답 구조도 동일하게 수정 필요

## 우선순위

1. **필수 (즉시 수정 필요)**: `comRoleId` → `id` (문자열), `status` 필드 추가
2. **권장 (가능하면 추가)**: `memberCount` 필드 추가

## 참고

프론트엔드 타입 정의 위치: `libs/shared-utils/src/admin/types.ts`
