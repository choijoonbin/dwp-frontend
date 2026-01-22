# 백엔드 API 응답 수정 상태 확인 요청

## 현재 상황

프론트엔드에서 `/api/admin/roles` API를 호출한 결과, 백엔드 수정이 아직 반영되지 않은 것으로 확인되었습니다.

## 실제 API 응답 (2026-01-21 확인)

```json
GET /api/admin/roles?size=1000

{
    "status": "SUCCESS",
    "message": "요청이 성공적으로 처리되었습니다.",
    "data": {
        "items": [
            {
                "comRoleId": 1,              // ❌ 여전히 comRoleId 사용
                "roleCode": "ADMIN",
                "roleName": "Administrator",
                "description": "Full system access",
                "createdAt": "2026-01-21T11:41:27.559529"
                // ❌ id 필드 없음
                // ❌ status 필드 없음
            }
        ],
        "page": 1,
        "size": 200,
        "totalItems": 1,
        "totalPages": 1
    }
}
```

## 요청한 수정 사항

### 1. 필드명 변경: `comRoleId` → `id` (문자열)
**현재**: `comRoleId: 1` (숫자)  
**요청**: `id: "1"` (문자열)

### 2. 필수 필드 추가: `status`
**요청**: `status: 'ACTIVE' | 'INACTIVE'` 필드 추가

## 수정 후 예상 응답

```json
{
    "status": "SUCCESS",
    "message": "요청이 성공적으로 처리되었습니다.",
    "data": {
        "items": [
            {
                "id": "1",                    // ✅ comRoleId → id (문자열)
                "roleCode": "ADMIN",
                "roleName": "Administrator",
                "status": "ACTIVE",            // ✅ 추가 필요
                "description": "Full system access",
                "createdAt": "2026-01-21T11:41:27.559529",
                "memberCount": 5               // 선택 사항 (권장)
            }
        ],
        "page": 1,
        "size": 200,
        "totalItems": 1,
        "totalPages": 1
    }
}
```

## 임시 조치

프론트엔드에서 임시로 다음 변환을 적용했습니다:
- `comRoleId`가 있으면 `id`로 변환 (문자열로 변환)
- `status`가 없으면 기본값 `'INACTIVE'` 사용

**주의**: 이는 임시 조치이며, 백엔드 수정이 완료되면 제거될 예정입니다.

## 확인 요청

1. 백엔드 수정이 완료되었는지 확인 부탁드립니다.
2. 수정이 완료되었다면, 다음을 확인해주세요:
   - `GET /api/admin/roles` 응답에 `id` 필드가 있는지
   - `id` 필드가 문자열 형태인지
   - `status` 필드가 있는지
   - `comRoleId` 필드가 제거되었는지

## 영향 범위

이 수정은 다음 API 엔드포인트에도 영향을 미칩니다:
- `GET /api/admin/roles` (목록 조회) ✅ 확인 필요
- `GET /api/admin/roles/:roleId` (상세 조회) - 확인 필요
- `POST /api/admin/roles` (생성) - 응답 구조 확인 필요
- `PUT /api/admin/roles/:roleId` (수정) - 응답 구조 확인 필요

## 참고 문서

자세한 수정 요청 사항은 `docs/BACKEND_API_ROLES_RESPONSE_FIX.md`를 참고하세요.
